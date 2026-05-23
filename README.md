# Sparx Solver Pro

A macOS desktop app for Sparx Maths — double-click to run, no Python or pip required.

## Clone & build

```bash
git clone <your-repo-url>
cd sparx_pro
brew install python-tk@3.12
./scripts/build_mac_app.sh
```

Output: `dist/Sparx Solver Pro.app` and `dist/Sparx Solver Pro.zip` (not committed to git — build locally).

## Use the app

1. Open **`dist/Sparx Solver Pro.app`** (double-click, or drag it to **Applications**).
2. On first launch, macOS may warn that the app is from an unidentified developer:
   - **System Settings → Privacy & Security → Open Anyway**, or
   - Right-click the app → **Open** → **Open**.
3. Grant permissions when prompted (required for screen capture and typing):
   - **Screen Recording** — to read the question area
   - **Accessibility** — to type answers (System Settings → Privacy & Security)

Everything (Python, OCR models, libraries) is bundled inside the `.app`. You do not need to install Python or run `pip install`.

## Rebuild the app (optional)

If you change the code and want a fresh `.app`:

```bash
brew install python-tk@3.12   # once, needed for the UI toolkit
./scripts/build_mac_app.sh
```

The first build downloads dependencies and OCR models (~650 MB app). Later rebuilds are faster.

## Run from source (developers)

Requires **Python 3.12** and **tkinter** (`brew install python-tk@3.12`).

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```
