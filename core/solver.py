"""Math solver with improved text normalisation.

Improvements over the original:
- Richer OCR-correction table covering common misreads (O→0, I→1, l→1)
- Cleaner regex pipeline that avoids over-stripping valid characters
- Returns equation type metadata so callers can log what kind of problem was solved
- Handles implicit multiplication (3x4) without mangling standalone 'x' variables
"""
import logging
import re
from typing import Optional, Tuple

import sympy

logger = logging.getLogger(__name__)

# Characters that EasyOCR commonly misreads in a maths context
_OCR_MAP = {
    "×": "*",
    "÷": "/",
    ":": "/",
    "?": "x",
    "X": "x",
    "O": "0",
    "I": "1",
    "l": "1",
}

# Matches digits-x-digits (implicit multiplication like "3x4")
_IMPLICIT_MUL = re.compile(r"(\d)\s*x\s*(\d)")
# "12 12" with no operator between number groups
_SPACED_NUMBERS = re.compile(r"(\d+)\s+(\d+)")
# Strips anything that isn't a recognised maths character
_ALLOWED = re.compile(r"[^0-9+\-*/().=x]")
# Collapses spaces around operators
_OP_SPACES = re.compile(r"\s*([+\-*/=()])\s*")
# Pure digit run (OCR glued "12×12" into "1212")
_ONLY_DIGITS = re.compile(r"^\d+$")


class MathSolver:

    @staticmethod
    def _has_operator(text: str) -> bool:
        return any(c in text for c in "+-*/=")

    @staticmethod
    def _score_split(left: str, right: str, op: str) -> int:
        score = 0
        if op == "*":
            score += 6
        elif op == "+":
            score += 4
        if 1 <= len(left) <= 3 and 1 <= len(right) <= 3:
            score += 10
        # Prefer 5×12 / 9×8 style over 51×2 / 98 as a plain number
        if len(left) == 1 and len(right) >= 2:
            score += 4
        if len(right) == 1 and len(left) >= 2:
            score += 4
        score -= abs(len(left) - len(right))
        if len(left) == 1 and len(right) > 2:
            score -= 6
        if len(right) == 1 and len(left) > 2:
            score -= 6
        # Sparx drills rarely use operands above ~15
        try:
            if int(left) > 15 or int(right) > 15:
                score -= 8
        except ValueError:
            pass
        return score

    def _repair_glued_digits(self, text: str) -> str:
        """Split OCR-merged values like 1212 → 12*12 or 512 → 5*12 when no operator is present."""
        if not _ONLY_DIGITS.match(text):
            return text

        # 5×4 misread as "54"
        if len(text) == 2:
            left, right = text[0], text[1]
            expr = f"{left}*{right}"
            try:
                sympy.sympify(expr)
                return expr
            except Exception:
                return text

        if len(text) < 3:
            return text

        best_expr: Optional[str] = None
        best_score = -1

        for i in range(1, len(text)):
            left, right = text[:i], text[i:]
            if len(left) > 4 or len(right) > 4:
                continue
            for op in ("*", "+", "-"):
                if op == "-" and int(left) < int(right):
                    continue
                expr = f"{left}{op}{right}"
                try:
                    sympy.sympify(expr)
                except Exception:
                    continue
                score = self._score_split(left, right, op)
                if score > best_score:
                    best_score = score
                    best_expr = expr

        return best_expr if best_expr is not None else text

    def normalize(self, text: str) -> str:
        text = text.strip()

        # Apply OCR corrections character-by-character first
        for bad, good in _OCR_MAP.items():
            text = text.replace(bad, good)

        # Convert implicit multiplication (3x4 → 3*4) before stripping 'x'
        text = _IMPLICIT_MUL.sub(r"\1*\2", text)

        # "12 12" → "12*12" when × was dropped but numbers are separate
        if not self._has_operator(text):
            text = _SPACED_NUMBERS.sub(r"\1*\2", text)

        # Remove disallowed characters
        text = _ALLOWED.sub("", text)

        # Tighten spacing around operators
        text = _OP_SPACES.sub(r"\1", text)

        # "1212" with no operator → try 12*12, 7+5, etc.
        if not self._has_operator(text):
            text = self._repair_glued_digits(text)

        # Balance parentheses
        opens = text.count("(")
        closes = text.count(")")
        if opens > closes:
            text += ")" * (opens - closes)

        return text.strip()

    def solve(self, raw: str) -> Tuple[Optional[str], str]:
        """Return (answer_string, equation_type).

        equation_type is one of: 'expression', 'equation', 'empty', 'unsolvable', 'error'.
        """
        normalized = self.normalize(raw)
        if not normalized:
            return None, "empty"

        try:
            if "=" in normalized:
                lhs_str, rhs_str = normalized.split("=", 1)
                x = sympy.Symbol("x")
                lhs = sympy.sympify(lhs_str)
                rhs = sympy.sympify(rhs_str)
                solutions = sympy.solve(sympy.Eq(lhs, rhs), x)
                if not solutions:
                    return None, "unsolvable"
                result = solutions[0]
                eq_type = "equation"
            else:
                result = sympy.sympify(normalized)
                eq_type = "expression"

            # Format as integer when possible, otherwise 6 d.p.
            if result == int(result):
                return str(int(result)), eq_type
            return f"{float(result):.6f}".rstrip("0").rstrip("."), eq_type

        except Exception as exc:
            logger.warning("Solver failed for %r: %s", normalized, exc)
            return None, "error"
