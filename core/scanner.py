"""
Walk a source directory and build FileRecord objects for every supported file.
Uses a thread pool for parallel metadata extraction.
"""

from __future__ import annotations

import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable

from config import SUPPORTED_EXTENSIONS, VIDEO_EXTENSIONS
from core.metadata import extract_date
from core.blur import compute_blur_score, compute_exposure_issue

_IMAGE_TYPES = {"jpeg", "raw_raf", "dng"}


@dataclass
class FileRecord:
    source_path: Path
    filename: str
    size_bytes: int
    date_taken: date | None
    date_source: str          # "exif" | "video_metadata" | "file_mtime"
    file_type: str            # e.g. "jpeg", "raw_raf", "mp4" …
    thumbnail_token: str      # SHA1 hex of source_path, used in thumbnail URL
    blur_score: float | None = None       # Laplacian variance; None = video or unscored
    exposure_issue: str | None = None     # "overexposed" | "underexposed" | None


def _collect_paths(source: Path, dest: Path | None, max_depth: int | None) -> list[tuple[Path, str]]:
    """Walk source and return (path, file_type) for every supported file."""
    results = []

    def _walk(directory: Path, depth: int):
        try:
            for child in directory.iterdir():
                if child.is_dir():
                    if max_depth is None or depth < max_depth:
                        _walk(child, depth + 1)
                elif child.is_file():
                    suffix = child.suffix.lower()
                    file_type = SUPPORTED_EXTENSIONS.get(suffix)
                    if file_type is None:
                        continue
                    if dest is not None:
                        try:
                            child.relative_to(dest)
                            continue  # skip files already inside dest
                        except ValueError:
                            pass
                    results.append((child, file_type))
        except PermissionError:
            pass

    _walk(source, 1)
    return sorted(results)


def _build_record(path: Path, file_type: str) -> FileRecord:
    date_taken, date_source = extract_date(path)
    token = hashlib.sha1(str(path).encode()).hexdigest()
    blur_score     = compute_blur_score(path, file_type)     if file_type in _IMAGE_TYPES else None
    exposure_issue = compute_exposure_issue(path, file_type) if file_type in _IMAGE_TYPES else None
    return FileRecord(
        source_path=path,
        filename=path.name,
        size_bytes=path.stat().st_size,
        date_taken=date_taken,
        date_source=date_source,
        file_type=file_type,
        thumbnail_token=token,
        blur_score=blur_score,
        exposure_issue=exposure_issue,
    )


def scan(
    source: Path,
    dest: Path | None = None,
    on_progress: Callable[[int], None] | None = None,
    max_depth: int | None = None,
    max_workers: int = 8,
) -> tuple[list[FileRecord], list[FileRecord]]:
    """
    Walk *source* and build FileRecord objects in parallel.

    Args:
        source:      Source directory to scan.
        dest:        Destination directory — files inside it are skipped.
        on_progress: Called with running count as files are processed.
        max_depth:   Max recursion depth (None = unlimited, 1 = top-level only).
        max_workers: Thread pool size for metadata extraction.

    Returns:
        (dated_files, undated_files)
    """
    paths = _collect_paths(source, dest, max_depth)
    dated: list[FileRecord] = []
    undated: list[FileRecord] = []
    processed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_path = {pool.submit(_build_record, p, ft): p for p, ft in paths}
        for future in as_completed(future_to_path):
            try:
                record = future.result()
            except Exception:
                continue
            if record.date_taken is not None:
                dated.append(record)
            else:
                undated.append(record)
            processed += 1
            if on_progress and processed % 10 == 0:
                on_progress(processed)

    # Sort by path for stable ordering
    dated.sort(key=lambda r: str(r.source_path))
    undated.sort(key=lambda r: str(r.source_path))
    return dated, undated
