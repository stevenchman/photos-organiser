/**
 * Thin fetch() wrappers for all backend endpoints.
 */

const API = {
  async getSettings() {
    return _get("/api/settings");
  },

  async saveSettings(data) {
    return _post("/api/settings", data);
  },

  async browse(path) {
    const q = path ? `?path=${encodeURIComponent(path)}` : "";
    return _get(`/api/browse${q}`);
  },

  async startScan() {
    return _post("/api/scan", {});
  },

  async getScan(scanId) {
    return _get(`/api/scan/${scanId}`);
  },

  thumbnailUrl(scanId, groupId) {
    return `/api/thumbnail/${scanId}/${groupId}`;
  },

  fileThumbnailUrl(scanId, token) {
    return `/api/thumbnail/${scanId}/file/${token}`;
  },

  previewUrl(scanId, token) {
    return `/api/preview/${scanId}/${token}`;
  },

  videoUrl(scanId, token) {
    return `/api/video/${scanId}/${token}`;
  },

  async validateKey(apiKey) {
    return _post("/api/validate-key", { api_key: apiKey });
  },

  async suggestNames(scanId, groupIds) {
    return _post("/api/suggest-names", { scan_id: scanId, group_ids: groupIds || null });
  },

  async confirm(scanId, operation, groups, undatedAssignments) {
    return _post("/api/confirm", {
      scan_id: scanId,
      operation,
      groups,
      undated_assignments: undatedAssignments || [],
    });
  },

  async execute() {
    return _post("/api/execute", {});
  },

  executeStatusUrl(execId) {
    return `/api/execute/status/${execId}`;
  },

  // ── Watcher ──────────────────────────────────────────────────────────────

  async watcherStatus() {
    return _get("/api/watcher/status");
  },

  async watcherStart(watchPath, destPath, operation, dateFormat) {
    return _post("/api/watcher/start", {
      watch_path: watchPath,
      dest_path: destPath,
      operation,
      date_format: dateFormat,
    });
  },

  async watcherStop() {
    return _post("/api/watcher/stop", {});
  },
};

async function _get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function _post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
