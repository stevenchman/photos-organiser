"""
Group FileRecords by date into DayGroup objects.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from config import IMAGE_EXTENSIONS
from core.scanner import FileRecord


@dataclass
class DayGroup:
    group_id: str
    date: date
    files: list[FileRecord]
    proposed_folder_name: str   # bare "YY-MM-DD", no description yet
    description: str = ""       # user-editable suffix
    ai_suggested_name: str | None = None
    sample_image_path: Path | None = None
    status: str = "pending"     # pending | confirmed | executing | done | error
    skip: bool = False


def group_by_date(dated_files: list[FileRecord]) -> list[DayGroup]:
    """
    Sort files by date and group into DayGroup objects, one per calendar day.
    Groups are returned in chronological order.
    """
    by_date: dict[date, list[FileRecord]] = {}
    for record in dated_files:
        by_date.setdefault(record.date_taken, []).append(record)

    groups: list[DayGroup] = []
    for day in sorted(by_date):
        files = by_date[day]
        sample = _pick_sample(files)
        groups.append(
            DayGroup(
                group_id=str(uuid.uuid4()),
                date=day,
                files=files,
                proposed_folder_name=day.strftime("%y-%m-%d"),
                sample_image_path=sample.source_path if sample else None,
            )
        )
    return groups


def _pick_sample(files: list[FileRecord]) -> FileRecord | None:
    """Prefer JPEG for thumbnails and AI analysis; fall back to any image; then any file."""
    for record in files:
        if record.file_type == "jpeg":
            return record
    for record in files:
        if record.source_path.suffix.lower() in IMAGE_EXTENSIONS:
            return record
    return files[0] if files else None
