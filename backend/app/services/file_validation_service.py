"""File validation service for VisionPlate AI.

Performs multi-layered verification:
1. Filename sanitization and path-traversal prevention.
2. Extension allowlist checking.
3. Declared Content-Type allowlist checking and alignment.
4. Magic byte / container signature inspection.
5. Deep image structural decoding (Pillow) with dimension & corruption checks.
6. Deep video container validation (ISOBMFF atom/box integrity).
7. Explicit malware scanner boundary.
"""

import os
import re
import struct
import unicodedata
import warnings
from abc import ABC, abstractmethod
from pathlib import Path
from PIL import Image, ImageFile
from PIL.Image import DecompressionBombError, DecompressionBombWarning

from app.core.config import settings
from app.core.exceptions import InvalidFileException, UnsupportedMediaTypeException
from app.core.logging import logger

# Strictly reject truncated images during validation
ImageFile.LOAD_TRUNCATED_IMAGES = False

# Maximum image pixel dimensions and total pixel count to prevent decompression bombs
MAX_IMAGE_DIMENSION = 10000
MAX_IMAGE_PIXELS = 25_000_000  # 25 megapixels (e.g. 5000x5000)

# Configure Pillow's internal safety threshold
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

# Mapping of supported extensions to canonical MIME types
EXTENSION_TO_MIME: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".mp4": "video/mp4",
}

# Recognized ISOBMFF major brands for MP4 containers
VALID_MP4_BRANDS: set[bytes] = {
    b"isom",
    b"iso2",
    b"mp41",
    b"mp42",
    b"avc1",
    b"M4V ",
    b"qt  ",
    b"MSNV",
    b"NDAS",
    b"dash",
}


def sanitize_filename(original_filename: str | None) -> str:
    """
    Sanitize an uploaded filename for safe display and metadata recording only.
    This sanitized name is never used to construct storage filesystem paths.
    """
    if not original_filename or not original_filename.strip():
        return "unnamed_asset"

    # Strip any directory path components (handling both / and \)
    base = os.path.basename(original_filename.replace("\\", "/"))

    # Normalize unicode characters
    normalized = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode("ascii")

    # Replace null bytes, control characters, and unsafe shell/path symbols
    sanitized = re.sub(r'[\x00-\x1f\x7f<>:"/\\|?*]', "_", normalized)

    # Collapse consecutive dots or underscores
    sanitized = re.sub(r"\.{2,}", ".", sanitized)
    sanitized = re.sub(r"_{2,}", "_", sanitized).strip(" ._")

    if not sanitized:
        return "unnamed_asset"

    # Enforce maximum length (255 characters) preserving extension if possible
    if len(sanitized) > 255:
        name_part, ext_part = os.path.splitext(sanitized)
        max_name_len = 255 - len(ext_part)
        sanitized = f"{name_part[:max_name_len]}{ext_part}"

    return sanitized


class BaseMalwareScanner(ABC):
    """Abstract interface for file scanning (e.g., ClamAV, VirusTotal)."""

    @abstractmethod
    async def scan_file(self, file_path: Path) -> bool:
        """Scan file on disk. Return True if safe, False if infected."""
        pass


class NoOpMalwareScanner(BaseMalwareScanner):
    """
    Default fallback scanner when no external antivirus engine is configured.
    Provides an explicit integration boundary. Uploads are NOT malware-scanned.
    """

    _warned: bool = False

    async def scan_file(self, file_path: Path) -> bool:
        if not NoOpMalwareScanner._warned:
            logger.warning(
                "MalwareScanner: No external virus scanner configured. "
                "Uploaded assets are not scanned for malware."
            )
            NoOpMalwareScanner._warned = True
        return True


def _verify_magic_bytes(header: bytes, expected_mime: str) -> None:
    """Verify magic bytes match the expected MIME type."""
    if expected_mime == "image/jpeg":
        if not header.startswith(b"\xff\xd8\xff"):
            raise InvalidFileException("File content signature does not match JPEG format.")
    elif expected_mime == "image/png":
        if not header.startswith(b"\x89PNG\r\n\x1a\n"):
            raise InvalidFileException("File content signature does not match PNG format.")
    elif expected_mime == "video/mp4":
        if len(header) < 12 or header[4:8] != b"ftyp":
            raise InvalidFileException("File content signature does not match MP4 container format.")
        brand = header[8:12]
        if brand not in VALID_MP4_BRANDS:
            # Check compatible brands in the rest of ftyp box if available
            box_len = struct.unpack(">I", header[0:4])[0]
            compatible_brands = [header[i:i+4] for i in range(16, min(len(header), box_len), 4)]
            if not any(b in VALID_MP4_BRANDS for b in compatible_brands):
                brand_str = brand.decode("ascii", errors="replace")
                raise InvalidFileException(f"Unsupported MP4 container brand: {brand_str}")


def _validate_image_structure(file_path: Path, expected_mime: str) -> None:
    """
    Decode and verify image structure using Pillow.
    Ensures the image is not corrupted, truncated, or an oversized decompression bomb.
    """
    with warnings.catch_warnings():
        warnings.filterwarnings("error", category=DecompressionBombWarning)
        try:
            with Image.open(file_path) as img:
                img.verify()
                expected_format = "JPEG" if expected_mime == "image/jpeg" else "PNG"
                if img.format != expected_format:
                    raise InvalidFileException(
                        f"Image internal format ({img.format}) does not match declared type ({expected_format})."
                    )

            # Reopen to perform dimension & deep pixel decompression check (verify() closes the file)
            with Image.open(file_path) as img:
                width, height = img.size
                if width <= 0 or height <= 0:
                    raise InvalidFileException("Image dimensions are invalid.")
                if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
                    raise InvalidFileException(
                        f"Image dimensions ({width}x{height}) exceed maximum allowed ({MAX_IMAGE_DIMENSION}px)."
                    )
                if (width * height) > MAX_IMAGE_PIXELS:
                    raise InvalidFileException(
                        f"Image total pixels ({width * height:,}) exceed maximum allowed ({MAX_IMAGE_PIXELS:,})."
                    )
                img.load()
        except (DecompressionBombWarning, DecompressionBombError) as exc:
            logger.warning("Decompression bomb detected: %s", exc)
            raise InvalidFileException(
                f"Image rejected: potential decompression bomb detected ({exc})."
            ) from exc
        except (InvalidFileException, UnsupportedMediaTypeException):
            raise
        except Exception as exc:
            logger.warning("Image structural validation failed: %s", exc)
            raise InvalidFileException("Image file is corrupted, truncated, or cannot be decoded.") from exc


