import re

class IndianPlateCleaner:
    """
    Regex postprocessing and state code verification for Indian vehicle plates.
    """
    INDIAN_STATE_CODES = {
        "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DN", "DD", "DL", "GA", "GJ",
        "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML",
        "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB"
    }

    def clean_text(self, raw_text: str) -> str:
        # Strip special characters and convert to uppercase
        clean = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
        return clean
