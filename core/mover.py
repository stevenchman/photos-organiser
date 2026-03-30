"""
Execute the confirmed file organisation plan.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


@dataclass
class MoveResult:
    source: Path
    destination: Path
    success: bool
    error: str | None = None


def execute_plan(
    file_moves: list[tuple[Path, Path]],
    operation: str,                           # "move" | "copy"
    on_progress: Callable[[int, int, str], None] | None = None,
) -> list[MoveResult]:
    """
    Move or copy each (source, dest_dir) pair.

    file_moves: list of (source_path, target_directory)
    on_progress(completed, total, current_filename): called after each file.
    """
    results: list[MoveResult] = []
    total = len(file_moves)

    for idx, (src, dest_dir) in enumerate(file_moves, start=1):
        if on_progress:
            on_progress(idx - 1, total, src.name)

        try:
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_path = _unique_dest(dest_dir, src.name)

            if operation == "move":
                shutil.move(str(src), dest_path)
            else:
                shutil.copy2(str(src), dest_path)

            results.append(MoveResult(source=src, destination=dest_path, success=True))
        except Exception as exc:
            results.append(
                MoveResult(source=src, destination=dest_dir / src.name, success=False, error=str(exc))
            )

    if on_progress:
        on_progress(total, total, "")

    return results


def _unique_dest(dest_dir: Path, filename: str) -> Path:
    """
    Return a path in dest_dir that doesn't already exist.
    If dest_dir/filename exists, try dest_dir/stem_1.ext, stem_2.ext …
    """
    candidate = dest_dir / filename
    if not candidate.exists():
        return candidate

    stem = Path(filename).stem
    suffix = Path(filename).suffix
    counter = 1
    while True:
        candidate = dest_dir / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def preflight_check(
    file_moves: list[tuple[Path, Path]],
) -> list[tuple[Path, Path]]:
    """
    Return list of (source, dest_dir) pairs where a file with the same name
    already exists in dest_dir (before our duplicate-suffix logic).
    Used to surface warnings in the UI.
    """
    conflicts: list[tuple[Path, Path]] = []
    for src, dest_dir in file_moves:
        if (dest_dir / src.name).exists():
            conflicts.append((src, dest_dir))
    return conflicts
