"""
Entry point — starts the Flask server.
When launched by Electron (ELECTRON=1 env var), browser auto-open is skipped.
"""

import os
import threading
import webbrowser
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, send_from_directory

load_dotenv()

# Ensure scoop shims (ffmpeg, ffprobe) are on PATH
_scoop_shims = Path.home() / "scoop" / "shims"
if _scoop_shims.exists():
    os.environ["PATH"] = str(_scoop_shims) + os.pathsep + os.environ.get("PATH", "")

import config
from api.routes import bp as api_bp

app = Flask(__name__, static_folder=None)
app.secret_key = config.SECRET_KEY
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

app.register_blueprint(api_bp)

UI_DIR = Path(__file__).parent / "ui"


@app.get("/")
def index():
    return send_from_directory(UI_DIR, "index.html")


@app.get("/css/<path:filename>")
def css(filename):
    return send_from_directory(UI_DIR / "css", filename)


@app.get("/js/<path:filename>")
def js(filename):
    return send_from_directory(UI_DIR / "js", filename)


def _open_browser():
    webbrowser.open(f"http://{config.HOST}:{config.PORT}")


if __name__ == "__main__":
    _is_electron = os.environ.get("ELECTRON") == "1"

    if not _is_electron:
        print(f"\nPhoto Organiser running at http://{config.HOST}:{config.PORT}")
        print("Press Ctrl+C to stop.\n")
        threading.Timer(1.0, _open_browser).start()

    app.run(host=config.HOST, port=config.PORT, debug=False, use_reloader=False)
