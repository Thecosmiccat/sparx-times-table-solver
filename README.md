# Sparx Question Solver Bot

A program made purely in python to do you sparx times table for you.

## What It Does

- Lets you select the question area using a small control window.
- Reads the question using ai
- Solves the question
- Types the answer and presses Enter.
- If it reachs a "next" screen it presses Enter.
- Runs for the number of rounds you choose (most efficent 25)
- Safe stop: move mouse to the top-left corner `(0,0)`.

## Requirements

- Have the 100 club in sparx
- Python 3.10+
- Packages:
  - `easyocr`
  - `numpy`
  - `pyautogui`
  - `pillow`
  - `sympy`

Install:

```bash
python3 -m pip install easyocr numpy pyautogui pillow sympy
```

## macOS Permissions (Required)

On macOS, give your terminal app:

- `Screen Recording`
- `Accessibility`

Path: `System Settings -> Privacy & Security`

Without these, screen capture and typing automation may fail.

If you can not find these, it will make a pop up once you try to run it to ak you to turn it on

## SSL Model Download Issue (EasyOCR First Run)

If you see `CERTIFICATE_VERIFY_FAILED`, run:

```bash
python3 -m pip install --upgrade pip certifi
open "/Applications/Python 3.14/Install Certificates.command"
```

Then run the bot again.

## Run

```bash
python3 sparxtimestablesolver.py
```

## How To Use

1. Click `Capture Top-Left`.
2. Move mouse to the top-left of the question box before countdown ends.
3. Click `Capture Bottom-Right`.
4. Move mouse to the bottom-right of the question box before countdown ends.
5. Confirm red border matches question area.
6. Enter `Rounds` (best `25`)
7. Click `Start`.
8. Quickly switch to your sparx window

## Stop

- Move mouse to top-left corner `(0,0)` to stop.

## Troubleshooting

### It does not type answers

- Make sure the answer input box is focused.
- Check Accessibility permission for your terminal.



