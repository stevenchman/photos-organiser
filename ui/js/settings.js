/**
 * Settings view logic: paths, mode toggle, API key, folder picker.
 */

const Settings = (() => {
  let _onStart = null;       // callback when user clicks Start Scan
  let _pickerTarget = null;  // "source" | "dest"
  let _pickerCurrentPath = "";
  let _pickerSelectedPath = "";

  function init(onStartCallback) {
    _onStart = onStartCallback;

    // Load saved settings
    API.getSettings().then(s => {
      document.getElementById("source-path").value = s.source_path || "";
      document.getElementById("dest-path").value   = s.dest_path   || "";
      _setOperation(s.operation || "copy");
      _setMode(s.mode || "exif");
      if (!s.has_api_key) {
        document.getElementById("api-key-field").style.display = "block";
      } else {
        document.getElementById("api-key-field").style.display = "none";
        document.getElementById("api-key-saved-note").style.display = "inline";
      }
      if (!s.ffprobe_available) {
        document.getElementById("ffprobe-warning").style.display = "flex";
      }
    }).catch(() => {});

    // Operation toggle
    document.getElementById("op-copy").addEventListener("click", () => _setOperation("copy"));
    document.getElementById("op-move").addEventListener("click", () => _setOperation("move"));

    // Mode toggle
    document.getElementById("mode-exif").addEventListener("click", () => _setMode("exif"));
    document.getElementById("mode-ai").addEventListener("click",   () => _setMode("ai"));

    // Folder picker buttons
    document.getElementById("browse-source").addEventListener("click", () => _openPicker("source"));
    document.getElementById("browse-dest").addEventListener("click",   () => _openPicker("dest"));

    // Picker modal
    document.getElementById("picker-close").addEventListener("click",  _closePicker);
    document.getElementById("picker-select").addEventListener("click", _confirmPicker);
    document.getElementById("picker-overlay").addEventListener("click", e => {
      if (e.target === document.getElementById("picker-overlay")) _closePicker();
    });

    // Start scan
    document.getElementById("start-scan-btn").addEventListener("click", _handleStart);

    // API key validate button
    document.getElementById("validate-key-btn").addEventListener("click", _validateKey);
  }

  function _setOperation(op) {
    document.getElementById("op-copy").classList.toggle("active", op === "copy");
    document.getElementById("op-move").classList.toggle("active", op === "move");
  }

  function _setMode(mode) {
    document.getElementById("mode-exif").classList.toggle("active", mode === "exif");
    document.getElementById("mode-ai").classList.toggle("active", mode === "ai");
    document.getElementById("ai-key-section").style.display = mode === "ai" ? "block" : "none";
  }

  function _getMode() {
    return document.getElementById("mode-ai").classList.contains("active") ? "ai" : "exif";
  }

  function _getOperation() {
    return document.getElementById("op-move").classList.contains("active") ? "move" : "copy";
  }

  async function _handleStart() {
    const source = document.getElementById("source-path").value.trim();
    const dest   = document.getElementById("dest-path").value.trim();

    if (!source) { _showError("Please set a source folder."); return; }
    if (!dest)   { _showError("Please set a destination folder."); return; }

    const apiKey = document.getElementById("api-key-input").value.trim();
    const mode   = _getMode();
    const op     = _getOperation();

    try {
      await API.saveSettings({ source_path: source, dest_path: dest, operation: op, mode, api_key: apiKey });
      _clearError();
      _onStart && _onStart({ source, dest, mode, operation: op });
    } catch (e) {
      _showError("Failed to save settings: " + e.message);
    }
  }

  async function _validateKey() {
    const key = document.getElementById("api-key-input").value.trim();
    if (!key) { _showKeyStatus("Enter an API key first.", "warn"); return; }

    _showKeyStatus("Checking…", "info");
    try {
      const res = await API.validateKey(key);
      if (res.valid) {
        _showKeyStatus("API key is valid.", "success");
      } else {
        _showKeyStatus("Invalid API key.", "danger");
      }
    } catch (e) {
      _showKeyStatus("Check failed: " + e.message, "warn");
    }
  }

  function _showKeyStatus(msg, type) {
    const el = document.getElementById("key-status");
    el.textContent = msg;
    el.className = `badge badge-${type}`;
    el.style.display = "inline";
  }

  function _showError(msg) {
    const el = document.getElementById("settings-error");
    el.textContent = msg;
    el.style.display = "flex";
  }

  function _clearError() {
    const el = document.getElementById("settings-error");
    el.style.display = "none";
  }

  // ── Folder picker ──────────────────────────────────────────────────────────

  function _openPicker(target) {
    _pickerTarget = target;
    const currentVal = document.getElementById(target === "source" ? "source-path" : "dest-path").value.trim();
    _pickerSelectedPath = currentVal || "";
    document.getElementById("picker-overlay").classList.add("open");
    document.getElementById("picker-title").textContent = target === "source" ? "Select Source Folder" : "Select Destination Folder";
    _loadPickerDir(currentVal || "");
  }

  function _closePicker() {
    document.getElementById("picker-overlay").classList.remove("open");
    _pickerTarget = null;
  }

  function _confirmPicker() {
    if (!_pickerSelectedPath) { _closePicker(); return; }
    const inputId = _pickerTarget === "source" ? "source-path" : "dest-path";
    document.getElementById(inputId).value = _pickerSelectedPath;
    _closePicker();
  }

  async function _loadPickerDir(path) {
    const list = document.getElementById("picker-list");
    list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:0.85rem;">Loading…</div>';
    try {
      const data = await API.browse(path);
      _pickerCurrentPath = data.current;
      _pickerSelectedPath = data.current;
      document.getElementById("picker-path-bar").textContent = data.current;
      document.getElementById("picker-selected").textContent = data.current;

      list.innerHTML = "";
      for (const entry of data.entries) {
        if (!entry.is_dir) continue;
        const div = document.createElement("div");
        div.className = "modal-entry dir";
        div.innerHTML = `<span class="icon">📁</span><span>${entry.name}</span>`;
        div.addEventListener("click", () => {
          if (entry.name === "..") {
            _loadPickerDir(entry.path);
          } else {
            _pickerSelectedPath = entry.path;
            document.getElementById("picker-selected").textContent = entry.path;
            // Highlight
            list.querySelectorAll(".modal-entry").forEach(e => e.style.background = "");
            div.style.background = "var(--surface2)";
          }
        });
        div.addEventListener("dblclick", () => {
          if (entry.name !== "..") _loadPickerDir(entry.path);
        });
        list.appendChild(div);
      }

      if (list.children.length === 0) {
        list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:0.85rem;">No subdirectories found.</div>';
      }
    } catch (e) {
      list.innerHTML = `<div style="padding:16px;color:var(--danger);font-size:0.85rem;">Error: ${e.message}</div>`;
    }
  }

  return { init };
})();
