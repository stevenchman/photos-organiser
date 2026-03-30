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

SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(24).hex())
