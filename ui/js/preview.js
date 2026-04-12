/**
 * Preview view — renders group cards, combine-groups mode, lightbox integration.
 */

const Preview = (() => {
  let _scanData = null;
  let _combineMode = false;
  let _selectedForCombine = new Set();

  // ── Render ─────────────────────────────────────────────────────────────────

  function render(scanData) {
    _scanData = scanData;
    _combineMode = false;
    _selectedForCombine.clear();

    const container = document.getElementById("groups-container");
    container.innerHTML = "";
    for (const group of scanData.groups) {
      container.appendChild(_buildGroupCard(group, scanData.scan_id));
    }

    const undatedSection = document.getElementById("undated-section");
    if (scanData.undated_files && scanData.undated_files.length > 0) {
      undatedSection.style.display = "block";
      _renderUndatedFiles(scanData.undated_files);
    } else {
      undatedSection.style.display = "none";
    }

    _updateFooter();
    _initCombineMode();
  }

  // ── Group card ─────────────────────────────────────────────────────────────

  function _buildGroupCard(group, scanId) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.groupId = group.group_id;
    if (group.skip) card.classList.add("skipped");

    const dateObj   = new Date(group.date + "T00:00:00");
    const dateLabel = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const fileWord  = group.file_count === 1 ? "file" : "files";

    const sampleIsVideo = group.sample_file_type && ["mp4","insv","insp","360"].includes(group.sample_file_type);
    let thumbHtml;
    if (group.has_sample_image && group.sample_token) {
      const filmstripAttr = `data-group-id="${group.group_id}"`;
      thumbHtml = `<img class="thumb thumb-clickable"
        src="${API.thumbnailUrl(scanId, group.group_id)}"
        alt="thumbnail"
        onclick="Preview.openGroupLightbox('${scanId}','${group.group_id}','${group.sample_token}','${group.sample_file_type}','${_escAttr(group.proposed_folder_name)}')"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="thumb-placeholder" style="display:none"
          onclick="Preview.openGroupLightbox('${scanId}','${group.group_id}','${group.sample_token}','${group.sample_file_type}','${_escAttr(group.proposed_folder_name)}')"
          style="cursor:pointer">${sampleIsVideo ? "🎬" : "🖼"}</div>`;
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
          <input type="checkbox" class="combine-checkbox" data-group-id="${group.group_id}"
                 style="display:none;accent-color:var(--amber)" title="Select for combine">
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
        ${_buildFileTable(group.files, scanId, group.group_id)}
      </div>

      <div class="skip-row">
        <input type="checkbox" id="skip-${group.group_id}" ${group.skip ? "checked" : ""}
               onchange="Preview.toggleSkip('${group.group_id}', this.checked)">
        <label for="skip-${group.group_id}">Skip this group</label>
      </div>
    `;

    return card;
  }

  // ── File table ─────────────────────────────────────────────────────────────

  function _buildFileTable(files, scanId, groupId) {
    const VIDEO_TYPES = new Set(["mp4", "insv", "insp", "360"]);
    const rows = files.map((f, i) => {
      const badge = f.date_source === "file_mtime"
        ? `<span class="badge badge-warn">modified date</span>`
        : (f.date_source === "manual" ? `<span class="badge badge-info">manual</span>` : "");
      const size = _formatSize(f.size_bytes);
      const isVideo = VIDEO_TYPES.has(f.file_type);
      const clickAttr = `onclick="Preview.openFileLightbox('${scanId}','${groupId}',${i},'${_escAttr(f.filename)}')" style="cursor:pointer"`;
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

  // ── Lightbox openers ───────────────────────────────────────────────────────

  function openGroupLightbox(scanId, groupId, token, fileType, filename) {
    const group = _scanData?.groups.find(g => g.group_id === groupId);
    const filmstrip = (group?.files || []).map(f => ({
      token: f.thumbnail_token,
      file_type: f.file_type,
      filename: f.filename,
    }));
    Lightbox.open(scanId, token, fileType, filename, filmstrip);
  }

  function openFileLightbox(scanId, groupId, fileIndex, filename) {
    const group = _scanData?.groups.find(g => g.group_id === groupId);
    if (!group) return;
    const file = group.files[fileIndex];
    if (!file) return;
    const filmstrip = group.files.map(f => ({
      token: f.thumbnail_token,
      file_type: f.file_type,
      filename: f.filename,
    }));
    Lightbox.open(scanId, file.thumbnail_token, file.file_type, filename, filmstrip);
  }

  // ── Undated files ──────────────────────────────────────────────────────────

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
        <input type="date" id="undated-date-${_escId(f.filename)}" title="Assign a date for this file">
        <button class="btn-secondary btn-sm"
                onclick="Preview.useFileMtime('${_escAttr(f.filename)}')">Use file date</button>
      `;
      container.appendChild(row);
    }
  }

  // ── Combine groups mode ────────────────────────────────────────────────────

  function _initCombineMode() {
    const modeBtn   = document.getElementById("combine-mode-btn");
    const doBtn     = document.getElementById("combine-do-btn");
    const cancelBtn = document.getElementById("combine-cancel-btn");
    if (!modeBtn) return;

    modeBtn.addEventListener("click", _enterCombineMode);
    doBtn.addEventListener("click",   _doMerge);
    cancelBtn.addEventListener("click", _exitCombineMode);
  }

  function _enterCombineMode() {
    _combineMode = true;
    _selectedForCombine.clear();
    document.getElementById("combine-toolbar").classList.add("visible");
    document.querySelectorAll(".combine-checkbox").forEach(cb => { cb.style.display = ""; });
    _updateCombineCount();
    document.querySelectorAll(".combine-checkbox").forEach(cb => {
      cb.addEventListener("change", _onCombineCheckChange);
    });
  }

  function _exitCombineMode() {
    _combineMode = false;
    _selectedForCombine.clear();
    document.getElementById("combine-toolbar").classList.remove("visible");
    document.querySelectorAll(".combine-checkbox").forEach(cb => {
      cb.style.display = "none";
      cb.checked = false;
    });
    document.querySelectorAll(".card.selected-for-combine").forEach(c => c.classList.remove("selected-for-combine"));
  }

  function _onCombineCheckChange(e) {
    const groupId = e.target.dataset.groupId;
    const card    = document.querySelector(`[data-group-id="${groupId}"]`);
    if (e.target.checked) {
      _selectedForCombine.add(groupId);
      card?.classList.add("selected-for-combine");
    } else {
      _selectedForCombine.delete(groupId);
      card?.classList.remove("selected-for-combine");
    }
    _updateCombineCount();
  }

  function _updateCombineCount() {
    const n = _selectedForCombine.size;
    const el = document.getElementById("combine-count-label");
    if (el) el.textContent = `${n} group${n !== 1 ? "s" : ""} selected`;
    const doBtn = document.getElementById("combine-do-btn");
    if (doBtn) doBtn.disabled = n < 2;
  }

  function _doMerge() {
    if (_selectedForCombine.size < 2 || !_scanData) return;

    const ids     = Array.from(_selectedForCombine);
    const groups  = _scanData.groups;
    const targets = groups.filter(g => ids.includes(g.group_id));

    if (!targets.length) return;

    // Sort by date, keep earliest as base
    targets.sort((a, b) => a.date < b.date ? -1 : 1);
    const base   = targets[0];
    const others = targets.slice(1);

    for (const g of others) {
      base.files.push(...g.files);
    }
    base.file_count = base.files.length;

    // Remove merged groups from scanData
    _scanData.groups = groups.filter(g => !ids.includes(g.group_id) || g.group_id === base.group_id);
    _scanData.group_count = _scanData.groups.length;

    // Re-render
    _exitCombineMode();
    render(_scanData);
  }

  // ── Public card controls ───────────────────────────────────────────────────

  function toggleFileList(groupId) {
    const list = document.getElementById(`file-list-${groupId}`);
    const btn  = list.previousElementSibling.querySelector(".file-list-toggle");
    list.classList.toggle("open");
    btn.textContent = list.classList.contains("open") ? "▼ Hide files" : "▶ Show files";
  }

  function toggleSkip(groupId, skipped) {
    const card = document.querySelector(`[data-group-id="${groupId}"]`);
    card.classList.toggle("skipped", skipped);
    _updateFooter();
  }

  function showAiResult(groupId, suggestedName, error) {
    const aiRow   = document.getElementById(`ai-row-${groupId}`);
    const statusEl = document.getElementById(`ai-status-${groupId}`);
    aiRow.style.display = "block";
    if (error) {
      aiRow.innerHTML = `<span class="ai-error-chip">⚠ AI: ${_esc(error)}</span>`;
      statusEl.innerHTML = "";
    } else {
      aiRow.innerHTML = `
        <span class="ai-chip" title="Click to apply"
              onclick="Preview.applyAiSuggestion('${groupId}', '${_escAttr(suggestedName)}')">
          ✦ AI suggests: <strong>${_esc(suggestedName)}</strong>
        </span>`;
      statusEl.innerHTML = `<span class="badge badge-success">AI ready</span>`;
    }
  }

  function applyAiSuggestion(groupId, name) {
    document.getElementById(`desc-${groupId}`).value = name;
  }

  function useFileMtime(filename) {
    const input = document.getElementById(`undated-date-${_escId(filename)}`);
    if (input && !input.value) input.value = new Date().toISOString().slice(0, 10);
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  function _updateFooter() {
    let total = 0, active = 0;
    if (_scanData) {
      for (const g of _scanData.groups) {
        const skipped = document.getElementById(`skip-${g.group_id}`)?.checked;
        if (!skipped) { total += g.file_count; active++; }
      }
    }
    const info = document.getElementById("footer-info");
    if (info) info.textContent = `${active} group${active !== 1 ? "s" : ""} · ${total} files selected`;
  }

  // ── Collect for confirm ────────────────────────────────────────────────────

  function collectGroups() {
    if (!_scanData) return [];
    return _scanData.groups.map(g => ({
      group_id:    g.group_id,
      description: document.getElementById(`desc-${g.group_id}`)?.value.trim() || "",
      skip:        document.getElementById(`skip-${g.group_id}`)?.checked || false,
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

  function _esc(s)      { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function _escAttr(s)  { return String(s).replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function _escId(s)    { return s.replace(/[^a-zA-Z0-9_-]/g, "_"); }
  function _formatSize(bytes) {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + " KB";
    return bytes + " B";
  }

  return {
    render,
    toggleFileList, toggleSkip,
    showAiResult, applyAiSuggestion,
    openGroupLightbox, openFileLightbox,
    collectGroups, collectUndatedAssignments,
    useFileMtime,
  };
})();
