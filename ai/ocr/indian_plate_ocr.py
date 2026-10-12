from typing import Any, Tuple
from ai.pipeline.base import BasePlateOCR


class IndianPlateOCR(BasePlateOCR):
    """
    Optical Character Recognition Component optimized for Indian State Codes & Formats.
    """

    def __init__(self, engine: str = "tesseract"):
        self.engine = engine
        self._tesseract_available = False
        try:
            import pytesseract
            self._tesseract_available = True
        except ImportError:
            self._tesseract_available = False

    def extract_text(self, plate_crop: Any) -> Tuple[str, float]:
        """
        Extract alphanumeric text and confidence score from plate crop image.
        Returns (raw_text, confidence).
        """
        if self._tesseract_available:
            try:
                import pytesseract
                # Run tesseract with alphanumeric psm 7 configuration
                data = pytesseract.image_to_data(plate_crop, output_type=pytesseract.Output.DICT, config="--psm 7")
                texts = []
                confidences = []
                for i in range(len(data.get("text", []))):
                    word = data["text"][i].strip()
                    conf = float(data["conf"][i])
                    if word and conf > 0:
                        texts.append(word)
                        confidences.append(conf / 100.0)
                if texts:
                    full_text = " ".join(texts)
                    avg_conf = sum(confidences) / len(confidences)
                    return (full_text, round(avg_conf, 2))
            except Exception:
                pass

        return ("", 0.0)
