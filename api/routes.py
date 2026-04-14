"""
All Flask route handlers.
"""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
import uuid
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path

from flask import Blueprint, Response, jsonify, request, send_file, session

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger(__name__)

from config import THUMBNAIL_MAX_SIZE
from core.ai_vision import AIVisionError, suggest_group_name, validate_api_key
from core.grouper import DayGroup, group_by_date
from core.metadata import extract_thumbnail, ffprobe_available
from core.mover import MoveResult, execute_plan, preflight_check
from core.blur import BLUR_THRESHOLD
from core.namer import build_folder_path, DATE_FORMATS, DEFAULT_DATE_FORMAT
from core.scanner import FileRecord, scan
from core.watcher import start_watcher, stop_watcher, watcher_status

bp = Blueprint("api", __name__, url_prefix="/api")

# ── In-memory store (single-user local tool) ─────────────────────────────────
_scans: dict[str, dict] = {}       # scan_id → {status, groups, undated, ...}
_executions: dict[str, dict] = {}  # exec_id → {progress}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _token(path: Path | None) -> str | None:
    if path is None:
        return None
    return hashlib.sha1(str(path).encode()).hexdigest()


def _find_file_by_token(s: dict, token: str) -> Path | None:
    for group in s["groups"]:
        for f in group.files:
            if f.thumbnail_token == token:
                return f.source_path
    for f in s.get("undated", []):
        if f.thumbnail_token == token:
            return f.source_path
    return None

def _group_to_dict(g: DayGroup) -> dict:
    files = []
    for f in g.files:
        files.append({
            "filename": f.filename,
            "size_bytes": f.size_bytes,
            "file_type": f.file_type,
            "date_source": f.date_source,
            "source_path": str(f.source_path),
            "thumbnail_token": f.thumbnail_token,
            "blur_score": f.blur_score,
            "is_blurry": f.blur_score is not None and f.blur_score < BLUR_THRESHOLD,
        })
    return {
        "group_id": g.group_id,
        "date": g.date.isoformat(),
        "file_count": len(g.files),
        "proposed_folder_name": g.proposed_folder_name,
        "description": g.description,
        "ai_suggested_name": g.ai_suggested_name,
        "has_sample_image": g.sample_image_path is not None,
        "sample_token": _token(g.sample_image_path),
        "sample_file_type": g.sample_image_path.suffix.lower().lstrip(".") if g.sample_image_path else None,
        "files": files,
        "skip": g.skip,
    }


def _record_to_dict(f: FileRecord) -> dict:
    return {
        "filename": f.filename,
        "size_bytes": f.size_bytes,
        "file_type": f.file_type,
        "date_source": f.date_source,
        "source_path": str(f.source_path),
        "thumbnail_token": f.thumbnail_token,
        "blur_score": f.blur_score,
        "is_blurry": f.blur_score is not None and f.blur_score < BLUR_THRESHOLD,
    }


# ── Settings ──────────────────────────────────────────────────────────────────

@bp.get("/settings")
def get_settings():
    return jsonify({
        "source_path": session.get("source_path", ""),
        "dest_path": session.get("dest_path", ""),
        "operation": session.get("operation", "copy"),
        "mode": session.get("mode", "exif"),
        "date_format": session.get("date_format", DEFAULT_DATE_FORMAT),
        "month_folders": session.get("month_folders", True),
        "scan_depth": session.get("scan_depth", 0),
        "has_api_key": bool(session.get("api_key") or os.environ.get("ANTHROPIC_API_KEY")),
        "ffprobe_available": ffprobe_available(),
        "date_formats": list(DATE_FORMATS.keys()),
    })


@bp.post("/settings")
def post_settings():
    data = request.get_json(force=True)
    session["source_path"] = data.get("source_path", "")
    session["dest_path"] = data.get("dest_path", "")
    session["operation"] = data.get("operation", "copy")
    session["mode"] = data.get("mode", "exif")
    if data.get("date_format") in DATE_FORMATS:
        session["date_format"] = data["date_format"]
    if "month_folders" in data:
        session["month_folders"] = bool(data["month_folders"])
    if "scan_depth" in data:
        session["scan_depth"] = int(data.get("scan_depth", 0))
    if data.get("api_key"):
        session["api_key"] = data["api_key"]
    return jsonify({"ok": True})


# ── Directory browser ─────────────────────────────────────────────────────────

