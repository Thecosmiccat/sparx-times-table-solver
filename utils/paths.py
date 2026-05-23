"""Paths that work in development and in a PyInstaller .app bundle."""
from __future__ import annotations

import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def bundle_root() -> Path:
    """Directory containing bundled resources (PyInstaller _MEIPASS)."""
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent.parent


def project_root() -> Path:
    if is_frozen():
        return Path(sys.executable).resolve().parent.parent.parent
    return Path(__file__).resolve().parent.parent


def bundled_easyocr_models() -> Path | None:
    bundled = bundle_root() / "models" / "easyocr"
    if bundled.is_dir() and any(bundled.iterdir()):
        return bundled
    return None


def easyocr_model_dir() -> Path:
    bundled = bundled_easyocr_models()
    if bundled is not None:
        return bundled
    return Path.home() / ".EasyOCR"
