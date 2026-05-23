#!/usr/bin/env bash
# Build a self-contained Sparx Solver Pro.app (no Python install required to run).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3.12}"
VENV="$ROOT/.build-venv"
APP_NAME="Sparx Solver Pro.app"
DIST="$ROOT/dist"
MODEL_DIR="$ROOT/resources/models/easyocr"

echo "==> Using $("$PYTHON" --version)"

if ! "$PYTHON" -c "import tkinter" 2>/dev/null; then
  echo "ERROR: tkinter is not available for $PYTHON." >&2
  echo "Install it with: brew install python-tk@3.12" >&2
  exit 1
fi

if [[ ! -d "$VENV" ]]; then
  echo "==> Creating build virtualenv"
  "$PYTHON" -m venv "$VENV"
fi
# shellcheck source=/dev/null
source "$VENV/bin/activate"

if ! python -c "import tkinter" 2>/dev/null; then
  echo "ERROR: build venv is missing tkinter. Remove .build-venv and rebuild." >&2
  exit 1
fi

echo "==> Installing dependencies"
pip install -q --upgrade pip
pip install -q -r requirements-build.txt

echo "==> Bundling EasyOCR English models (one-time download for the .app)"
mkdir -p "$MODEL_DIR"
python - <<'PY'
from pathlib import Path
import easyocr

dest = Path("resources/models/easyocr")
dest.mkdir(parents=True, exist_ok=True)
# Download into project tree so PyInstaller can ship them offline.
easyocr.Reader(["en"], gpu=False, model_storage_directory=str(dest), download_enabled=True)
print("Models stored in", dest.resolve())
PY

echo "==> Running PyInstaller"
pyinstaller --noconfirm --clean sparx_pro.spec

OUT="$DIST/$APP_NAME"

# Copy to a clean path so Finder/iCloud xattrs don't break codesign ("damaged" on open)
if [[ -d "$OUT" ]]; then
  CLEAN="/tmp/sparx-pro-sign.app"
  rm -rf "$CLEAN"
  ditto "$OUT" "$CLEAN"
  xattr -cr "$CLEAN"
  codesign --force --deep --sign - "$CLEAN"
  rm -rf "$OUT"
  ditto "$CLEAN" "$OUT"
  rm -rf "$CLEAN"
fi
if [[ -d "$OUT" ]]; then
  cp "$ROOT/release/Open Sparx Solver Pro.command" "$DIST/"
  cp "$ROOT/release/First time opening (read me).txt" "$DIST/"
  chmod +x "$DIST/Open Sparx Solver Pro.command"
  (cd "$DIST" && rm -f "Sparx Solver Pro.zip" && zip -r -y "Sparx Solver Pro.zip" \
    "Sparx Solver Pro.app" "Open Sparx Solver Pro.command" "First time opening (read me).txt")
  echo ""
  echo "Built: $OUT"
  echo "Zip:   $DIST/Sparx Solver Pro.zip"
  echo "Open it: open \"$OUT\""
  echo "Or drag Sparx Solver Pro.app to Applications."
else
  echo "Build finished but $OUT was not found." >&2
  exit 1
fi
