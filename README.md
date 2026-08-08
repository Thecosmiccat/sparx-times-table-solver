# Sparx Times Table Solver (Chrome Extension)

A Chrome extension that reads maths questions **directly from the Sparx Maths page**, solves them, and fills in the answer — including **Hundred Club** (on-screen keypad).

---

## Folder layout

```
sparx-times-table-solver/
├── README.md          ← you are here
├── package.json       ← optional: npm test for the maths solver
├── tests/
└── extension/         ← load THIS folder in Chrome
    ├── manifest.json
    ├── content.js
    ├── solver.js
    ├── sparx-dom.js
    ├── background.js
    ├── popup.html
    ├── popup.js
    └── popup.css
```

The extension lives in the **`extension/`** folder — not the repo root.

---

## Install

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Thecosmiccat/sparx-times-table-solver.git
   cd sparx-times-table-solver
   ```

2. Open Chrome → **`chrome://extensions`**

3. Enable **Developer mode** (top right)

4. Click **Load unpacked**

5. Select the **`extension`** folder inside the repo:
   ```
   sparx-times-table-solver/extension
   ```
   (It must contain `manifest.json`.)

6. Pin **Sparx Times Table Solver** from the puzzle icon in the toolbar.

7. After installing or updating, **refresh** any open Sparx tab.

---

## How to use

1. Open **Sparx Maths** (100 Club or similar) in Chrome and **refresh the page** after installing the extension.

2. A **Sparx Solver** tab at the **bottom-left** opens the controls (hidden by default so it does not cover the question). Hundred Club shows **`12 × 7 = ?`** at the top — the extension reads that box and enters the answer via the **on-screen keypad** (or a real input when present).

3. Open a question with the answer area visible.

4. Click **Scan question** on the panel → check **Detected** / **Answer**.

5. Click **Start** on the panel (no need to focus an input for Hundred Club).

6. **Stop** ends the session.

> The toolbar popup **closes when you click outside it** — that is normal in Chrome. The on-page panel keeps running.

---

## Troubleshooting

### Loaded the wrong folder

If Chrome says the manifest is missing, you picked the repo root. Choose **`extension/`** instead.

### “Open Sparx Maths in this tab first”

- Use a Sparx tab (`sparxmaths.com`, `sparx-learning.com`, etc.) and refresh after installing.

### Detected is “—”

- Question must be on screen → try **Scan question** again.
- Hide the panel with **×** if it covers the numbers.

### Nothing types / answers not accepted

- Hundred Club needs the **on-screen number pad** visible (digits + OK).
- Refresh the Sparx tab after updating the extension.
- If the question lives in an iframe, Start from the panel still works — the background script talks to every frame.

### After updating the extension

1. Go to `chrome://extensions`
2. Click the refresh icon on Sparx Solver
3. Hard-refresh the Sparx tab

---

## Developer

```bash
npm test
```

Runs unit tests for the maths normaliser/solver (no Chrome required).

---

## Project files (inside `extension/`)

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config |
| `content.js` | Reads question, enters answer, on-page panel |
| `sparx-dom.js` | Sparx / Hundred Club DOM + keypad helpers |
| `solver.js` | Maths normalisation + solver |
| `popup.html` / `popup.js` | Toolbar UI |
| `background.js` | Multi-frame messaging + script injection |

---

## Legal

Personal/educational use only. May violate Sparx terms — use at your own risk.
