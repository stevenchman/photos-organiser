# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

**As Electron desktop app (preferred):**
```bash
npm start
```
Spawns Flask as a child process and opens a frameless Electron window. Flask runs on `http://127.0.0.1:5173`.

**Flask only (browser mode):**
```bash
./venv/Scripts/python.exe app.py
```
Opens a browser automatically at `http://localhost:5173`. When `ELECTRON` env var is set (by `electron/main.js`), the auto-open is skipped.

**Always kill existing server processes before restarting:**
```bash
kill $(ps aux 2>/dev/null | grep "venv/Scripts/python" | grep -v grep | awk '{print $1}') 2>/dev/null
```
Flask restarts don't take effect if old processes are still holding the port — this is a recurring issue on Windows/bash.

## Installing dependencies

```bash
./venv/Scripts/pip install -r requirements.txt
npm install
```

The venv was created with the uv-managed Python at `C:\Users\steve\AppData\Roaming\uv\python\cpython-3.12.11-windows-x86_64-none\python.exe`.

System dependency: **FFmpeg** — installed via scoop (`scoop install ffmpeg`). The app adds scoop shims to PATH at startup (`app.py`). Without ffmpeg, video metadata dates and video thumbnails fall back to file mtime / no thumbnail.

## Regenerating the icon

```bash
./venv/Scripts/python.exe scripts/generate_icon.py
```
Outputs `assets/icon.png` (256px) and `assets/icon.ico` (multi-size). Draws a Rolleiflex TLR camera on an amber gradient.

## Architecture

Single-user local tool: Electron shell → Python/Flask backend → vanilla JS frontend. No build step. All scan/execution state is in-memory (`_scans`, `_executions` dicts in `api/routes.py`) and lost on server restart.

### Electron layer

- `electron/main.js` — frameless `BrowserWindow` (`frame: false`), spawns Flask as child process, IPC handlers for window controls (minimize/maximize/close)
- `electron/preload.js` — `contextBridge` exposes `window.APP.window.*` methods to renderer

### Request flow

```
Electron BrowserWindow → Flask (api/routes.py) → core/ modules → filesystem
```

1. User sets source/dest paths → `POST /api/settings` (stored in Flask session)
2. Scan triggered → `POST /api/scan` starts a background thread, returns `scan_id`
3. Browser polls `GET /api/scan/<scan_id>` until `status == "complete"`
4. Preview rendered from scan data; user edits folder descriptions
5. `POST /api/confirm` validates plan, runs `preflight_check()` for duplicate detection, stores in session
6. `POST /api/execute` runs moves in background thread; browser streams progress via SSE from `GET /api/execute/status/<exec_id>`

### Core modules

- **`core/metadata.py`** — date extraction priority: EXIF DateTimeOriginal → EXIF DateTime → ffprobe `creation_time` (videos) → file mtime. Also handles thumbnails: Pillow for JPEG, rawpy for RAF/DNG (extracts embedded JPEG thumbnail first), ffmpeg pipe for video frame extraction.
- **`core/scanner.py`** — walks source dir, builds `FileRecord` dataclasses with thread pool. `thumbnail_token` is SHA1 of source path, used as stable URL key.
- **`core/grouper.py`** — groups `FileRecord`s by `date_taken` into `DayGroup`s. Picks sample image preferring JPEG > other image > any file.
- **`core/namer.py`** — builds destination paths. Format: `dest/-YYYY/YYMMDD [description]` (e.g. `E:/Library/-2026/260214 Snowdon hike`). Supports four date formats: `yymmdd`, `yyyymmdd`, `yy-mm-dd`, `yyyy-mm-dd`.
- **`core/mover.py`** — executes moves/copies with `shutil`. `preflight_check()` detects destination conflicts. `_unique_dest()` appends `_1`, `_2` suffixes for duplicates.
- **`core/ai_vision.py`** — sends resized sample image to `claude-sonnet-4-6` for a 2-5 word folder name suggestion.
- **`core/watcher.py`** — polling-based folder watcher. Monitors a folder for new supported files, auto-organises them to a destination using current settings. Module-level API: `start_watcher()`, `stop_watcher()`, `watcher_status()`.
- **`core/blur.py`** — Laplacian-based blur detection for image quality scoring.
- **`core/location.py`** — reverse geocoding from GPS EXIF data.

### Frontend

Single HTML shell (`ui/index.html`) with five JS-toggled views: `settings → scanning → preview → executing → done`. No framework — vanilla JS modules as IIFEs.

- **`ui/js/app.js`** — state machine, scan polling loop, view transitions, confirm/execute flow, Electron titlebar init
- **`ui/js/preview.js`** — renders group cards and file tables, combine-groups mode, lightbox integration
- **`ui/js/lightbox.js`** — full-screen image/video overlay with rotation, filmstrip navigation
- **`ui/js/settings.js`** — folder picker modal, drag-and-drop on path inputs, watcher controls, recent path history dropdowns
- **`ui/js/appearance.js`** — Mango Design System integration: theme grid, font grid, scale selector
- **`ui/js/themes.js`** — 17 theme definitions from Mango Design System, `applyThemePackage()` sets CSS vars + gradient
- **`ui/js/fonts.js`** — 20 font definitions, `applyFont()` sets font-family CSS vars
- **`ui/js/api.js`** — thin `fetch()` wrappers for all backend endpoints

### Theming (Mango Design System)

The UI uses a CSS-variable-driven design system. `themes.js` and `fonts.js` define all options. `appearance.js` bootstraps from localStorage before DOM ready to prevent flash. Key CSS vars: `--bg`, `--surface`, `--panel`, `--amber`, `--text`, `--text-mid`, `--text-dim`, `--glass-bg`, `--hover`, `--border`, `--radius-card`, `--radius-btn`, `--font-body`, `--font-title`. Default theme: `void`, default font: `poppins`.

### Persistence

- **localStorage** (survives restart): theme, font, scale, history limit, recent paths, watch folder paths
- **Flask session** (cookie): source/dest paths, operation, mode, date format, scan depth, confirmed plan
- **In-memory dicts** (lost on restart): `_scans`, `_executions` in `api/routes.py`

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