@bp.get("/browse")
def browse():
    raw = request.args.get("path", "")
    if not raw:
        # Default: user home
        p = Path.home()
    else:
        p = Path(raw)

    if not p.exists() or not p.is_dir():
        # Try parent
        p = p.parent if p.parent.exists() else Path.home()

    try:
        entries = []
        # Add ".." entry unless at filesystem root
        if p.parent != p:
            entries.append({"name": "..", "path": str(p.parent), "is_dir": True})

        for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            if child.name.startswith("."):
                continue
            entries.append({
                "name": child.name,
                "path": str(child),
                "is_dir": child.is_dir(),
            })
        return jsonify({"current": str(p), "entries": entries})
    except PermissionError:
        return jsonify({"error": "Permission denied", "current": str(p), "entries": []})


# ── Scan ──────────────────────────────────────────────────────────────────────

@bp.post("/scan")
def start_scan():
    source_path = session.get("source_path", "")
    dest_path = session.get("dest_path", "")

    if not source_path:
        return jsonify({"error": "No source path configured."}), 400

    source = Path(source_path)
    dest = Path(dest_path) if dest_path else None

    if not source.exists() or not source.is_dir():
        return jsonify({"error": f"Source folder not found: {source_path}"}), 400

    # Guard: destination must not be inside source
    if dest is not None:
        try:
            dest.relative_to(source)
            return jsonify({"error": "Destination folder cannot be inside the source folder."}), 400
        except ValueError:
            pass

    scan_id = str(uuid.uuid4())
    _scans[scan_id] = {
        "status": "scanning",
        "files_found": 0,
        "groups": [],
        "undated": [],
        "source": source_path,
        "dest": dest_path,
        "error": None,
    }

    # Read session values before leaving request context
    depth = session.get("scan_depth", 0)
    max_depth = int(depth) if depth and int(depth) > 0 else None

    def run():
        try:
            def progress(n):
                _scans[scan_id]["files_found"] = n

            dated, undated = scan(source, dest, on_progress=progress, max_depth=max_depth)
            groups = group_by_date(dated)
            _scans[scan_id].update({
                "status": "complete",
                "files_found": len(dated) + len(undated),
                "groups": groups,
                "undated": undated,
            })
        except Exception as exc:
            _scans[scan_id].update({"status": "error", "error": str(exc)})

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"scan_id": scan_id})


@bp.get("/scan/<scan_id>")
def get_scan(scan_id: str):
    s = _scans.get(scan_id)
    if s is None:
        return jsonify({"error": "Unknown scan ID"}), 404

    response = {
        "scan_id": scan_id,
        "status": s["status"],
        "files_found": s["files_found"],
        "source": s["source"],
        "dest": s["dest"],
        "error": s["error"],
    }

    if s["status"] == "complete":
        response["groups"] = [_group_to_dict(g) for g in s["groups"]]
        response["undated_files"] = [_record_to_dict(f) for f in s["undated"]]
        response["group_count"] = len(s["groups"])
        # Collect blurry files from all groups
        blurry = []
        for g in s["groups"]:
            for f in g.files:
                if f.blur_score is not None and f.blur_score < BLUR_THRESHOLD:
                    d = _record_to_dict(f)
                    d["group_id"] = g.group_id
                    d["group_date"] = g.date.isoformat()
                    blurry.append(d)
        response["blurry_files"] = blurry

    return jsonify(response)


# ── Thumbnails ────────────────────────────────────────────────────────────────

@bp.get("/thumbnail/<scan_id>/<group_id>")
def get_thumbnail(scan_id: str, group_id: str):
    s = _scans.get(scan_id)
    if s is None or s["status"] != "complete":
        log.debug("THUMB group: scan %s not found or incomplete", scan_id)
        return "", 404

    group = next((g for g in s["groups"] if g.group_id == group_id), None)
    if group is None or group.sample_image_path is None:
        log.debug("THUMB group: group %s not found or no sample", group_id)
        return "", 404

    log.debug("THUMB group: extracting from %s", group.sample_image_path)
    data = extract_thumbnail(group.sample_image_path, THUMBNAIL_MAX_SIZE)
    if data is None:
        log.debug("THUMB group: extract_thumbnail returned None for %s", group.sample_image_path)
        return "", 404

    return Response(data, mimetype="image/jpeg",
                    headers={"Cache-Control": "private, max-age=3600"})


@bp.get("/thumbnail/<scan_id>/file/<token>")
def get_file_thumbnail(scan_id: str, token: str):
    s = _scans.get(scan_id)
    if s is None or s["status"] != "complete":
        return "", 404

    file_path = _find_file_by_token(s, token)
    if file_path is None:
        return "", 404

    data = extract_thumbnail(file_path, (120, 120))
    if data is None:
        return "", 404

    return Response(data, mimetype="image/jpeg",
                    headers={"Cache-Control": "private, max-age=3600"})


