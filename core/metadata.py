"""
EXIF and video metadata extraction.
Returns a (date, source_label) tuple for any supported file type.
"""

import json
import os
import shutil
import subprocess
from datetime import date, datetime
from pathlib import Path

import exifread
from PIL import Image

from config import VIDEO_EXTENSIONS


def extract_date(file_path: Path) -> tuple[date | None, str]:
    """
    Extract the date a file was captured.

    Returns:
        (date_taken, source_label) where source_label is one of:
        'exif', 'video_metadata', 'file_mtime'
    """
    suffix = file_path.suffix.lower()

    if suffix in VIDEO_EXTENSIONS:
        result = _from_video_metadata(file_path)
        if result:
            return result, "video_metadata"
    else:
        result = _from_exif(file_path)
        if result:
            return result, "exif"

    # Final fallback: file modification time
    mtime = os.path.getmtime(file_path)
    return datetime.fromtimestamp(mtime).date(), "file_mtime"


def _from_exif(file_path: Path) -> date | None:
    """Try EXIF DateTimeOriginal then DateTime."""
    try:
        with open(file_path, "rb") as f:
            tags = exifread.process_file(f, stop_tag="EXIF DateTimeOriginal", details=False)

        for tag in ("EXIF DateTimeOriginal", "Image DateTime"):
            if tag in tags:
                return _parse_exif_datetime(str(tags[tag]))

        # Re-read without stop_tag to check Image DateTime
        with open(file_path, "rb") as f:
            tags = exifread.process_file(f, details=False)

        for tag in ("EXIF DateTimeOriginal", "EXIF DateTimeDigitized", "Image DateTime"):
            if tag in tags:
                return _parse_exif_datetime(str(tags[tag]))

    except Exception:
        pass
    return None


def _parse_exif_datetime(value: str) -> date | None:
    """Parse EXIF datetime string '2026:02:14 10:30:00' into a date."""
    try:
        return datetime.strptime(value.strip(), "%Y:%m:%d %H:%M:%S").date()
    except ValueError:
        pass
    try:
        return datetime.strptime(value.strip()[:10], "%Y:%m:%d").date()
    except ValueError:
        return None


def _from_video_metadata(file_path: Path) -> date | None:
    """Use ffprobe to extract creation_time from video container metadata."""
    if not shutil.which("ffprobe"):
        return None

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        data = json.loads(result.stdout)
        creation_time = (
            data.get("format", {})
                .get("tags", {})
                .get("creation_time", "")
        )
        if creation_time:
            return _parse_iso_datetime(creation_time)
    except Exception:
        pass
    return None


def _parse_iso_datetime(value: str) -> date | None:
    """Parse ISO 8601 datetime string from ffprobe."""
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).date()
    except ValueError:
        return None


def ffprobe_available() -> bool:
    return shutil.which("ffprobe") is not None


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


RAW_EXTENSIONS = {".raf", ".dng", ".cr2", ".cr3", ".nef", ".arw", ".rw2", ".orf"}
VIDEO_THUMB_EXTENSIONS = {".mp4", ".insv", ".insp", ".360", ".mov", ".avi"}


def extract_thumbnail(file_path: Path, max_size: tuple[int, int]) -> bytes | None:
    """
    Return JPEG bytes of a resized thumbnail for display in the UI.
    Supports JPEG/PNG via Pillow, RAW files via rawpy, and video files via ffmpeg.
    """
    import io

    suffix = file_path.suffix.lower()

    if suffix in RAW_EXTENSIONS:
        return _thumbnail_from_raw(file_path, max_size)

    if suffix in VIDEO_THUMB_EXTENSIONS:
        return _thumbnail_from_video(file_path, max_size)

    # Standard image (JPEG, PNG, etc.)
    try:
        from PIL import ImageOps
        img = Image.open(file_path)
        img.load()                           # force EXIF data into memory before transpose
        img = ImageOps.exif_transpose(img)   # auto-rotate by EXIF orientation tag
        img.thumbnail(max_size, Image.LANCZOS)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75)
        return buf.getvalue()
    except Exception:
        return None


def _thumbnail_from_raw(file_path: Path, max_size: tuple[int, int]) -> bytes | None:
    """Extract a thumbnail from a RAW file (RAF, DNG, etc.) using rawpy."""
    import io

    # First try: use the embedded JPEG thumbnail (fast, no RAW decode needed)
    try:
        import rawpy
        with rawpy.imread(str(file_path)) as raw:
            thumb = raw.extract_thumb()
        if thumb.format == rawpy.ThumbFormat.JPEG:
            from PIL import ImageOps
            img = Image.open(io.BytesIO(bytes(thumb.data)))
            img.load()
            img = ImageOps.exif_transpose(img)
            img.thumbnail(max_size, Image.LANCZOS)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=75)
            return buf.getvalue()
        elif thumb.format == rawpy.ThumbFormat.BITMAP:
            img = Image.fromarray(thumb.data)
            img.thumbnail(max_size, Image.LANCZOS)
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=75)
            return buf.getvalue()
    except Exception:
        pass

    # Fallback: full RAW decode (slower)
    try:
        import rawpy
        import numpy as np
        with rawpy.imread(str(file_path)) as raw:
            rgb = raw.postprocess(
                use_camera_wb=True,
                half_size=True,
                no_auto_bright=False,
                output_bps=8,
            )
        img = Image.fromarray(rgb)
        img.thumbnail(max_size, Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75)
        return buf.getvalue()
    except Exception:
        return None


def _thumbnail_from_video(file_path: Path, max_size: tuple[int, int]) -> bytes | None:
    """Extract a frame from a video file using ffmpeg."""
    import io

    if not shutil.which("ffmpeg"):
        return None

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-ss", "00:00:01",
                "-i", str(file_path),
                "-vframes", "1",
                "-vf", f"scale={max_size[0]}:{max_size[1]}:force_original_aspect_ratio=decrease",
                "-f", "image2",
                "-vcodec", "mjpeg",
                "pipe:1",
            ],
            capture_output=True,
            timeout=15,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout
    except Exception:
        pass
    return None
