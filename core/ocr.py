"""OCR engine with multiple preprocessing strategies.

Improvement over the original single-pipeline approach: tries three different
image preprocessing strategies and returns the result with the highest
confidence score. This dramatically reduces misreads on varying backgrounds.
"""
import logging
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

ALLOWED_CHARS = "0123456789+-*/()=? xX×÷:"


class OCREngine:
    def __init__(self) -> None:
        self._reader = None

    # ------------------------------------------------------------------
    # Lazy init so the heavy EasyOCR model loads only when first needed
    # ------------------------------------------------------------------
    def _ensure_loaded(self) -> None:
        if self._reader is not None:
            return
        import easyocr  # type: ignore

        try:
            self._reader = easyocr.Reader(["en"], gpu=True)
            logger.info("EasyOCR loaded with GPU")
        except Exception:
            self._reader = easyocr.Reader(["en"], gpu=False)
            logger.info("EasyOCR loaded with CPU")

    # ------------------------------------------------------------------
    # Preprocessing strategies
    # ------------------------------------------------------------------
    @staticmethod
    def _standard(img: Image.Image) -> np.ndarray:
        gray = img.convert("L")
        arr = np.array(gray)
        return np.where(arr < 145, 0, 255).astype(np.uint8)

    @staticmethod
    def _high_contrast(img: Image.Image) -> np.ndarray:
        gray = img.convert("L")
        enhanced = ImageEnhance.Contrast(gray).enhance(3.0)
        arr = np.array(enhanced)
        return np.where(arr < 200, 0, 255).astype(np.uint8)

    @staticmethod
    def _inverted(img: Image.Image) -> np.ndarray:
        """For dark-background / light-text layouts."""
        gray = img.convert("L")
        arr = 255 - np.array(gray)
        return np.where(arr < 145, 0, 255).astype(np.uint8)

    # ------------------------------------------------------------------
    # Core OCR call
    # ------------------------------------------------------------------
    def _run(self, arr: np.ndarray) -> Tuple[str, float]:
        results = self._reader.readtext(
            arr,
            allowlist=ALLOWED_CHARS,
            detail=1,
            low_text=0.3,
            min_size=5,
            batch_size=4,
        )
        if not results:
            return "", 0.0
        texts = [r[1] for r in results]
        confs = [r[2] for r in results]
        return " ".join(texts), sum(confs) / len(confs)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------
    def extract(
        self, img: Image.Image, min_confidence: float = 0.3
    ) -> Tuple[str, float, np.ndarray]:
        """Try all preprocessing strategies, return (text, confidence, array).

        Falls back to standard preprocessing if all strategies yield empty text.
        """
        self._ensure_loaded()

        strategies = [self._standard, self._high_contrast, self._inverted]
        best_text, best_conf, best_arr = "", 0.0, self._standard(img)

        for strategy in strategies:
            try:
                arr = strategy(img)
                text, conf = self._run(arr)
                if text.strip() and conf > best_conf:
                    best_text, best_conf, best_arr = text, conf, arr
            except Exception as exc:
                logger.warning("OCR strategy %s failed: %s", strategy.__name__, exc)

        return best_text, best_conf, best_arr