@bp.get("/preview/<scan_id>/<token>")
def get_preview(scan_id: str, token: str):
    """Large preview image for the lightbox (up to 1920px)."""
    s = _scans.get(scan_id)
    if s is None or s["status"] != "complete":
        return "", 404

    file_path = _find_file_by_token(s, token)
    if file_path is None:
        return "", 404

    data = extract_thumbnail(file_path, (1920, 1920))
    if data is None:
        return "", 404

    return Response(data, mimetype="image/jpeg",
                    headers={"Cache-Control": "max-age=3600"})


@bp.get("/video/<scan_id>/<token>")
def get_video(scan_id: str, token: str):
    """Stream the original video file for in-browser playback."""
    s = _scans.get(scan_id)
    if s is None or s["status"] != "complete":
        return "", 404

    file_path = _find_file_by_token(s, token)
    if file_path is None:
        return "", 404

    return send_file(str(file_path), conditional=True)


# ── AI naming ─────────────────────────────────────────────────────────────────

@bp.post("/validate-key")
def post_validate_key():
    data = request.get_json(force=True)
    key = data.get("api_key") or session.get("api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return jsonify({"valid": False, "error": "No API key provided."})
    valid = validate_api_key(key)
    return jsonify({"valid": valid})


@bp.post("/suggest-names")
def post_suggest_names():
    data = request.get_json(force=True)
    scan_id = data.get("scan_id")
    group_ids = data.get("group_ids")  # optional: only suggest for these groups

    s = _scans.get(scan_id)
    if s is None or s["status"] != "complete":
        return jsonify({"error": "Invalid or incomplete scan."}), 400

    api_key = (
        session.get("api_key")
        or os.environ.get("ANTHROPIC_API_KEY", "")
    )
    if not api_key:
        return jsonify({"error": "No API key available."}), 400

    results = []
    for group in s["groups"]:
        if group_ids and group.group_id not in group_ids:
            continue
        if group.sample_image_path is None:
            results.append({"group_id": group.group_id, "success": False, "error": "No sample image."})
            continue
        # Only send image types (not video)
        if group.sample_image_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".dng", ".raf"}:
            results.append({"group_id": group.group_id, "success": False, "error": "No JPEG sample available."})
            continue
        try:
            name = suggest_group_name(group.sample_image_path, group.date, api_key)
            group.ai_suggested_name = name
            results.append({"group_id": group.group_id, "success": True, "suggested_name": name})
        except AIVisionError as exc:
            results.append({"group_id": group.group_id, "success": False, "error": str(exc)})

    return jsonify({"results": results})


# ── Confirm plan ──────────────────────────────────────────────────────────────

@bp.post("/confirm")
def post_confirm():
    data = request.get_json(force=True)
    scan_id = data.get("scan_id")
    operation = data.get("operation", session.get("operation", "copy"))
    group_updates = data.get("groups", [])
    undated_assignments = data.get("undated_assignments", [])
    blur_skip_tokens = set(data.get("blur_skip_tokens", []))  # tokens to exclude

    s = _scans.get(scan_id)
    if s is None or s["status"] != "complete":
        return jsonify({"error": "Invalid or incomplete scan."}), 400

    dest_root = Path(s["dest"]) if s["dest"] else None
    if dest_root is None:
        return jsonify({"error": "No destination path configured."}), 400

    # Apply group updates
    group_by_id = {g.group_id: g for g in s["groups"]}
    for upd in group_updates:
        g = group_by_id.get(upd["group_id"])
        if g:
            g.description = upd.get("description", g.description)
            g.skip = upd.get("skip", g.skip)
            # end_date is set when groups are combined in the UI
            end_date_str = upd.get("end_date")
            g.end_date = date.fromisoformat(end_date_str) if end_date_str else None

    # Handle undated file assignments
    undated_by_name = {f.filename: f for f in s["undated"]}
    for assign in undated_assignments:
        record = undated_by_name.get(assign["filename"])
        if record is None:
            continue
        try:
            assigned_date = date.fromisoformat(assign["assigned_date"])
        except (ValueError, KeyError):
            continue
        record.date_taken = assigned_date
        record.date_source = "manual"
        # Add to existing group or create new one
        target_group = group_by_id.get(assign.get("group_id", ""))
        if target_group:
            target_group.files.append(record)
        else:
            # Create a new group for this date
            from core.grouper import DayGroup
            import uuid as _uuid
            new_group = DayGroup(
                group_id=str(_uuid.uuid4()),
                date=assigned_date,
                files=[record],
                proposed_folder_name=assigned_date.strftime("%y-%m-%d"),
            )
            s["groups"].append(new_group)
            group_by_id[new_group.group_id] = new_group

    date_format = session.get("date_format", DEFAULT_DATE_FORMAT)
    month_folders = session.get("month_folders", False)

    # Build file_moves list for pre-flight check
    file_moves: list[tuple[Path, Path]] = []
    for g in s["groups"]:
        if g.skip:
            continue
        end_date = getattr(g, "end_date", None)
        dest_dir = build_folder_path(dest_root, g.date, g.description, date_format, end_date, month_folders)
        for f in g.files:
            if f.thumbnail_token not in blur_skip_tokens:
                file_moves.append((f.source_path, dest_dir))

    conflicts = preflight_check(file_moves)
    conflict_list = [{"source": str(s), "dest_dir": str(d)} for s, d in conflicts]

    # Store confirmed plan in session
    session["confirmed_plan"] = {
        "scan_id": scan_id,
        "operation": operation,
        "file_moves": [(str(s), str(d)) for s, d in file_moves],
    }

    return jsonify({
        "ok": True,
        "total_files": len(file_moves),
        "conflicts": conflict_list,
    })


