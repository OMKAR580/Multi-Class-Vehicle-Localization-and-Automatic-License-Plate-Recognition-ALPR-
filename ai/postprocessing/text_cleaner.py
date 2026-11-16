"""Postprocessing and text formatting for Indian vehicle registration plates."""

import re
from typing import Optional, Tuple
from ai.pipeline.base import BasePostProcessor


class IndianPlateCleaner(BasePostProcessor):
    """
    Regex postprocessing and state code verification for Indian vehicle plates.
    Supports standard Indian formats:
    - Standard: [State Code 2 chars][RTO Code 1-2 digits][Series 1-3 chars][Number 4 digits] (e.g. MH12AB1234)
    - Bharat (BH) Series: [Year 2 digits]BH[Number 4 digits][Series 1-2 chars] (e.g. 22BH1234AA)
    """

    INDIAN_STATE_CODES = {
        "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DN", "DD", "DL", "GA", "GJ",
        "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML",
        "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB"
    }

    # Common OCR character confusion maps
    DIGIT_TO_ALPHA = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B"}
    ALPHA_TO_DIGIT = {"O": "0", "I": "1", "Z": "2", "S": "5", "B": "8", "D": "0", "G": "6"}

    def clean_text(self, raw_text: str) -> str:
        """Strip special characters, spaces, and non-alphanumeric noise, converting to uppercase."""
        if not raw_text:
            return ""
        clean = re.sub(r"[^A-Z0-9]", "", raw_text.upper())

        # Hard reject: too long (garbage from body text) or too short
        if len(clean) > 12 or len(clean) < 4:
            return ""

        if len(clean) >= 2:
            prefix = clean[:2]
            # Extended OCR confusion fixes for Indian state codes
            # Maps common mis-reads → correct state code
            state_fixes = {
                "PL": "DL", "OL": "DL", "0L": "DL", "D1": "DL",
                "1P": "UP", "IP": "UP", "JP": "UP", "VP": "UP",
                "1K": "JK", "JL": "KL", "KI": "KA", "K4": "KA",
                "RR": "RJ", "MR": "MH", "M4": "MH", "TM": "TN",
                "W8": "WB", "W6": "WB", "GB": "GJ", "GG": "GJ",
                "PR": "PB", "P8": "PB", "H9": "HP", "HR0": "HR",
            }
            if prefix in state_fixes and prefix not in self.INDIAN_STATE_CODES:
                clean = state_fixes[prefix] + clean[2:]

        # Only apply positional digit↔alpha correction for strings that match
        # valid Indian plate length (9 or 10 chars). For everything else, return as-is
        # to avoid mangling partial or non-standard reads into worse garbage.

        # 8-char format: AA D A DDDD (e.g. KL9C2763 — single-digit RTO + single-letter series)
        if len(clean) == 8:
            c = list(clean)
            for i in [0, 1]:
                if c[i] in self.DIGIT_TO_ALPHA:
                    c[i] = self.DIGIT_TO_ALPHA[c[i]]
            if c[2] in self.ALPHA_TO_DIGIT:
                c[2] = self.ALPHA_TO_DIGIT[c[2]]
            if c[3] in self.DIGIT_TO_ALPHA:
                c[3] = self.DIGIT_TO_ALPHA[c[3]]
            for i in [4, 5, 6, 7]:
                if c[i] in self.ALPHA_TO_DIGIT:
                    c[i] = self.ALPHA_TO_DIGIT[c[i]]
            clean = "".join(c)

        # Standard 10-char Indian format: AA DD AA DDDD (e.g. UP32CR0423)
        if len(clean) == 10:
            c = list(clean)
            # Positions 0,1: State -> alpha
            for i in [0, 1]:
                if c[i] in self.DIGIT_TO_ALPHA:
                    c[i] = self.DIGIT_TO_ALPHA[c[i]]
            # Positions 2,3: RTO -> digit
            for i in [2, 3]:
                if c[i] in self.ALPHA_TO_DIGIT:
                    c[i] = self.ALPHA_TO_DIGIT[c[i]]
            # Positions 4,5: Series -> alpha
            for i in [4, 5]:
                if c[i] in self.DIGIT_TO_ALPHA:
                    c[i] = self.DIGIT_TO_ALPHA[c[i]]
            # Positions 6,7,8,9: Number -> digit
            for i in [6, 7, 8, 9]:
                if c[i] in self.ALPHA_TO_DIGIT:
                    c[i] = self.ALPHA_TO_DIGIT[c[i]]
            clean = "".join(c)

        # Standard 9-char Indian format: AA D AA DDDD (e.g. DL3CCA1750)
        elif len(clean) == 9:
            c = list(clean)
            # Positions 0,1: State -> alpha
            for i in [0, 1]:
                if c[i] in self.DIGIT_TO_ALPHA:
                    c[i] = self.DIGIT_TO_ALPHA[c[i]]
            # Position 2: RTO -> digit
            if c[2] in self.ALPHA_TO_DIGIT:
                c[2] = self.ALPHA_TO_DIGIT[c[2]]
            # Positions 3,4: Series -> alpha
            for i in [3, 4]:
                if c[i] in self.DIGIT_TO_ALPHA:
                    c[i] = self.DIGIT_TO_ALPHA[c[i]]
            # Positions 5,6,7,8: Number -> digit
            for i in [5, 6, 7, 8]:
                if c[i] in self.ALPHA_TO_DIGIT:
                    c[i] = self.ALPHA_TO_DIGIT[c[i]]
            clean = "".join(c)

        return clean

    def clean_plate_text(self, raw_text: str) -> str:
        """Interface implementation for BasePostProcessor."""
        return self.clean_text(raw_text)

    def validate_state_code(self, plate_text: str) -> bool:
        """Verify if the first two characters correspond to a recognized Indian state/UT code."""
        if len(plate_text) >= 2:
            return plate_text[:2] in self.INDIAN_STATE_CODES
        return False

    def is_valid_format(self, plate_text: str) -> bool:
        """
        Validate whether the plate matches Indian registration patterns:
        Standard: ^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$
        BH series: ^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$
        """
        if not plate_text:
            return False
        clean = self.clean_text(plate_text)
        standard_pattern = r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"
        bh_pattern = r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$"
        return bool(re.match(standard_pattern, clean) or re.match(bh_pattern, clean))

    def format_plate(self, plate_text: str) -> str:
        """Format clean plate text into space-separated readable groups (e.g., 'MH 12 AB 1234')."""
        clean = self.clean_text(plate_text)
        m = re.match(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})$", clean)
        if m:
            return f"{m.group(1)} {m.group(2)} {m.group(3)} {m.group(4)}"
        return clean
