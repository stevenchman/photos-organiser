# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Flex backend (Flask app)."""

from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs

block_cipher = None

# rawpy has native DLLs that must be bundled
rawpy_datas, rawpy_binaries, rawpy_hiddenimports = collect_all('rawpy')
numpy_datas, numpy_binaries, numpy_hiddenimports = collect_all('numpy')

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=rawpy_binaries + numpy_binaries,
    datas=[
        ('ui', 'ui'),
        ('api', 'api'),
        ('core', 'core'),
        ('config.py', '.'),
    ] + rawpy_datas + numpy_datas,
    hiddenimports=[
        'flask_session',
        'exifread',
        'rawpy',
        'rawpy._rawpy',
        'numpy',
        'anthropic',
        'dotenv',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageFilter',
        'cachelib',
        'cachelib.file',
    ] + rawpy_hiddenimports + numpy_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', '_tkinter', 'tk', 'tcl',
        'unittest', 'pydoc', 'doctest',
        'xmlrpc', 'ftplib', 'imaplib', 'smtplib', 'poplib',
        'curses', 'readline',
        'multiprocessing',
        'concurrent.futures',
    ],
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
    name='flex-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    console=False,
    icon='assets/icon.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='flex-backend',
)
