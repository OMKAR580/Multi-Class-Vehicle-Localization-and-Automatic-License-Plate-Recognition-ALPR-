"""Optical Character Recognition module for license plate extraction."""

import os
import re
import shutil
from typing import Any, Optional, Tuple
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
        Returns (raw_text, confidence).
        """
        if plate_crop is None:
            return ("", 0.0)

        # Convert to PIL Image if numpy
        pil_img: Optional[Image.Image] = None
        if isinstance(plate_crop, Image.Image):
            pil_img = plate_crop.copy()
        elif isinstance(plate_crop, np.ndarray):
            pil_img = Image.fromarray(plate_crop)

        if pil_img is not None:
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            w, h = pil_img.size
            if w > 0 and h > 0 and (w < 150 or h < 35):
                scale = max(2.0, 150.0 / w, 35.0 / h)
                pil_img = pil_img.resize((int(w * scale), int(h * scale)), Image.Resampling.BICUBIC)

        # 1. Try Tesseract OCR
        if self._tesseract_available and self._pytesseract is not None and pil_img is not None:
            for psm in [7, 8, 6]:
                cfg = f"--psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                try:
                    data = self._pytesseract.image_to_data(
                        pil_img,
                        output_type=self._pytesseract.Output.DICT,
                        config=cfg,
                    )
                    texts = []
                    confs = []
                    for i in range(len(data.get("text", []))):
                        word = data["text"][i].strip()
                        conf = float(data["conf"][i])
                        clean_w = re.sub(r"[^A-Z0-9]", "", word.upper())
                        if clean_w and conf >= 0:
                            texts.append(clean_w)
                            confs.append(0.75 if conf == 0 else conf / 100.0)
                    if texts:
                        full = "".join(texts)
                        if len(full) >= 4:
                            avg_conf = sum(confs) / len(confs) if confs else 0.75
                            return (full, round(avg_conf, 2))
                except Exception:
                    pass

                try:
                    raw_str = self._pytesseract.image_to_string(pil_img, config=cfg).strip()
                    clean_str = re.sub(r"[^A-Z0-9]", "", raw_str.upper())
                    if len(clean_str) >= 4:
                        return (clean_str, 0.75)
                except Exception:
                    pass

        # 2. EasyOCR fallback
        reader = self._get_easyocr_reader()
        if reader is not None:
            try:
                np_arr = np.array(pil_img if pil_img is not None else plate_crop)
                results = reader.readtext(np_arr)
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
