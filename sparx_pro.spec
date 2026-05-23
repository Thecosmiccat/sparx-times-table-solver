# PyInstaller spec — builds Sparx Solver Pro.app for macOS
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None
root = Path(SPECPATH)

tk_datas, tk_binaries, tk_hidden = collect_all("tkinter")
datas = list(tk_datas) + collect_data_files("customtkinter")
binaries = list(tk_binaries)
model_src = root / "resources" / "models" / "easyocr"
if model_src.is_dir():
    datas.append((str(model_src), "models/easyocr"))

hiddenimports = [
    "PIL._tkinter_finder",
    "_tkinter",
    "sympy",
    "cv2",
    "numpy",
    "torch",
    "torchvision",
    "easyocr",
    "scipy",
    "skimage",
    *tk_hidden,
    *collect_submodules("easyocr"),
]

a = Analysis(
    [str(root / "main.py")],
    pathex=[str(root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Sparx Solver Pro",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="Sparx Solver Pro",
)

app = BUNDLE(
    coll,
    name="Sparx Solver Pro.app",
    icon=None,
    bundle_identifier="com.sparx.solverpro",
    info_plist={
        "CFBundleName": "Sparx Solver Pro",
        "CFBundleDisplayName": "Sparx Solver Pro",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
        "NSAppleEventsUsageDescription": (
            "Sparx Solver Pro needs Automation access to type answers into Sparx Maths."
        ),
    },
)
