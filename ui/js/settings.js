/**
 * Settings view logic: paths, mode toggle, API key, folder picker,
 * date format, scan depth, recent path history, watcher controls.
 */

const Settings = (() => {
  let _onStart = null;
  let _pickerTarget = null;
  let _pickerCurrentPath = "";
  let _pickerSelectedPath = "";

  const HISTORY_KEY    = 'ph-path-history';
  const HISTORY_LIMIT  = 10;
  const WATCH_PATH_KEY = 'ph-watch-path';
  const WATCH_DEST_KEY = 'ph-watch-dest';

  let _watcherPollInterval = null;
  let _watcherLogOpen = false;
  let _watchOp = "copy";
  let _dateFormat = "yymmdd";

  // ── Date format preview ────────────────────────────────────────────────────

  const _DATE_FORMAT_EXAMPLES = {
    "yymmdd":     "260214 Snowdon hike",
    "yyyymmdd":   "20260214 Snowdon hike",
    "yy-mm-dd":   "26-02-14 Snowdon hike",
    "yyyy-mm-dd": "2026-02-14 Snowdon hike",
  };

  function _updateDateFormatPreview() {
    const el = document.getElementById("date-format-preview");
    if (el) el.textContent = "e.g. -2026/" + (_DATE_FORMAT_EXAMPLES[_dateFormat] || "");
  }

  // ── History helpers ────────────────────────────────────────────────────────

  function _loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
  }

  function _saveToHistory(path) {
    if (!path) return;
    let h = _loadHistory().filter(p => p !== path);
    h.unshift(path);
    h = h.slice(0, HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }

  function _buildHistoryDropdown(dropdownEl, inputEl) {
    const history = _loadHistory();
    dropdownEl.innerHTML = "";
    if (!history.length) { dropdownEl.classList.remove("open"); return; }

    history.forEach(p => {
      const item = document.createElement("div");
      item.className = "path-history-item";
      item.textContent = p;
      item.addEventListener("mousedown", e => {
        e.preventDefault();
        inputEl.value = p;
        dropdownEl.classList.remove("open");
      });
      dropdownEl.appendChild(item);
    });
    dropdownEl.classList.add("open");
  }

  function _attachHistoryBehaviour(inputId, dropdownId) {
    const input    = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    input.addEventListener("focus", () => _buildHistoryDropdown(dropdown, input));
    input.addEventListener("input", () => {
      if (!input.value) _buildHistoryDropdown(dropdown, input);
      else dropdown.classList.remove("open");
    });
    input.addEventListener("blur", () => {
      setTimeout(() => dropdown.classList.remove("open"), 150);
    });
  }

  // ── Drag-and-drop on path inputs ───────────────────────────────────────────

  function _attachDragDrop(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("dragover", e => { e.preventDefault(); input.style.borderColor = "var(--amber)"; });
    input.addEventListener("dragleave", () => { input.style.borderColor = ""; });
    input.addEventListener("drop", e => {
      e.preventDefault();
      input.style.borderColor = "";
      const files = e.dataTransfer.files;
      if (files && files.length) {
        // Use the dropped path (works in Electron; in browser gives C:\fakepath)
        const rawPath = files[0].path || files[0].name;
        if (rawPath && !rawPath.includes("fakepath")) input.value = rawPath;
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(onStartCallback) {
    _onStart = onStartCallback;

    // Load saved settings
    API.getSettings().then(s => {
      document.getElementById("source-path").value = s.source_path || "";
      document.getElementById("dest-path").value   = s.dest_path   || "";
      _setOperation(s.operation || "copy");
      _setMode(s.mode || "exif");

      _dateFormat = s.date_format || "yymmdd";
      _setDateFormat(_dateFormat);

      const depthInput = document.getElementById("scan-depth");
      if (depthInput) depthInput.value = s.scan_depth ?? 0;

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

    // Restore watcher paths from localStorage
    const savedWatchPath = localStorage.getItem(WATCH_PATH_KEY) || "";
    const savedWatchDest = localStorage.getItem(WATCH_DEST_KEY) || "";
    if (savedWatchPath) document.getElementById("watch-path").value = savedWatchPath;
    if (savedWatchDest) document.getElementById("watch-dest-path").value = savedWatchDest;

    // Operation toggle
    document.getElementById("op-copy").addEventListener("click", () => _setOperation("copy"));
    document.getElementById("op-move").addEventListener("click", () => _setOperation("move"));

    // Mode toggle
    document.getElementById("mode-exif").addEventListener("click", () => _setMode("exif"));
    document.getElementById("mode-ai").addEventListener("click",   () => _setMode("ai"));

    // Date format toggle
    document.querySelectorAll("#date-format-group button").forEach(btn => {
      btn.addEventListener("click", () => _setDateFormat(btn.dataset.fmt));
    });

    // Folder picker buttons
    document.getElementById("browse-source").addEventListener("click", () => _openPicker("source"));
    document.getElementById("browse-dest").addEventListener("click",   () => _openPicker("dest"));
    document.getElementById("browse-watch").addEventListener("click",  () => _openPicker("watch"));
    document.getElementById("browse-watch-dest").addEventListener("click", () => _openPicker("watch-dest"));

    // Picker modal
    document.getElementById("picker-close").addEventListener("click",  _closePicker);
    document.getElementById("picker-select").addEventListener("click", _confirmPicker);
    document.getElementById("picker-overlay").addEventListener("click", e => {
      if (e.target === document.getElementById("picker-overlay")) _closePicker();
    });

    // Start scan
    document.getElementById("start-scan-btn").addEventListener("click", _handleStart);

    // API key validate
    document.getElementById("validate-key-btn").addEventListener("click", _validateKey);

    // Watcher controls
    document.getElementById("watcher-start-btn").addEventListener("click", _startWatcher);
    document.getElementById("watcher-stop-btn").addEventListener("click",  _stopWatcher);
    document.getElementById("watcher-log-toggle").addEventListener("click", () => {
      _watcherLogOpen = !_watcherLogOpen;
      document.getElementById("watcher-log").classList.toggle("open", _watcherLogOpen);
      document.getElementById("watcher-log-toggle").textContent = _watcherLogOpen ? "Hide log" : "Show log";
    });
    document.getElementById("watch-op-copy").addEventListener("click", () => _setWatchOp("copy"));
    document.getElementById("watch-op-move").addEventListener("click", () => _setWatchOp("move"));

    // History dropdowns
    _attachHistoryBehaviour("source-path", "source-history");
    _attachHistoryBehaviour("dest-path",   "dest-history");
    _attachHistoryBehaviour("watch-path",  "watch-history");
    _attachHistoryBehaviour("watch-dest-path", "watch-dest-history");

    // Drag-and-drop
    _attachDragDrop("source-path");
    _attachDragDrop("dest-path");
    _attachDragDrop("watch-path");
    _attachDragDrop("watch-dest-path");

    // Poll watcher status on load
    _pollWatcherStatus();
  }

  // ── Operation / mode / date format ─────────────────────────────────────────

  function _setOperation(op) {
    document.getElementById("op-copy").classList.toggle("active", op === "copy");
    document.getElementById("op-move").classList.toggle("active", op === "move");
  }

  function _setMode(mode) {
    document.getElementById("mode-exif").classList.toggle("active", mode === "exif");
    document.getElementById("mode-ai").classList.toggle("active",   mode === "ai");
    document.getElementById("ai-key-section").style.display = mode === "ai" ? "block" : "none";
  }

  function _setDateFormat(fmt) {
    _dateFormat = fmt;
    document.querySelectorAll("#date-format-group button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.fmt === fmt);
    });
    _updateDateFormatPreview();
  }

  function _setWatchOp(op) {
    _watchOp = op;
    document.getElementById("watch-op-copy").classList.toggle("active", op === "copy");
    document.getElementById("watch-op-move").classList.toggle("active", op === "move");
  }

  function _getMode()      { return document.getElementById("mode-ai").classList.contains("active") ? "ai" : "exif"; }
  function _getOperation() { return document.getElementById("op-move").classList.contains("active") ? "move" : "copy"; }

  // ── Start scan ─────────────────────────────────────────────────────────────

  async function _handleStart() {
    const source = document.getElementById("source-path").value.trim();
    const dest   = document.getElementById("dest-path").value.trim();

    if (!source) { _showError("Please set a source folder."); return; }
    if (!dest)   { _showError("Please set a destination folder."); return; }

    const apiKey    = document.getElementById("api-key-input").value.trim();
    const mode      = _getMode();
    const op        = _getOperation();
    const scanDepth = parseInt(document.getElementById("scan-depth")?.value || "0", 10);

    try {
      await API.saveSettings({
        source_path: source,
        dest_path:   dest,
        operation:   op,
        mode,
        date_format: _dateFormat,
        scan_depth:  scanDepth,
        api_key:     apiKey,
      });
      _saveToHistory(source);
      _saveToHistory(dest);
      _clearError();
      _onStart && _onStart({ source, dest, mode, operation: op });
    } catch (e) {
      _showError("Failed to save settings: " + e.message);
    }
  }

  // ── API key ────────────────────────────────────────────────────────────────

  async function _validateKey() {
    const key = document.getElementById("api-key-input").value.trim();
    if (!key) { _showKeyStatus("Enter an API key first.", "warn"); return; }
    _showKeyStatus("Checking…", "info");
    try {
      const res = await API.validateKey(key);
      _showKeyStatus(res.valid ? "API key is valid." : "Invalid API key.", res.valid ? "success" : "danger");
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
    document.getElementById("settings-error").style.display = "none";
  }

  // ── Watcher ────────────────────────────────────────────────────────────────

  async function _startWatcher() {
    const watchPath = document.getElementById("watch-path").value.trim();
    const destPath  = document.getElementById("watch-dest-path").value.trim();
    if (!watchPath || !destPath) {
      alert("Please set both watch folder and destination."); return;
    }
    localStorage.setItem(WATCH_PATH_KEY, watchPath);
    localStorage.setItem(WATCH_DEST_KEY, destPath);
    _saveToHistory(watchPath);
    _saveToHistory(destPath);

    try {
      await API.watcherStart(watchPath, destPath, _watchOp, _dateFormat);
      _updateWatcherUI(await API.watcherStatus());
      _startWatcherPoll();
    } catch (e) {
      alert("Failed to start watcher: " + e.message);
    }
  }

  async function _stopWatcher() {
    try {
      await API.watcherStop();
      _updateWatcherUI(await API.watcherStatus());
      _stopWatcherPoll();
    } catch (e) {
      alert("Failed to stop watcher: " + e.message);
    }
  }

  function _startWatcherPoll() {
    if (_watcherPollInterval) return;
    _watcherPollInterval = setInterval(async () => {
      try {
        const status = await API.watcherStatus();
        _updateWatcherUI(status);
        if (!status.running) _stopWatcherPoll();
      } catch { _stopWatcherPoll(); }
    }, 3000);
  }

  function _stopWatcherPoll() {
    clearInterval(_watcherPollInterval);
    _watcherPollInterval = null;
  }

  async function _pollWatcherStatus() {
    try {
      const status = await API.watcherStatus();
      _updateWatcherUI(status);
      if (status.running) _startWatcherPoll();
    } catch { /* server not ready yet */ }
  }

  function _updateWatcherUI(status) {
    const dot     = document.getElementById("watcher-dot");
    const text    = document.getElementById("watcher-status-text");
    const count   = document.getElementById("watcher-files-count");
    const startBtn = document.getElementById("watcher-start-btn");
    const stopBtn  = document.getElementById("watcher-stop-btn");
    const logToggle = document.getElementById("watcher-log-toggle");

    dot.classList.toggle("running", !!status.running);
    text.textContent = status.running
      ? `Running — watching ${status.watch_path || ""}`
      : "Not running";
    count.textContent = status.files_processed > 0
      ? `${status.files_processed} file${status.files_processed !== 1 ? "s" : ""} processed`
      : "";

    startBtn.style.display = status.running ? "none" : "";
    stopBtn.style.display  = status.running ? "" : "none";
    logToggle.style.display = (status.log && status.log.length) ? "" : "none";

    // Render log
    if (status.log && status.log.length) {
      const logEl = document.getElementById("watcher-log");
      logEl.innerHTML = status.log.slice().reverse().map(entry =>
        `<div class="watcher-log-entry ${entry.level}">
          <span style="opacity:0.5;margin-right:8px">${entry.time.slice(11)}</span>${_esc(entry.message)}
        </div>`
      ).join("");
    }
  }

  // ── Folder picker ──────────────────────────────────────────────────────────

  function _openPicker(target) {
    _pickerTarget = target;
    const inputId = _pickerInputId(target);
    const currentVal = document.getElementById(inputId)?.value.trim() || "";
    _pickerSelectedPath = currentVal;
    document.getElementById("picker-overlay").classList.add("open");
    document.getElementById("picker-title").textContent = _pickerTitle(target);
    _loadPickerDir(currentVal || "");
  }

  function _pickerInputId(target) {
    const map = {
      "source":     "source-path",
      "dest":       "dest-path",
      "watch":      "watch-path",
      "watch-dest": "watch-dest-path",
    };
    return map[target] || "source-path";
  }

  function _pickerTitle(target) {
    const map = {
      "source":     "Select Source Folder",
      "dest":       "Select Destination Folder",
      "watch":      "Select Watch Folder",
      "watch-dest": "Select Watcher Destination",
    };
    return map[target] || "Select Folder";
  }

  function _closePicker() {
    document.getElementById("picker-overlay").classList.remove("open");
    _pickerTarget = null;
  }

  function _confirmPicker() {
    if (!_pickerSelectedPath) { _closePicker(); return; }
    const inputId = _pickerInputId(_pickerTarget);
    document.getElementById(inputId).value = _pickerSelectedPath;
    _closePicker();
  }

  async function _loadPickerDir(path) {
    const list = document.getElementById("picker-list");
    list.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.83rem;">Loading…</div>';
    try {
      const data = await API.browse(path);
      _pickerCurrentPath  = data.current;
      _pickerSelectedPath = data.current;
      document.getElementById("picker-path-bar").textContent = data.current;
      document.getElementById("picker-selected").textContent = data.current;

      list.innerHTML = "";
      for (const entry of data.entries) {
        if (!entry.is_dir) continue;
        const div = document.createElement("div");
        div.className = "modal-entry dir";
        div.innerHTML = `<span class="icon">📁</span><span>${_esc(entry.name)}</span>`;
        div.addEventListener("click", () => {
          if (entry.name === "..") {
            _loadPickerDir(entry.path);
          } else {
            _pickerSelectedPath = entry.path;
            document.getElementById("picker-selected").textContent = entry.path;
            list.querySelectorAll(".modal-entry").forEach(e => e.style.background = "");
            div.style.background = "var(--surface)";
          }
        });
        div.addEventListener("dblclick", () => {
          if (entry.name !== "..") _loadPickerDir(entry.path);
        });
        list.appendChild(div);
      }
      if (list.children.length === 0) {
        list.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.83rem;">No subdirectories found.</div>';
      }
    } catch (e) {
      list.innerHTML = `<div style="padding:16px;color:var(--danger);font-size:0.83rem;">Error: ${_esc(e.message)}</div>`;
    }
  }

  function _esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  return { init };
})();
