"""
Build the target folder path for a given date and optional description.
"""

from datetime import date
from pathlib import Path


def build_bare_name(d: date) -> str:
    """Return e.g. '260214' from date(2026, 2, 14)."""
    return d.strftime("%y%m%d")


def build_folder_path(dest_root: Path, d: date, description: str) -> Path:
    """
    Return the full target folder path.

    Example:
        dest_root = Path("E:/Library")
        d = date(2026, 2, 14)
        description = "Snowdon hike"

    Returns:
        Path("E:/Library/2026/2602/260214 Snowdon hike")
    """
    year_folder = f"-{d.year}"       # "-2026"
    day_folder = build_bare_name(d)  # "260214"

    if description.strip():
        day_folder = f"{day_folder} {description.strip()}"

    return dest_root / year_folder / day_folder