# ── Execute ───────────────────────────────────────────────────────────────────

@bp.post("/execute")
def post_execute():
    plan = session.get("confirmed_plan")
    if not plan:
        return jsonify({"error": "No confirmed plan. Call /api/confirm first."}), 400

    exec_id = str(uuid.uuid4())
    _executions[exec_id] = {"status": "running", "completed": 0, "total": 0, "current": "", "results": []}

    operation = plan["operation"]
    file_moves = [(Path(s), Path(d)) for s, d in plan["file_moves"]]

    def run():
        def progress(completed, total, current):
            _executions[exec_id].update({"completed": completed, "total": total, "current": current})

        results = execute_plan(file_moves, operation, on_progress=progress)
        _executions[exec_id].update({
            "status": "done",
            "results": [
                {
                    "source": str(r.source),
                    "destination": str(r.destination),
                    "success": r.success,
                    "error": r.error,
                }
                for r in results
            ],
        })
        # Clear confirmed plan
        session.pop("confirmed_plan", None)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"exec_id": exec_id})


@bp.get("/execute/status/<exec_id>")
def get_execute_status(exec_id: str):
    """Server-Sent Events stream for execution progress."""
    e = _executions.get(exec_id)
    if e is None:
        return jsonify({"error": "Unknown execution ID"}), 404

    def generate():
        import json as _json
        last_completed = -1
        while True:
            state = _executions.get(exec_id, {})
            completed = state.get("completed", 0)
            if completed != last_completed or state.get("status") == "done":
                last_completed = completed
                yield f"data: {_json.dumps(state)}\n\n"
                if state.get("status") == "done":
                    break
            time.sleep(0.3)

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Watcher ───────────────────────────────────────────────────────────────────

@bp.get("/watcher/status")
def get_watcher_status():
    return jsonify(watcher_status())


@bp.post("/watcher/start")
def post_watcher_start():
    data = request.get_json(force=True)
    watch_path = data.get("watch_path", "").strip()
    dest_path = data.get("dest_path", "").strip()
    operation = data.get("operation", "copy")
    date_format = data.get("date_format", session.get("date_format", DEFAULT_DATE_FORMAT))

    if not watch_path or not dest_path:
        return jsonify({"error": "watch_path and dest_path are required."}), 400
    if not Path(watch_path).is_dir():
        return jsonify({"error": f"Watch folder not found: {watch_path}"}), 400
    if not Path(dest_path).is_dir():
        # Attempt to create destination
        try:
            Path(dest_path).mkdir(parents=True, exist_ok=True)
        except Exception as e:
            return jsonify({"error": f"Cannot create destination: {e}"}), 400

    recursive = bool(data.get("recursive", False))
    month_folders = bool(data.get("month_folders", session.get("month_folders", True)))
    status = start_watcher(watch_path, dest_path, operation, date_format, recursive=recursive, month_folders=month_folders)
    return jsonify(status)


@bp.post("/watcher/stop")
def post_watcher_stop():
    status = stop_watcher()
    return jsonify(status)
