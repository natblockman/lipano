# -*- mode: python ; coding: utf-8 -*-

app = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=[],
    datas=[
        ("index.html", "."),
        ("styles.css", "."),
        ("app.js", "."),
        ("assets/icon.svg", "assets"),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(app.pure)

exe = EXE(
    pyz,
    app.scripts,
    app.binaries,
    app.datas,
    [],
    name="lipano",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="assets/icon.ico",
)
