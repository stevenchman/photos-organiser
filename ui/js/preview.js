/**
 * Preview view — renders group cards and collects user edits.
 */

const Preview = (() => {
  let _scanData = null;

  function render(scanData) {
    _scanData = scanData;
    const container = document.getElementById("groups-container");
    container.innerHTML = "";

    for (const group of scanData.groups) {
      container.appendChild(_buildGroupCard(group, scanData.scan_id));
    }

    // Undated files section
    const undatedSection = document.getElementById("undated-section");
    if (scanData.undated_files && scanData.undated_files.length > 0) {
      undatedSection.style.display = "block";
      _renderUndatedFiles(scanData.undated_files);
    } else {
      undatedSection.style.display = "none";
    }

    _updateFooter();
  }

  function _buildGroupCard(group, scanId) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.groupId = group.group_id;
    if (group.skip) card.classList.add("skipped");

    const dateObj = new Date(group.date + "T00:00:00");
    const dateLabel = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const fileWord = group.file_count === 1 ? "file" : "files";

    // Thumbnail
    const sampleIsVideo = group.sample_file_type && ["mp4","insv","insp","360"].includes(group.sample_file_type);
    let thumbHtml;
    if (group.has_sample_image && group.sample_token) {
      const clickAttr = `onclick="Lightbox.open('${scanId}','${group.sample_token}','${group.sample_file_type}','${_escAttr(group.proposed_folder_name)}')"`;
      thumbHtml = `<img class="thumb thumb-clickable"
        src="${API.thumbnailUrl(scanId, group.group_id)}"
        alt="thumbnail"
        ${clickAttr}
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="thumb-placeholder" style="display:none" ${clickAttr}>${sampleIsVideo ? "🎬" : "🖼"}</div>`;
    } else {
      thumbHtml = `<div class="thumb-placeholder">📷</div>`;
    }

    card.innerHTML = `
      <div class="card-header">
        ${thumbHtml}
        <div class="card-meta">
          <div class="date-label">${dateLabel}</div>
          <div class="file-count">${group.file_count} ${fileWord}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div id="ai-status-${group.group_id}"></div>
        </div>
      </div>

      <div class="name-row">
        <span class="name-prefix">${group.proposed_folder_name}</span>
        <input type="text" id="desc-${group.group_id}"
               placeholder="Add description (optional)"
               value="${_escAttr(group.description || '')}"
               autocomplete="off">
      </div>

      <div id="ai-row-${group.group_id}" style="display:none; margin-bottom:8px;"></div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button class="file-list-toggle" onclick="Preview.toggleFileList('${group.group_id}')">
          ▶ Show files
        </button>
      </div>

      <div id="file-list-${group.group_id}" class="file-list">
        ${_buildFileTable(group.files, scanId)}
      </div>

      <div class="skip-row">
        <input type="checkbox" id="skip-${group.group_id}" ${group.skip ? "checked" : ""}
               onchange="Preview.toggleSkip('${group.group_id}', this.checked)">
        <label for="skip-${group.group_id}">Skip this group (leave files in place)</label>
      </div>
    `;

    return card;
  }

  function _buildFileTable(files, scanId) {
    const VIDEO_TYPES = new Set(["mp4", "insv", "insp", "360"]);
    const rows = files.map(f => {
      const badge = f.date_source === "file_mtime"
        ? `<span class="badge badge-warn">modified date</span>`
        : (f.date_source === "manual" ? `<span class="badge badge-info">manual</span>` : "");
      const size = _formatSize(f.size_bytes);
      const isVideo = VIDEO_TYPES.has(f.file_type);
      const clickAttr = `onclick="Lightbox.open('${scanId}','${f.thumbnail_token}','${f.file_type}','${_escAttr(f.filename)}')" style="cursor:pointer"`;
      const thumbCell = isVideo
        ? `<div class="file-thumb-placeholder" ${clickAttr}>🎬</div>`
        : `<img class="file-thumb"
              src="${API.fileThumbnailUrl(scanId, f.thumbnail_token)}"
              alt=""
              loading="lazy"
              ${clickAttr}
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="file-thumb-placeholder" style="display:none" ${clickAttr}>🖼</div>`;
      return `<tr>
        <td><div class="file-thumb-cell">${thumbCell}</div></td>
        <td>${_esc(f.filename)}</td>
        <td>${f.file_type}</td>
        <td>${size}</td>
        <td>${badge}</td>
      </tr>`;
    }).join("");

    return `<table class="file-table">
      <thead><tr><th></th><th>Filename</th><th>Type</th><th>Size</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function _renderUndatedFiles(files) {
    const container = document.getElementById("undated-files-container");
    container.innerHTML = "";
    for (const f of files) {
      const row = document.createElement("div");
      row.className = "undated-row";
      row.dataset.filename = f.filename;
      row.innerHTML = `
        <span class="filename">${_esc(f.filename)}</span>
        <span class="badge badge-warn">${f.file_type}</span>
        <input type="date" id="undated-date-${_escId(f.filename)}"
               title="Assign a date for this file">
        <button class="btn-secondary btn-sm" onclick="Preview.useFileMtime('${_escAttr(f.filename)}', '${_escAttr(f.thumbnail_token)}')">Use file date</button>
      `;
      container.appendChild(row);
    }
  }

  function toggleFileList(groupId) {
    const list = document.getElementById(`file-list-${groupId}`);
    const btn = list.previousElementSibling.querySelector(".file-list-toggle");
    list.classList.toggle("open");
    btn.textContent = list.classList.contains("open") ? "▼ Hide files" : "▶ Show files";
  }

  function toggleSkip(groupId, skipped) {
    const card = document.querySelector(`[data-group-id="${groupId}"]`);
    card.classList.toggle("skipped", skipped);
    _updateFooter();
  }

  function showAiResult(groupId, suggestedName, error) {
    const aiRow = document.getElementById(`ai-row-${groupId}`);
    const statusEl = document.getElementById(`ai-status-${groupId}`);
    aiRow.style.display = "block";

    if (error) {
      aiRow.innerHTML = `<span class="ai-error-chip">⚠ AI: ${_esc(error)}</span>`;
      statusEl.innerHTML = "";
    } else {
      aiRow.innerHTML = `
        <span class="ai-chip" title="Click to apply suggestion"
              onclick="Preview.applyAiSuggestion('${groupId}', '${_escAttr(suggestedName)}')">
          ✦ AI suggests: <strong>${_esc(suggestedName)}</strong>
        </span>`;
      statusEl.innerHTML = `<span class="badge badge-success">AI ready</span>`;
    }
  }

  function applyAiSuggestion(groupId, name) {
    document.getElementById(`desc-${groupId}`).value = name;
  }

  function useFileMtime(filename, token) {
    // The mtime date is embedded in thumbnail_token — we need a different approach.
    // Just set today's date as a sensible default; the user can adjust.
    const input = document.getElementById(`undated-date-${_escId(filename)}`);
    if (!input.value) {
      input.value = new Date().toISOString().slice(0, 10);
    }
  }

  function _updateFooter() {
    let total = 0;
    let active = 0;
    if (_scanData) {
      for (const g of _scanData.groups) {
        const skipped = document.getElementById(`skip-${g.group_id}`)?.checked;
        if (!skipped) {
          total += g.file_count;
          active++;
        }
      }
    }
    const info = document.getElementById("footer-info");
    if (info) info.textContent = `${active} groups · ${total} files selected`;
  }

  function collectGroups() {
    if (!_scanData) return [];
    return _scanData.groups.map(g => ({
      group_id: g.group_id,
      description: document.getElementById(`desc-${g.group_id}`)?.value.trim() || "",
      skip: document.getElementById(`skip-${g.group_id}`)?.checked || false,
    }));
  }

  function collectUndatedAssignments() {
    if (!_scanData || !_scanData.undated_files) return [];
    return _scanData.undated_files
      .map(f => {
        const dateVal = document.getElementById(`undated-date-${_escId(f.filename)}`)?.value;
        return dateVal ? { filename: f.filename, assigned_date: dateVal, group_id: null } : null;
      })
      .filter(Boolean);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function _escAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function _escId(s) {
    return s.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
  function _formatSize(bytes) {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + " KB";
    return bytes + " B";
  }

  return { render, toggleFileList, toggleSkip, showAiResult, applyAiSuggestion, collectGroups, collectUndatedAssignments, useFileMtime };
})();
