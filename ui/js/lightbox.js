/**
 * Lightbox — full-screen image/video viewer with rotation and filmstrip navigation.
 *
 * Usage:
 *   Lightbox.open(scanId, token, fileType, filename, filmstripFiles)
 *     filmstripFiles: optional array of {token, file_type, filename} for the strip
 */

const Lightbox = (() => {
  const VIDEO_TYPES = new Set(["mp4", "insv", "insp", "360"]);

  let _overlay, _img, _video, _caption, _spinner, _filmstrip, _prevBtn, _nextBtn;
  let _rotation = 0;
  let _currentScanId = null;
  let _currentToken = null;
  let _filmstripFiles = [];
  const _preloadCache = new Set(); // tokens already kicked off for preload

  function _init() {
    _overlay   = document.getElementById("lightbox-overlay");
    _img       = document.getElementById("lightbox-img");
    _video     = document.getElementById("lightbox-video");
    _caption   = document.getElementById("lightbox-caption");
    _spinner   = document.getElementById("lightbox-spinner");
    _filmstrip = document.getElementById("lightbox-filmstrip");
    _prevBtn   = document.getElementById("lightbox-prev");
    _nextBtn   = document.getElementById("lightbox-next");

    document.getElementById("lightbox-close").addEventListener("click", close);
    document.getElementById("lightbox-rotate-ccw").addEventListener("click", () => _rotate(-90));
    document.getElementById("lightbox-rotate-cw").addEventListener("click",  () => _rotate(90));
    _prevBtn.addEventListener("click", () => _navigateFilmstrip(-1));
    _nextBtn.addEventListener("click", () => _navigateFilmstrip(1));

    _overlay.addEventListener("click", e => {
      if (e.target === _overlay) close();
    });
    document.addEventListener("keydown", e => {
      if (!_overlay?.classList.contains("open")) return;
      if (e.key === "Escape")      close();
      if (e.key === "ArrowRight")  _navigateFilmstrip(1);
      if (e.key === "ArrowLeft")   _navigateFilmstrip(-1);
      if (e.key === "ArrowUp" || e.key === "r") _rotate(90);
    });
  }

  function open(scanId, token, fileType, filename, filmstripFiles) {
    if (!_overlay) _init();

    _rotation = 0;
    _currentScanId = scanId;
    _currentToken  = token;
    _filmstripFiles = filmstripFiles || [];

    _img.style.display   = "none";
    _video.style.display = "none";
    _img.style.transform = "";
    _img.src = "";
    _video.pause();
    _video.src = "";
    _spinner.style.display = "flex";
    _caption.textContent = filename || "";
    _overlay.classList.add("open");

    _buildFilmstrip(scanId, token);
    _updateNavButtons();

    if (VIDEO_TYPES.has(fileType)) {
      _openVideo(scanId, token);
    } else {
      _openImage(scanId, token);
    }
  }

  function _preloadImage(scanId, token) {
    if (_preloadCache.has(token) || VIDEO_TYPES.has(token)) return;
    _preloadCache.add(token);
    const img = new Image();
    img.src = API.previewUrl(scanId, token);
  }

  function _preloadNeighbors(scanId, currentToken) {
    const idx = _filmstripFiles.findIndex(f => f.token === currentToken);
    if (idx === -1) return;
    // Preload next 2 and prev 1
    [-1, 1, 2].forEach(offset => {
      const f = _filmstripFiles[idx + offset];
      if (f && !VIDEO_TYPES.has(f.file_type)) _preloadImage(scanId, f.token);
    });
  }

  function _openImage(scanId, token) {
    _img.onload = () => {
      _spinner.style.display = "none";
      _img.style.display = "block";
      _applyRotation();
      _preloadNeighbors(scanId, token);
    };
    _img.onerror = () => {
      _spinner.style.display = "none";
      _caption.textContent += " (preview unavailable)";
    };
    _preloadCache.add(token); // mark current as in-flight
    _img.src = API.previewUrl(scanId, token);
  }

  function _openVideo(scanId, token) {
    _spinner.style.display = "none";
    _video.style.display = "block";
    _video.src = API.videoUrl(scanId, token);
    _video.load();
  }

  function _rotate(deg) {
    _rotation = (_rotation + deg + 360) % 360;
    _applyRotation();
  }

  function _applyRotation() {
    _img.style.transform = _rotation ? `rotate(${_rotation}deg)` : "";
  }

  function _buildFilmstrip(scanId, activeToken) {
    if (!_filmstrip) return;
    _filmstrip.innerHTML = "";
    if (!_filmstripFiles.length) return;

    for (const f of _filmstripFiles) {
      if (VIDEO_TYPES.has(f.file_type)) {
        const div = document.createElement("div");
        div.className = "filmstrip-thumb" + (f.token === activeToken ? " active" : "");
        div.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:18px;";
        div.textContent = "🎬";
        div.dataset.token = f.token;
        div.addEventListener("click", () => _jumpTo(f));
        _filmstrip.appendChild(div);
      } else {
        const img = document.createElement("img");
        img.className = "filmstrip-thumb" + (f.token === activeToken ? " active" : "");
        img.src = API.fileThumbnailUrl(scanId, f.token);
        img.dataset.token = f.token;
        img.addEventListener("click", () => _jumpTo(f));
        _filmstrip.appendChild(img);
      }
    }

    // Scroll active thumb into view
    const active = _filmstrip.querySelector(".filmstrip-thumb.active");
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function _jumpTo(f) {
    _currentToken = f.token;
    _rotation = 0;
    _img.style.display   = "none";
    _video.style.display = "none";
    _img.style.transform = "";
    _spinner.style.display = "flex";
    _caption.textContent = f.filename || "";

    // Update active state in filmstrip
    _filmstrip?.querySelectorAll(".filmstrip-thumb").forEach(el => {
      el.classList.toggle("active", el.dataset.token === f.token);
    });

    _updateNavButtons();

    if (VIDEO_TYPES.has(f.file_type)) {
      _openVideo(_currentScanId, f.token);
    } else {
      _openImage(_currentScanId, f.token);
    }
  }

  function _navigateFilmstrip(dir) {
    if (!_filmstripFiles.length) return;
    const idx = _filmstripFiles.findIndex(f => f.token === _currentToken);
    if (idx === -1) return;
    const next = _filmstripFiles[idx + dir];
    if (next) _jumpTo(next);
  }

  function _updateNavButtons() {
    if (!_prevBtn || !_nextBtn) return;
    const idx = _filmstripFiles.findIndex(f => f.token === _currentToken);
    const hasFilmstrip = _filmstripFiles.length > 1;
    _prevBtn.style.display = hasFilmstrip ? "flex" : "none";
    _nextBtn.style.display = hasFilmstrip ? "flex" : "none";
    _prevBtn.disabled = idx <= 0;
    _nextBtn.disabled = idx >= _filmstripFiles.length - 1;
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove("open");
    _video.pause();
    _video.src = "";
    _img.src = "";
    _filmstripFiles = [];
    _preloadCache.clear();
    if (_prevBtn) _prevBtn.style.display = "none";
    if (_nextBtn) _nextBtn.style.display = "none";
  }

  return { open, close };
})();
