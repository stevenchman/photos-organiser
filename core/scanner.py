"""
Walk a source directory and build FileRecord objects for every supported file.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable

from config import SUPPORTED_EXTENSIONS
from core.metadata import extract_date


@dataclass
class FileRecord:
    source_path: Path
    filename: str
    size_bytes: int
    date_taken: date | None
    date_source: str          # "exif" | "video_metadata" | "file_mtime"
    file_type: str            # e.g. "jpeg", "raw_raf", "mp4" …
    thumbnail_token: str      # SHA1 hex of source_path, used in thumbnail URL


def scan(
    source: Path,
    dest: Path | None = None,
    on_progress: Callable[[int], None] | None = None,
) -> tuple[list[FileRecord], list[FileRecord]]:
    """
    Walk *source* recursively.

    Returns:
        (dated_files, undated_files)
        undated_files have date_taken == None (shouldn't happen with fallback,
        but guard just in case).

    on_progress(n): called after every n-th file is processed.
    """
    dated: list[FileRecord] = []
    undated: list[FileRecord] = []
    processed = 0

    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue

        suffix = path.suffix.lower()
        file_type = SUPPORTED_EXTENSIONS.get(suffix)
        if file_type is None:
            continue

        # Skip files that are already inside the destination tree
        if dest is not None:
            try:
                path.relative_to(dest)
                continue
            except ValueError:
                pass

        date_taken, date_source = extract_date(path)
        token = hashlib.sha1(str(path).encode()).hexdigest()

        record = FileRecord(
            source_path=path,
            filename=path.name,
            size_bytes=path.stat().st_size,
            date_taken=date_taken,
            date_source=date_source,
            file_type=file_type,
            thumbnail_token=token,
        )

        if date_taken is not None:
            dated.append(record)
        else:
            undated.append(record)

        processed += 1
        if on_progress and processed % 10 == 0:
            on_progress(processed)

    return dated, undated
