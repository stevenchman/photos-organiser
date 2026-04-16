/**
 * Main application state machine and view transitions.
 * Handles Electron titlebar window controls when running as desktop app.
 */

const App = (() => {
  let state = {
    view: "settings",
    scanId: null,
    scanData: null,
    mode: "exif",
    operation: "copy",
  };
  let _scanPollInterval = null;

  function init() {
    _initElectronTitlebar();
    Settings.init(_onStartScan);

    document.getElementById("back-to-settings").addEventListener("click", () => _showView("settings"));
    document.getElementById("confirm-btn").addEventListener("click", _onConfirm);
    document.getElementById("suggest-all-btn").addEventListener("click", _onSuggestAll);

    const _restart = () => {
      state = { view: "settings", scanId: null, scanData: null, mode: "exif", operation: "copy" };
      _showView("settings");
    };
    document.getElementById("restart-btn").addEventListener("click", _restart);
    document.getElementById("restart-btn-top").addEventListener("click", _restart);

    document.getElementById("cancel-scan-btn").addEventListener("click", () => {
      if (_scanPollInterval) { clearInterval(_scanPollInterval); _scanPollInterval = null; }
      state = { view: "settings", scanId: null, scanData: null, mode: "exif", operation: "copy" };
      _showView("settings");
    });

    _showView("settings");
  }

  // ── Electron titlebar ──────────────────────────────────────────────────────

  function _initElectronTitlebar() {
    if (!window.APP) return; // browser mode — no titlebar

    const titlebar = document.getElementById("titlebar");
    if (titlebar) titlebar.classList.add("visible");

    document.getElementById("titlebar-minimize")?.addEventListener("click", () => window.APP.window.minimize());
    document.getElementById("titlebar-maximize")?.addEventListener("click", () => window.APP.window.maximize());
    document.getElementById("titlebar-close")?.addEventListener("click",    () => window.APP.window.close());

    window.APP.window.onState(state => {
      const btn = document.getElementById("titlebar-maximize");
      if (btn) btn.textContent = state === "maximized" ? "❐" : "□";
    });
  }

  // ── View transitions ───────────────────────────────────────────────────────

  function _showView(name) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${name}`).classList.add("active");
    state.view = name;
  }

  // ── Scan ───────────────────────────────────────────────────────────────────

  async function _onStartScan({ source, dest, mode, operation }) {
    state.mode = mode;
    state.operation = operation;
    _showView("scanning");
    document.getElementById("scan-status-text").textContent = "Scanning…";

    try {
      const res = await API.startScan();
      state.scanId = res.scan_id;
      _pollScan();
    } catch (e) {
      document.getElementById("scan-status-text").textContent = "Error: " + e.message;
    }
  }

  function _pollScan() {
    _scanPollInterval = setInterval(async () => {
      try {
        const data = await API.getScan(state.scanId);
        document.getElementById("scan-status-text").textContent = `Found ${data.files_found} files…`;

        if (data.status === "complete") {
          clearInterval(_scanPollInterval); _scanPollInterval = null;
          state.scanData = data;
          _showPreview(data);
        } else if (data.status === "error") {
          clearInterval(_scanPollInterval); _scanPollInterval = null;
          document.getElementById("scan-status-text").textContent = "Scan error: " + (data.error || "Unknown error");
        }
      } catch (e) {
        clearInterval(_scanPollInterval); _scanPollInterval = null;
        document.getElementById("scan-status-text").textContent = "Poll error: " + e.message;
      }
    }, 1000);
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  function _showPreview(data) {
    document.getElementById("suggest-all-btn").style.display =
      state.mode === "ai" ? "inline-block" : "none";
    document.getElementById("preview-group-count").textContent =
      `${data.group_count} day${data.group_count !== 1 ? "s" : ""} · ${data.files_found} files`;
    Preview.render(data);
    _showView("preview");
  }

  // ── AI suggest all ─────────────────────────────────────────────────────────

  async function _onSuggestAll() {
    const btn = document.getElementById("suggest-all-btn");
    btn.disabled = true;
    btn.textContent = "Getting AI names…";
    try {
      const res = await API.suggestNames(state.scanId, null);
      for (const r of res.results) {
        Preview.showAiResult(r.group_id, r.success ? r.suggested_name : null, r.success ? null : r.error);
      }
    } catch (e) {
      _showPreviewAlert("AI naming failed: " + e.message, "danger");
    } finally {
      btn.disabled = false;
      btn.textContent = "✦ Get AI Names";
    }
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  async function _onConfirm() {
    const groups     = Preview.collectGroups();
    const undated    = Preview.collectUndatedAssignments();
    const blurSkips  = Preview.collectBlurSkips();
    try {
      const res = await API.confirm(state.scanId, state.operation, groups, undated, blurSkips);
      if (res.conflicts && res.conflicts.length > 0) {
        const ok = confirm(
          `${res.conflicts.length} file(s) already exist in the destination and will be renamed with a numeric suffix. Continue?`
        );
        if (!ok) return;
      }
      _showView("executing");
      _startExecution(res.total_files);
    } catch (e) {
      _showPreviewAlert("Confirm failed: " + e.message, "danger");
    }
  }

  // ── Execute ────────────────────────────────────────────────────────────────

  async function _startExecution(totalFiles) {
    document.getElementById("exec-progress-fill").style.width = "0%";
    document.getElementById("exec-progress-label").textContent = "Starting…";
    document.getElementById("exec-current-file").textContent = "";

    let res;
    try {
      res = await API.execute();
    } catch (e) {
      document.getElementById("exec-progress-label").textContent = "Error: " + e.message;
      return;
    }

    const evtSource = new EventSource(API.executeStatusUrl(res.exec_id));
    evtSource.onmessage = e => {
      const data = JSON.parse(e.data);
      const completed = data.completed || 0;
      const total     = data.total || totalFiles || 1;
      const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

      document.getElementById("exec-progress-fill").style.width = pct + "%";
      document.getElementById("exec-progress-label").textContent = `${completed} / ${total} files`;
      if (data.current) document.getElementById("exec-current-file").textContent = data.current;

      if (data.status === "done") {
        evtSource.close();
        _showDone(data.results || []);
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      document.getElementById("exec-progress-label").textContent = "Connection lost.";
    };
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  function _showDone(results) {
    const succeeded = results.filter(r => r.success).length;
    const failed    = results.filter(r => !r.success).length;

    document.getElementById("done-summary-text").innerHTML =
      `<span class="badge badge-success">${succeeded} moved/copied</span>` +
      (failed > 0 ? ` <span class="badge badge-danger">${failed} failed</span>` : "");

    const tbody = document.getElementById("done-results-tbody");
    tbody.innerHTML = results.slice(0, 200).map(r => {
      const src  = r.source.split(/[\\/]/).pop();
      const dest = r.destination.replace(/\\/g, "/");
      return `<tr class="${r.success ? "success" : "error"}">
        <td>${r.success ? "✓" : "✗"}</td>
        <td>${_esc(src)}</td>
        <td style="color:var(--text-muted)">${_esc(dest)}</td>
        ${r.error ? `<td style="color:var(--danger)">${_esc(r.error)}</td>` : "<td></td>"}
      </tr>`;
    }).join("");

    if (results.length > 200) {
      tbody.innerHTML += `<tr><td colspan="4" style="color:var(--text-muted);text-align:center">… and ${results.length - 200} more</td></tr>`;
    }
    _showView("done");
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _showPreviewAlert(msg, type) {
    const el = document.getElementById("preview-alert");
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.style.display = "flex";
    setTimeout(() => el.style.display = "none", 6000);
  }

  function _esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
