"""
Blur detection via Laplacian variance.
Lower score = blurrier. Uses only Pillow + numpy (no extra dependencies).
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# Laplacian kernel — measures rate of intensity change (edges).
# High variance = sharp; low variance = blurry.
_LAPLACIAN = ImageFilter.Kernel(
    size=(3, 3),
    kernel=[-1, -1, -1, -1, 8, -1, -1, -1, -1],
    scale=1,
    offset=128,
)

# Files below this score are considered blurry.
BLUR_THRESHOLD = 80.0


def compute_blur_score(path: Path, file_type: str) -> float | None:
    """
    Return Laplacian variance score for an image file.
    Returns None for videos or files that can't be read.
    """
    try:
        img = _open_image(path, file_type)
        if img is None:
            return None
        with img:
            grey = img.convert("L")
            # Resize to a fixed size so scores are comparable across resolutions.
            grey.thumbnail((500, 500), Image.LANCZOS)
            lap = grey.filter(_LAPLACIAN)
            arr = np.array(lap, dtype=np.float32) - 128.0  # remove offset
            return float(arr.var())
    except Exception:
        return None


def _open_image(path: Path, file_type: str) -> Image.Image | None:
    """Open an image for blur analysis. Handles JPEG and RAW via embedded thumbnail."""
    if file_type == "jpeg":
        return Image.open(path)

    if file_type in ("raw_raf", "dng"):
        try:
            import rawpy
            with rawpy.imread(str(path)) as raw:
                thumb = raw.extract_thumb()
                import rawpy as _rp
                if thumb.format == _rp.ThumbFormat.JPEG:
                    return Image.open(BytesIO(bytes(thumb.data)))
        except Exception:
            pass
        return None

    return None  # videos and unsupported types
