"""
Watch a folder for new supported files and auto-organise them.
Uses polling (cross-platform, no dependencies beyond stdlib).
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from datetime import date
from pathlib import Path

from config import SUPPORTED_EXTENSIONS
from core.metadata import extract_date
from core.mover import execute_plan
from core.namer import build_folder_path

log = logging.getLogger(__name__)

_watcher_lock = threading.Lock()
_watcher: _Watcher | None = None


class _Watcher:
    def __init__(
        self,
        watch_path: Path,
        dest_path: Path,
        operation: str,
        date_format: str,
        interval: int = 3,
        recursive: bool = False,
        month_folders: bool = False,
    ):
        self.watch_path = watch_path
        self.dest_path = dest_path
        self.operation = operation
        self.date_format = date_format
        self.interval = interval
        self.recursive = recursive
        self.month_folders = month_folders

        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._seen: set[str] = set()    # tracks file hashes we've already processed
        self._log: list[dict] = []      # recent activity log
        self._files_processed = 0

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self):
        if self.running:
            return
        self._stop_event.clear()
        # Snapshot existing files so we don't reprocess pre-existing ones on restart
        existing = self._snapshot_keys()
        self._seen = existing
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        sub = " (including subfolders)" if self.recursive else ""
        self._add_log("ok", f"Started — watching{sub}. {len(existing)} existing file(s) skipped. Drop new files to organise them.")
        log.info("Watcher started: %s → %s", self.watch_path, self.dest_path)

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=10)
        self._thread = None
        log.info("Watcher stopped")

    def status(self) -> dict:
        return {
            "running": self.running,
            "watch_path": str(self.watch_path),
            "dest_path": str(self.dest_path),
            "operation": self.operation,
            "date_format": self.date_format,
            "recursive": self.recursive,
            "files_processed": self._files_processed,
            "log": self._log[-50:],  # last 50 entries
        }

    def _snapshot_keys(self) -> set[str]:
        keys = set()
        pattern = "**/*" if self.recursive else "*"
        for path in self.watch_path.glob(pattern):
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
                keys.add(self._file_key(path))
        return keys

    def _file_key(self, path: Path) -> str:
        """Stable key: name + size + mtime."""
        try:
            st = path.stat()
            return f"{path.name}|{st.st_size}|{st.st_mtime_ns}"
        except OSError:
            return path.name

    def _run(self):
        while not self._stop_event.is_set():
            try:
                self._poll()
            except Exception as e:
                log.exception("Watcher poll error: %s", e)
                self._add_log("error", str(e))
            self._stop_event.wait(self.interval)

    def _poll(self):
        # First pass: collect candidate new files
        candidates: list[tuple[Path, str, str]] = []
        pattern = "**/*" if self.recursive else "*"
        for path in self.watch_path.glob(pattern):
            if not path.is_file():
                continue
            ft = SUPPORTED_EXTENSIONS.get(path.suffix.lower())
            if ft is None:
                continue
            key = self._file_key(path)
            if key not in self._seen:
                candidates.append((path, ft, key))

        if not candidates:
            return

        # Wait once then re-check all candidates for stability (file fully written)
        time.sleep(1)

        new_files: list[tuple[Path, str]] = []
        for path, ft, key in candidates:
            try:
                new_key = self._file_key(path)
            except OSError:
                continue
            if new_key != key:
                # Still being written — will be picked up next poll
                continue
            self._seen.add(new_key)
            new_files.append((path, ft))

        if not new_files:
            return

        # Build file moves
        file_moves: list[tuple[Path, Path]] = []
        for path, ft in new_files:
            date_taken, date_source = extract_date(path)
            if date_taken is None:
                date_taken = date.today()
                date_source = "watcher_default"
            dest_dir = build_folder_path(self.dest_path, date_taken, "", self.date_format, month_folders=self.month_folders)
            file_moves.append((path, dest_dir))

        # Log what we're about to process
        for path, _ in new_files:
            self._add_log("ok", f"Detected: {path.name}")

        # Execute
        results = execute_plan(file_moves, self.operation)
        for r in results:
            self._files_processed += 1
            if r.success:
                op = "→" if self.operation == "move" else "copied →"
                self._add_log("ok", f"{r.source.name} {op} {r.destination.parent.name}")
            else:
                self._add_log("error", f"{r.source.name}: {r.error}")

    def _add_log(self, level: str, message: str):
        import datetime as _dt
        self._log.append({
            "time": _dt.datetime.now().isoformat(timespec="seconds"),
            "level": level,
            "message": message,
        })
        # Cap log size
        if len(self._log) > 200:
            self._log = self._log[-100:]


# ── Module-level API ─────────────────────────────────────────────────────────

def start_watcher(
    watch_path: str | Path,
    dest_path: str | Path,
    operation: str = "copy",
    date_format: str = "yymmdd",
    interval: int = 3,
    recursive: bool = False,
    month_folders: bool = False,
) -> dict:
    global _watcher
    with _watcher_lock:
        if _watcher and _watcher.running:
            _watcher.stop()
        _watcher = _Watcher(
            watch_path=Path(watch_path),
            dest_path=Path(dest_path),
            operation=operation,
            date_format=date_format,
            interval=interval,
            recursive=recursive,
            month_folders=month_folders,
        )
        _watcher.start()
        return _watcher.status()


def stop_watcher() -> dict:
    global _watcher
    with _watcher_lock:
        if _watcher and _watcher.running:
            _watcher.stop()
            return _watcher.status()
        return {"running": False}


def watcher_status() -> dict:
    with _watcher_lock:
        if _watcher:
            return _watcher.status()
        return {"running": False, "files_processed": 0, "log": []}
