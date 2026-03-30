# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

```bash
./venv/Scripts/python.exe app.py
```

Opens a browser automatically at `http://localhost:5173`. The venv was created with the uv-managed Python at `C:\Users\steve\AppData\Roaming\uv\python\cpython-3.12.11-windows-x86_64-none\python.exe`.

**Always kill existing server processes before restarting:**
```bash
kill $(ps aux 2>/dev/null | grep "venv/Scripts/python" | grep -v grep | awk '{print $1}') 2>/dev/null
```

Flask restarts don't take effect if old processes are still holding the port — this is a recurring issue on Windows/bash.

## Installing dependencies

```bash
./venv/Scripts/pip install -r requirements.txt
```

System dependency: **FFmpeg** — installed via scoop (`scoop install ffmpeg`). The app adds scoop shims to PATH at startup (`app.py`). Without ffmpeg, video metadata dates and video thumbnails fall back to file mtime / no thumbnail.

## Architecture

Single-user local tool: Python/Flask backend + vanilla JS frontend. No build step. All state is in-memory (`_scans`, `_executions` dicts in `api/routes.py`) and lost on server restart.

### Request flow

```
Browser → Flask (api/routes.py) → core/ modules → filesystem
```

1. User sets source/dest paths → `POST /api/settings` (stored in Flask session)
2. Scan triggered → `POST /api/scan` starts a background thread, returns `scan_id`
3. Browser polls `GET /api/scan/<scan_id>` until `status == "complete"`
4. Preview rendered from scan data; user edits folder descriptions
5. `POST /api/confirm` validates plan, builds file_moves list, stores in session
6. `POST /api/execute` runs moves in background thread; browser streams progress via SSE from `GET /api/execute/status/<exec_id>`

### Core modules

- **`core/metadata.py`** — date extraction priority: EXIF DateTimeOriginal → EXIF DateTime → ffprobe `creation_time` (videos) → file mtime. Also handles thumbnails: Pillow for JPEG, rawpy for RAF/DNG (extracts embedded JPEG thumbnail first), ffmpeg pipe for video frame extraction.
- **`core/scanner.py`** — walks source dir, builds `FileRecord` dataclasses. `thumbnail_token` is SHA1 of source path, used as stable URL key.
- **`core/grouper.py`** — groups `FileRecord`s by `date_taken` into `DayGroup`s. Picks sample image preferring JPEG > other image > any file.
- **`core/namer.py`** — builds destination paths. Current format: `dest/-YYYY/YYMMDD [description]` (e.g. `E:/Library/-2026/260214 Snowdon hike`).
- **`core/mover.py`** — executes moves/copies with `shutil`. Handles duplicate filenames by appending `_1`, `_2` suffixes.
- **`core/ai_vision.py`** — sends resized sample image to `claude-sonnet-4-6` for a 2-5 word folder name suggestion.

### Frontend

Single HTML shell (`ui/index.html`) with four JS-toggled views: `settings → scanning → preview → executing → done`. No framework — vanilla JS modules as IIFEs.

- **`ui/js/app.js`** — state machine, scan polling loop, view transitions
- **`ui/js/preview.js`** — renders group cards and file tables; calls `Lightbox.open()`
- **`ui/js/lightbox.js`** — full-screen overlay; images load from `/api/preview/<scan_id>/<token>`, videos stream from `/api/video/<scan_id>/<token>`
- **`ui/js/settings.js`** — folder picker modal (calls `/api/browse`), API key validation

### Thumbnail/preview endpoints

All keyed by `thumbnail_token` (SHA1 of source path):

| Endpoint | Size | Use |
|---|---|---|
| `GET /api/thumbnail/<scan_id>/<group_id>` | 400px | Group card sample image |
| `GET /api/thumbnail/<scan_id>/file/<token>` | 120px | File list row |
| `GET /api/preview/<scan_id>/<token>` | 1920px | Lightbox large view |
| `GET /api/video/<scan_id>/<token>` | original | Lightbox video playback (Range requests supported) |

### Supported file types

Defined in `config.py`: `.jpg/.jpeg` (jpeg), `.raf` (raw_raf), `.dng` (dng), `.mp4` (mp4), `.insv/.insp/.360` (Insta360).

## AI naming mode

Requires `ANTHROPIC_API_KEY` in `.env` or entered in the UI. Uses `claude-sonnet-4-6`. Key validation uses `claude-haiku-4-5-20251001` (cheap test call). API key is never written to disk from the UI — session only.
