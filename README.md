# Sparx Times Table Solver (Chrome Extension)

A Chrome extension that reads maths questions **directly from the Sparx Maths page**, solves them, and fills in the answer.

---

## Folder layout

```
sparx-times-table-solver/
├── README.md          ← you are here
└── extension/         ← load THIS folder in Chrome
    ├── manifest.json
    ├── content.js
    ├── solver.js
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

---

## How to use

1. Open **Sparx Maths** (100 Club or similar) in Chrome and **refresh the page** after installing the extension.

2. A small **Sparx Solver** bar appears at the **top-left** (collapsed). Click **+** to expand, or **×** to hide it if it covers the question. A **Sparx Solver** tab at the bottom-left brings it back.

3. Open a question with the **answer box** visible.

4. Click **Scan question** on the panel → check **Detected** / **Answer**.

5. Click in the Sparx **answer field**, then **Start** on the panel.

6. **Stop** ends the session.

> The toolbar popup **closes when you click outside it** — that is normal in Chrome. The on-page panel keeps running.

---

## Troubleshooting

### Loaded the wrong folder

If Chrome says the manifest is missing, you picked the repo root. Choose **`extension/`** instead.

### “Open Sparx Maths in this tab first”

- Use a Sparx tab (`sparxmaths.com`, etc.) and refresh after installing.

### Detected is “—”

- Question must be on screen → try **Scan page now** again.

### Nothing types

- Click the answer box before **Start**.

---

## Project files (inside `extension/`)

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config |
| `content.js` | Reads question, fills answer on Sparx pages |
| `solver.js` | Maths normalisation + solver |
| `popup.html` / `popup.js` | Toolbar UI |
| `background.js` | Status messages |

---

## Legal

Personal/educational use only. May violate Sparx terms — use at your own risk.
