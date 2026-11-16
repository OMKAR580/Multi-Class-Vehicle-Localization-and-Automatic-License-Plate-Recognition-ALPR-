"""Optical Character Recognition module for license plate extraction."""

import os
import re
import shutil
from typing import Any, Optional, Tuple
import cv2
from PIL import Image
import numpy as np

from ai.pipeline.base import BasePlateOCR


def _find_tesseract_binary() -> Optional[str]:
    """Auto-detect Tesseract executable path across environment and standard OS locations."""
    # 1. Direct environment variable
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path and os.path.isfile(env_path):
        return env_path

    # 2. In PATH
    which_path = shutil.which("tesseract")
    if which_path:
        return which_path

    # 3. Standard Windows installation paths
    windows_candidates = [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in windows_candidates:
        if os.path.isfile(candidate):
            return candidate

    # 4. Standard Linux / Unix paths
    linux_candidates = [
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
    ]
    for candidate in linux_candidates:
        if os.path.isfile(candidate):
            return candidate

    return None


class IndianPlateOCR(BasePlateOCR):
    """
    Optical Character Recognition Component optimized for Indian State Codes & Formats.
    Uses Tesseract OCR with character whitelisting and auto-configured binary path,
    with automatic fallbacks and preprocessing.
    """

    DEFAULT_TESSERACT_CONFIG = (
        "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    )

    def __init__(
        self,
        engine: str = "tesseract",
        tesseract_cmd: Optional[str] = None,
        config: Optional[str] = None,
    ):
        self.engine = engine
        self.config = config or self.DEFAULT_TESSERACT_CONFIG
        self._tesseract_available = False
        self._easyocr_reader = None

        try:
            import pytesseract
            self._pytesseract = pytesseract

            cmd = tesseract_cmd or _find_tesseract_binary()
            if cmd:
                self._pytesseract.pytesseract.tesseract_cmd = cmd

            try:
                self._pytesseract.get_tesseract_version()
                self._tesseract_available = True
            except Exception:
                self._tesseract_available = False
        except ImportError:
            self._pytesseract = None
            self._tesseract_available = False

    @property
    def is_available(self) -> bool:
        return self._tesseract_available

    def _get_easyocr_reader(self):
        if self._easyocr_reader is None:
            try:
                import easyocr
                self._easyocr_reader = easyocr.Reader(["en"], gpu=False)
            except Exception:
                self._easyocr_reader = False
        return self._easyocr_reader if self._easyocr_reader is not False else None

    def extract_text(self, plate_crop: Any) -> Tuple[str, float]:
        """
        Extract alphanumeric text and confidence score from plate crop image.
        Uses OpenCV morphological preprocessing (CLAHE, bilateral filter, adaptive thresholding)
        and multi-view Tesseract decoding to maximize recognition recall on roadway plates.
        Returns (raw_text, confidence).
        """
        if plate_crop is None:
            return ("", 0.0)

        # Convert to numpy array for OpenCV morphological operations
        np_img: Optional[np.ndarray] = None
        if isinstance(plate_crop, Image.Image):
            np_img = np.array(plate_crop)
        elif isinstance(plate_crop, np.ndarray):
            np_img = plate_crop.copy()

        if np_img is None or np_img.size == 0:
            return ("", 0.0)

        # Convert to Grayscale
        if len(np_img.shape) == 3 and np_img.shape[2] >= 3:
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
        elif len(np_img.shape) == 2:
            gray = np_img.copy()
        else:
            gray = np_img[:, :, 0]

        gh, gw = gray.shape[:2]
        if gw <= 0 or gh <= 0:
            return ("", 0.0)

        # Upscale if crop is small to ensure character strokes are > 30px high
        if gw < 280 or gh < 70:
            scale = max(2.0, 280.0 / gw, 70.0 / gh)
            gray = cv2.resize(gray, (int(gw * scale), int(gh * scale)), interpolation=cv2.INTER_CUBIC)

        # 1. Morphological Preprocessing Views
        # --- CLAHE: improves local contrast (good for uneven lighting) ---
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(gray)

        # --- Sharpening: unsharp mask to make character edges crisper ---
        blurred = cv2.GaussianBlur(enhanced_gray, (0, 0), 3)
        sharpened = cv2.addWeighted(enhanced_gray, 1.5, blurred, -0.5, 0)

        # --- Bilateral denoise then threshold ---
        denoised = cv2.bilateralFilter(sharpened, 9, 75, 75)
        _, otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        inv_otsu = cv2.bitwise_not(otsu)
        adpt = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 17, 4)

        # --- Morphological closing: fills small gaps in characters ---
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        morph_otsu = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel)

        views_to_test = [sharpened, enhanced_gray, otsu, inv_otsu, morph_otsu, adpt, gray]

        # 2. Try Tesseract OCR across preprocessed views
        if self._tesseract_available and self._pytesseract is not None:
            # Indian plate patterns for scoring
            FULL_PLATE_RE = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$")
            BH_PLATE_RE = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")
            PREFIX_RE = re.compile(r"^[A-Z]{2}[0-9]")

            candidates: list[Tuple[int, float, str]] = []
            # Only use PSM 7 (single line) and PSM 8 (single word) — PSM 6 reads whole blocks
            # and produces long garbage strings from truck body text, stickers, etc.
            for view in views_to_test:
                for psm in [7, 8]:
                    cfg = f"--psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    try:
                        raw_str = self._pytesseract.image_to_string(view, config=cfg).strip()
                        clean_str = re.sub(r"[^A-Z0-9]", "", raw_str.upper())

                        # Hard filter: Indian plates are 4-12 chars; discard everything else
                        if len(clean_str) < 4 or len(clean_str) > 12:
                            continue

                        # Try to get real per-character confidence from Tesseract
                        real_conf = 0.85
                        try:
                            data = self._pytesseract.image_to_data(
                                view, config=cfg,
                                output_type=self._pytesseract.Output.DICT
                            )
                            confs = [
                                int(c) for c in data["conf"]
                                if str(c).lstrip("-").isdigit() and int(c) >= 0
                            ]
                            if confs:
                                real_conf = round(sum(confs) / len(confs) / 100.0, 3)
                                real_conf = max(0.1, min(0.99, real_conf))
                        except Exception:
                            real_conf = 0.85

                        # Pattern-based scoring (highest wins):
                        # 100 = exact full Indian plate format
                        # 50  = starts with valid state prefix + right length (7-11)
                        # 20  = starts with 2 alpha + digit (partial match)
                        # 5   = any 4+ char alphanumeric
                        score = 5
                        if FULL_PLATE_RE.match(clean_str) or BH_PLATE_RE.match(clean_str):
                            score = 100
                        elif PREFIX_RE.match(clean_str) and 7 <= len(clean_str) <= 11:
                            score = 50
                        elif PREFIX_RE.match(clean_str):
                            score = 20

                        candidates.append((score, real_conf, clean_str))
                    except Exception:
                        pass

            if candidates:
                # Sort by score descending; ties broken by string length (longer preferred)
                candidates.sort(key=lambda c: (c[0], len(c[2])), reverse=True)
                best = candidates[0]
                return (best[2], best[1])

        # 3. EasyOCR fallback
        try:
            reader = self._get_easyocr_reader()
            if reader is not None:
                results = reader.readtext(np_img)
                texts = []
                confs = []
                for _, text, conf in results:
                    clean = re.sub(r"[^A-Z0-9]", "", text.upper())
                    if clean:
                        texts.append(clean)
                        confs.append(float(conf))
                if texts:
                    full = "".join(texts)
                    avg_conf = sum(confs) / len(confs) if confs else 0.75
                    return (full, round(avg_conf, 2))
        except Exception:
            pass

        return ("", 0.0)
