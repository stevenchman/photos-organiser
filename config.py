import os
from pathlib import Path

PORT = int(os.environ.get("PORT", 5173))
HOST = "127.0.0.1"

SUPPORTED_EXTENSIONS = {
    ".jpg":  "jpeg",
    ".jpeg": "jpeg",
    ".raf":  "raw_raf",
    ".dng":  "dng",
    ".mp4":  "mp4",
    ".insv": "insv",
    ".insp": "insp",
    ".360":  "360",
}

VIDEO_EXTENSIONS = {".mp4", ".insv", ".insp", ".360"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".raf", ".dng"}

THUMBNAIL_MAX_SIZE = (400, 400)
AI_SAMPLE_MAX_SIZE = (1024, 1024)

# Persist secret key across restarts so Flask session cookies survive app restarts.
# In PyInstaller frozen mode use the exe's directory; in dev use this file's directory.
import sys as _sys
_BASE_DIR = Path(_sys.executable).parent if getattr(_sys, "frozen", False) else Path(__file__).parent
_KEY_FILE = _BASE_DIR / ".secret_key"
if os.environ.get("SECRET_KEY"):
    SECRET_KEY = os.environ["SECRET_KEY"]
elif _KEY_FILE.exists():
    SECRET_KEY = _KEY_FILE.read_text().strip()
else:
    SECRET_KEY = os.urandom(24).hex()
    try:
        _KEY_FILE.write_text(SECRET_KEY)
    except OSError:
        pass  # read-only filesystem; session won't persist across restarts
