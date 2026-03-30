/**
 * Lightbox — shows large image previews and plays videos.
 *
 * Usage:
 *   Lightbox.open(scanId, token, fileType, filename)
 *   fileType: e.g. "jpeg", "raw_raf", "dng", "mp4", "insv", "insp", "360"
 */

const Lightbox = (() => {
  const VIDEO_TYPES = new Set(["mp4", "insv", "insp", "360"]);

  let _overlay, _img, _video, _caption, _spinner;

  function _init() {
    _overlay  = document.getElementById("lightbox-overlay");
    _img      = document.getElementById("lightbox-img");
    _video    = document.getElementById("lightbox-video");
    _caption  = document.getElementById("lightbox-caption");
    _spinner  = document.getElementById("lightbox-spinner");

    document.getElementById("lightbox-close").addEventListener("click", close);
    _overlay.addEventListener("click", e => {
      if (e.target === _overlay) close();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
    });
  }

  function open(scanId, token, fileType, filename) {
    if (!_overlay) _init();

    // Reset state
    _img.style.display   = "none";
    _video.style.display = "none";
    _img.src = "";
    _video.pause();
    _video.src = "";
    _spinner.style.display = "flex";
    _caption.textContent = filename || "";
    _overlay.classList.add("open");

    if (VIDEO_TYPES.has(fileType)) {
      _openVideo(scanId, token);
    } else {
      _openImage(scanId, token);
    }
  }

  function _openImage(scanId, token) {
    _img.onload = () => {
      _spinner.style.display = "none";
      _img.style.display = "block";
    };
    _img.onerror = () => {
      _spinner.style.display = "none";
      _caption.textContent += " (preview unavailable)";
    };
    _img.src = API.previewUrl(scanId, token);
  }

  function _openVideo(scanId, token) {
    _spinner.style.display = "none";
    _video.style.display = "block";
    _video.src = API.videoUrl(scanId, token);
    _video.load();
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove("open");
    _video.pause();
    _video.src = "";
    _img.src = "";
  }

  return { open, close };
})();