def _validate_mp4_container_structure(file_path: Path) -> None:
    """
    Validate ISO Base Media File Format (ISOBMFF) box/atom structure.
    Checks box boundaries, sizes, atom offsets, and confirms the presence of essential boxes.

    LIMITATION NOTE:
    Validates container atom hierarchy and header syntax. Complete video stream bitstream
    decoding requires downstream pipeline processing tools (e.g. ffmpeg).
    """
    try:
        file_size = file_path.stat().st_size
        if file_size < 16:
            raise InvalidFileException("MP4 file is too small to be a valid container.")

        with open(file_path, "rb") as f:
            offset = 0
            has_ftyp = False
            has_mdat = False

            while offset + 8 <= file_size:
                f.seek(offset)
                header = f.read(8)
                if len(header) < 8:
                    raise InvalidFileException("Truncated MP4 box header encountered.")

                size = struct.unpack(">I", header[0:4])[0]
                box_type = header[4:8]

                if size == 0:
                    # Extends to EOF
                    box_size = file_size - offset
                elif size == 1:
                    # 64-bit extended size
                    ext_header = f.read(8)
                    if len(ext_header) < 8:
                        raise InvalidFileException("Truncated MP4 64-bit box header.")
                    box_size = struct.unpack(">Q", ext_header)[0]
                else:
                    box_size = size

                if box_size < 8 or offset + box_size > file_size:
                    raise InvalidFileException("Corrupted or truncated MP4 atom detected.")

                if box_type == b"ftyp":
                    has_ftyp = True
                elif box_type == b"mdat":
                    # Require actual media payload beyond the box header
                    header_size = 16 if size == 1 else 8
                    if box_size > header_size:
                        has_mdat = True

                offset += box_size

            if not has_ftyp:
                raise InvalidFileException("Incomplete MP4 container: missing ftyp box.")
            if not has_mdat:
                raise InvalidFileException(
                    "MP4 container contains no actual media data (missing or empty mdat atom)."
                )

    except (InvalidFileException, UnsupportedMediaTypeException):
        raise
    except Exception as exc:
        logger.warning("MP4 container validation failed: %s", exc)
        raise InvalidFileException("MP4 container structure is invalid or corrupted.") from exc


async def validate_file(
    temp_path: Path,
    original_filename: str | None,
    declared_content_type: str | None,
    file_size_bytes: int,
    malware_scanner: BaseMalwareScanner | None = None,
) -> tuple[str, str]:
    """
    Validate the temporary uploaded file against all security and integrity policies.

    Returns:
        tuple[str, str]: (sanitized_original_filename, canonical_mime_type)
    """
    # 1. Size sanity check
    if file_size_bytes == 0:
        raise InvalidFileException("Uploaded file is empty (0 bytes).")

    # 2. Filename and extension check
    sanitized_name = sanitize_filename(original_filename)
    ext = os.path.splitext(sanitized_name)[1].lower()

    if not ext:
        raise UnsupportedMediaTypeException("Uploaded file lacks a valid file extension.")

    allowed_exts = set(settings.ALLOWED_IMAGE_EXTENSIONS + settings.ALLOWED_VIDEO_EXTENSIONS)
    if ext not in allowed_exts:
        raise UnsupportedMediaTypeException(
            f"File extension '{ext}' is not supported. Allowed extensions: {sorted(allowed_exts)}"
        )

    expected_mime = EXTENSION_TO_MIME.get(ext)
    if not expected_mime:
        raise UnsupportedMediaTypeException(f"Unsupported file format for extension '{ext}'.")

    # 3. Declared Content-Type check
    normalized_declared_type = (declared_content_type or "").lower().split(";")[0].strip()
    if not normalized_declared_type or normalized_declared_type not in settings.ALLOWED_MIME_TYPES:
        raise UnsupportedMediaTypeException(
            f"Content-Type '{normalized_declared_type}' is unsupported. Allowed types: {settings.ALLOWED_MIME_TYPES}"
        )

    # 4. Content-Type to Extension alignment
    if normalized_declared_type != expected_mime:
        raise InvalidFileException(
            f"Mismatched media type: extension '{ext}' implies '{expected_mime}' "
            f"but Content-Type is '{normalized_declared_type}'."
        )

    # 5. Header and magic byte verification
    with open(temp_path, "rb") as f:
        header = f.read(64)

    _verify_magic_bytes(header, expected_mime)

    # 6. Deep container/structural verification
    if expected_mime in ("image/jpeg", "image/png"):
        _validate_image_structure(temp_path, expected_mime)
    elif expected_mime == "video/mp4":
        _validate_mp4_container_structure(temp_path)

    # 7. Malware scanner integration boundary
    scanner = malware_scanner or NoOpMalwareScanner()
    is_safe = await scanner.scan_file(temp_path)
    if not is_safe:
        raise InvalidFileException("File failed malware security inspection.")

    return sanitized_name, expected_mime
