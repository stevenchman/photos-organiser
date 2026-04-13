"""
Build the target folder path for a given date and optional description.

Supported date_format values:
    "yymmdd"    →  "260214"       (default, compact)
    "yyyymmdd"  →  "20260214"     (full year compact)
    "yy-mm-dd"  →  "26-02-14"     (compact with dashes)
    "yyyy-mm-dd" → "2026-02-14"   (ISO with dashes)
"""

from datetime import date
from pathlib import Path

DATE_FORMATS = {
    "yymmdd":    lambda d: d.strftime("%y%m%d"),
    "yyyymmdd":  lambda d: d.strftime("%Y%m%d"),
    "yy-mm-dd":  lambda d: d.strftime("%y-%m-%d"),
    "yyyy-mm-dd": lambda d: d.strftime("%Y-%m-%d"),
}

DEFAULT_DATE_FORMAT = "yymmdd"


def build_bare_name(d: date, date_format: str = DEFAULT_DATE_FORMAT) -> str:
    """Return the date portion of the folder name, e.g. '260214'."""
    fmt = DATE_FORMATS.get(date_format, DATE_FORMATS[DEFAULT_DATE_FORMAT])
    return fmt(d)


def build_folder_path(
    dest_root: Path,
    d: date,
    description: str,
    date_format: str = DEFAULT_DATE_FORMAT,
    end_date: date | None = None,
) -> Path:
    """
    Return the full target folder path.

    For combined groups spanning multiple days, pass end_date to get a range:
        260402-260410 Snowdon trip

    Example:
        dest_root = Path("E:/Library")
        d = date(2026, 2, 14)
        description = "Snowdon hike"

    Returns:
        Path("E:/Library/-2026/260214 Snowdon hike")
    """
    year_folder = f"-{d.year}"
    day_folder = build_bare_name(d, date_format)

    if end_date and end_date != d:
        day_folder = f"{day_folder}-{build_bare_name(end_date, date_format)}"

    if description.strip():
        day_folder = f"{day_folder} {description.strip()}"

    return dest_root / year_folder / day_folder
