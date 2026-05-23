# Sparx Solver Pro

A macOS app that reads Sparx Maths times-table questions on screen, solves them, and types the answer for you.

**No Python install needed** if you use the pre-built app from [Releases](https://github.com/Thecosmiccat/sparx-times-table-solver/releases).

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **macOS** | 12 (Monterey) or newer |
| **Mac type** | Apple Silicon (M1/M2/M3/M4). Intel Macs are not supported by the current build |
| **Sparx** | 100 Club (or similar) times-table activity open in a browser |
| **Permissions** | Screen Recording + Accessibility (see below) |

---

## Installation (recommended — download the app)

### Step 1 — Download

1. Open **[Releases](https://github.com/Thecosmiccat/sparx-times-table-solver/releases)**.
2. Download **`Sparx Solver Pro.zip`** from the latest release (e.g. *sparx pro v2*).
3. Wait for the download to finish (~270 MB).

### Step 2 — Unzip

1. Open your **Downloads** folder.
2. Double-click **`Sparx Solver Pro.zip`**.
3. You should see:
   - `Sparx Solver Pro.app`
   - `Open Sparx Solver Pro.command`
   - `First time opening (read me).txt`

### Step 3 — Move the app (optional but recommended)

Drag **`Sparx Solver Pro.app`** into **Applications**.

### Step 4 — First launch (avoid “damaged” / blocked app)

macOS blocks apps that are not from the App Store. This is normal — the app is **not** actually damaged.

**Use this method (easiest):**

1. In the unzipped folder, **double-click `Open Sparx Solver Pro.command`**.
2. If macOS asks to allow the script: **Open** → confirm.

**Or use right-click:**

1. **Right-click** `Sparx Solver Pro.app` → **Open**.
2. Click **Open** in the dialog (not just double-click the first time).

**If you still see “damaged” or “can’t be opened”:**

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Paste (change the path if you put the app elsewhere):

```bash
xattr -cr ~/Downloads/Sparx\ Solver\ Pro.app
xattr -dr com.apple.quarantine ~/Downloads/Sparx\ Solver\ Pro.app 2>/dev/null
open ~/Downloads/Sparx\ Solver\ Pro.app
```

If the app is in Applications:

```bash
xattr -cr /Applications/Sparx\ Solver\ Pro.app
xattr -dr com.apple.quarantine /Applications/Sparx\ Solver\ Pro.app 2>/dev/null
open /Applications/Sparx\ Solver\ Pro.app
```

### Step 5 — macOS permissions (required)

The app must **see the question** and **type the answer**.

1. Open **System Settings** → **Privacy & Security**.
2. **Screen Recording** — enable **Sparx Solver Pro** (or Terminal if you run from source).
3. **Accessibility** — enable **Sparx Solver Pro** the same way.
4. Quit and reopen the app if it was already running.

Without these, capture or typing will fail silently or with errors.

---

## How to use

1. Open **Sparx Solver Pro**.
2. Go to the **Solver** tab.
3. Click **Select Region** and drag a box around the **question text only** (not the whole page).
4. Set **Rounds** (25 is a good default).
5. Open Sparx in your browser and focus the answer box.
6. Click **▶ Start** (or press **Ctrl+Enter**).
7. **Pause:** Space · **Stop:** Esc · **Emergency stop:** move mouse to the **top-left corner** of the screen.

The app shows what OCR detected and the answer it will type. Check **History** for past sessions.

---

## Build from source (developers)

Use this if you want to change the code or create your own `.app` / `.zip`.

### 1 — Install tools (one time)

```bash
# Homebrew: https://brew.sh
brew install python@3.12 python-tk@3.12
```

`python-tk` is required for the window UI. It is **not** installed via pip.

### 2 — Clone and build

```bash
git clone https://github.com/Thecosmiccat/sparx-times-table-solver.git
cd sparx-times-table-solver
./scripts/build_mac_app.sh
```

First build downloads Python packages and OCR models (~5–15 minutes). Output:

- `dist/Sparx Solver Pro.app`
- `dist/Sparx Solver Pro.zip` — share this with others

### 3 — Run without building

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

## Troubleshooting

### “Sparx Solver Pro is damaged and can’t be opened”

The app is not corrupted. macOS is blocking an unsigned download.

- Double-click **`Open Sparx Solver Pro.command`** in the zip folder, **or**
- Right-click the app → **Open**, **or**
- Run the `xattr -cr` commands in [Step 4](#step-4--first-launch-avoid-damaged--blocked-app).

### App opens then closes immediately

- Re-download the zip from **Releases** and use **`Open Sparx Solver Pro.command`**.
- Rebuild from source if you built it yourself: `./scripts/build_mac_app.sh`

### Wrong answers (e.g. `1212` instead of `12 × 12`)

Recent versions split glued digits (`1212` → `12×12`). Update to the latest release or pull the latest `main` and rebuild.

### It does not type

- Sparx answer field must be focused.
- **Accessibility** must be on for Sparx Solver Pro in System Settings.

### OCR / SSL errors on first run (source only)

```bash
pip install --upgrade pip certifi
```

On some Mac Python installs, also run Apple’s certificate installer for your Python version.

### Failsafe triggered

The mouse hit **(0, 0)** — top-left corner. Move the mouse away and start again.

---

## Project layout

```
core/          OCR, solver, screen capture, automation
ui/            CustomTkinter app
utils/         Config and session history
scripts/       build_mac_app.sh, sign_app.sh
release/       First-run helper files (copied into dist/ on build)
```

---

## Legal / use

For personal/educational use. Automating school platforms may violate their terms of service — use at your own risk.

---

## License

See repository license. No warranty.
