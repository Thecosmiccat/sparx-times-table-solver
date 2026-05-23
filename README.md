# Sparx Times Table Solver (Chrome Extension)

A Chrome extension that reads maths questions **directly from the Sparx Maths page** (no screen capture or OCR), solves them, and fills in the answer.

Works on [Sparx Maths](https://www.sparxmaths.com/) in the browser — no Mac app, Python, or permissions for screen recording.

---

## Install (developer / unpacked)

1. **Download or clone** this repo:
   ```bash
   git clone https://github.com/Thecosmiccat/sparx-times-table-solver.git
   cd sparx-times-table-solver
   ```

2. Open Chrome and go to **`chrome://extensions`**.

3. Turn on **Developer mode** (top right).

4. Click **Load unpacked**.

5. Select the project folder (the folder that contains `manifest.json`).

6. Pin the extension: puzzle icon → **Sparx Times Table Solver**.

---

## How to use

1. Log in to **Sparx Maths** and open **100 Club** (or any times-table activity) in Chrome.

2. Open a question so you see the **question text** and **answer box**.

3. Click the extension icon in the toolbar.

4. Set **Rounds** (25 is typical).

5. Click **Scan page now** — check **Detected** and **Answer** look correct.

6. Click inside the Sparx **answer field** (cursor blinking).

7. Click **Start**.

8. Click **Stop** anytime to end the session.

The extension reads text from the page, normalises expressions like `12 × 12` or glued `1212` → `12*12`, and submits the result.

---

## What it solves

- Addition, subtraction, multiplication, division  
- Implicit multiply: `3x4`, `12×12`, `5 12`  
- Glued OCR-style digits: `1212` → `12×12`, `512` → `5×12`  
- Simple equations with `=` (when both sides are numeric)

---

## Troubleshooting

### “Open Sparx Maths in this tab first”

- The active tab must be Sparx (`sparxmaths.com`, `sparx-learning.com`, etc.).
- Refresh the Sparx page after installing the extension.

### Detected shows “—”

- Make sure the **question is visible** on screen.
- Click **Scan page now** again.
- Sparx may have updated their layout — open an issue with a screenshot.

### Answer is wrong

- Use **Scan page now** and confirm **Detected** matches the question.
- If Sparx shows unusual formatting, report it.

### Nothing is typed

- **Click the answer box** before **Start**.
- Sparx must be the focused tab.
- Try **Scan page now** first to confirm the extension is connected.

### Extension not listed after load

- Select the folder that contains **`manifest.json`**, not a parent folder.

---

## Project files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (Manifest V3) |
| `content.js` | Finds question + answer field on Sparx pages |
| `solver.js` | Normalises and solves expressions |
| `popup.html` / `popup.js` | Toolbar popup controls |
| `background.js` | Status relay between tab and popup |

---

## Publish to Chrome Web Store (optional)

1. Zip the extension (only the files above, not `.git`):
   ```bash
   zip -r sparx-solver.zip manifest.json content.js solver.js background.js popup.html popup.js popup.css
   ```
2. Follow [Chrome Web Store developer docs](https://developer.chrome.com/docs/webstore/publish/).

---

## Legal

For personal/educational use. Automating school platforms may violate their terms of service — use at your own risk.
