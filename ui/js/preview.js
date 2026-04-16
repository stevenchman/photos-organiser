/**
 * Preview view — renders group cards, combine-groups mode, lightbox integration.
 */

const Preview = (() => {
  let _scanData = null;
  let _combineMode = false;
  let _selectedForCombine = new Set();
  let _galleryMode = localStorage.getItem("ph-view-mode") === "gallery";
  let _galleryScale = parseInt(localStorage.getItem("ph-gallery-scale") || "200", 10);

  // ── Render ─────────────────────────────────────────────────────────────────

  function render(scanData) {
    _scanData = scanData;
    _combineMode = false;
    _selectedForCombine.clear();

    const container = document.getElementById("groups-container");
    container.innerHTML = "";

    if (_galleryMode) {
      container.className = "gallery-grid";
      container.style.setProperty("--gallery-card-w", _galleryScale + "px");
      for (const group of scanData.groups) {
        container.appendChild(_buildGalleryCard(group, scanData.scan_id));
      }
    } else {
      container.className = "";
      container.style.removeProperty("--gallery-card-w");
      for (const group of scanData.groups) {
        container.appendChild(_buildGroupCard(group, scanData.scan_id));
      }
    }

    _syncViewButtons();

    const blurrySection = document.getElementById("blurry-section");
    if (scanData.blurry_files && scanData.blurry_files.length > 0) {
      blurrySection.style.display = "block";
      _renderBlurryFiles(scanData.blurry_files, scanData.scan_id);
    } else {
      blurrySection.style.display = "none";
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
    _initViewControls();
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
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${group._merged_from ? `
            <span class="badge badge-info" style="font-size:0.7rem;">&#x2B1C; ${group._merged_from.length + 1} groups combined</span>
            <button class="btn-secondary btn-sm" onclick="Preview.uncombineGroup('${group.group_id}')" style="font-size:0.72rem;padding:2px 8px;">Uncombine</button>
          ` : ""}
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

  // ── Gallery card ──────────────────────────────────────────────────────────

  function _buildGalleryCard(group, scanId) {
    const card = document.createElement("div");
    card.className = "gallery-card" + (group.skip ? " skipped" : "");
    card.dataset.groupId = group.group_id;

    const dateObj   = new Date(group.date + "T00:00:00");
    const dateLabel = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const sampleIsVideo = group.sample_file_type && ["mp4","insv","insp","360"].includes(group.sample_file_type);

    let thumbHtml;
    if (group.has_sample_image && group.sample_token) {
      thumbHtml = `<img class="gallery-thumb"
        src="${API.thumbnailUrl(scanId, group.group_id)}"
        alt=""
        onclick="Preview.openGroupLightbox('${scanId}','${group.group_id}','${group.sample_token}','${group.sample_file_type}','${_escAttr(group.proposed_folder_name)}')"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="gallery-thumb-placeholder" style="display:none"
          onclick="Preview.openGroupLightbox('${scanId}','${group.group_id}','${group.sample_token}','${group.sample_file_type}','${_escAttr(group.proposed_folder_name)}')">${sampleIsVideo ? "🎬" : "🖼"}</div>`;
    } else {
      thumbHtml = `<div class="gallery-thumb-placeholder">📷</div>`;
    }

    card.innerHTML = `
      <div class="gallery-thumb-wrap">
        ${thumbHtml}
        <div class="gallery-overlay-count">${group.file_count}</div>
        ${group._merged_from ? `<div class="gallery-overlay-combined">Combined</div>` : ""}
        <input type="checkbox" class="combine-checkbox gallery-combine-cb" data-group-id="${group.group_id}"
               style="display:none;position:absolute;top:6px;left:6px;accent-color:var(--amber);width:16px;height:16px" title="Select for combine">
      </div>
      <div class="gallery-info">
        <div class="gallery-date">${dateLabel}</div>
        <input type="text" id="desc-${group.group_id}"
               class="gallery-desc"
               placeholder="Add description…"
               value="${_escAttr(group.description || '')}"
               autocomplete="off">
        <label class="gallery-skip-label">
          <input type="checkbox" id="skip-${group.group_id}" ${group.skip ? "checked" : ""}
                 onchange="Preview.toggleSkip('${group.group_id}', this.checked)">
          Skip
        </label>
      </div>
    `;
    return card;
  }

  // ── View mode controls ─────────────────────────────────────────────────────

  function _syncViewButtons() {
    document.getElementById("view-list-btn")?.classList.toggle("active", !_galleryMode);
    document.getElementById("view-gallery-btn")?.classList.toggle("active", _galleryMode);
    const scaleWrap = document.getElementById("gallery-scale-wrap");
    if (scaleWrap) scaleWrap.style.display = _galleryMode ? "flex" : "none";
    const scaleEl = document.getElementById("gallery-scale");
    if (scaleEl) scaleEl.value = _galleryScale;
  }

  let _viewControlsInited = false;
  function _initViewControls() {
    _syncViewButtons();
    if (_viewControlsInited) return;
    _viewControlsInited = true;

    document.getElementById("view-list-btn")?.addEventListener("click", () => {
      _galleryMode = false;
      localStorage.setItem("ph-view-mode", "list");
      if (_scanData) render(_scanData);
    });
    document.getElementById("view-gallery-btn")?.addEventListener("click", () => {
      _galleryMode = true;
      localStorage.setItem("ph-view-mode", "gallery");
      if (_scanData) render(_scanData);
    });
    document.getElementById("gallery-scale")?.addEventListener("input", e => {
      _galleryScale = parseInt(e.target.value, 10);
      localStorage.setItem("ph-gallery-scale", _galleryScale);
      document.getElementById("groups-container")?.style.setProperty("--gallery-card-w", _galleryScale + "px");
    });
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
    if (_combineMode) return; // selecting for combine — don't open lightbox
    const group = _scanData?.groups.find(g => g.group_id === groupId);
    const filmstrip = (group?.files || []).map(f => ({
      token: f.thumbnail_token,
      file_type: f.file_type,
      filename: f.filename,
    }));
    Lightbox.open(scanId, token, fileType, filename, filmstrip);
  }

  function openFileLightbox(scanId, groupId, fileIndex, filename) {
    if (_combineMode) return;
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

  // ── Blurry files ───────────────────────────────────────────────────────────

  function _renderBlurryFiles(files, scanId) {
    const container = document.getElementById("blurry-files-container");
    container.innerHTML = "";
    for (const f of files) {
      const score = f.blur_score ?? 0;
      const pct   = Math.min(100, Math.round((score / 80) * 100)); // 80 = threshold
      let level, levelClass;
      if (score < 20)       { level = "Very blurry";     levelClass = "badge-danger"; }
      else if (score < 50)  { level = "Quite blurry";    levelClass = "badge-warn"; }
      else                  { level = "Slightly blurry"; levelClass = "badge-amber"; }

      const row = document.createElement("div");
      row.className = "blurry-row";
      row.innerHTML = `
        <input type="checkbox" class="blurry-keep-cb" data-token="${f.thumbnail_token}" checked
               title="Keep this photo">
        <img class="file-thumb blurry-thumb"
             src="${API.fileThumbnailUrl(scanId, f.thumbnail_token)}"
             alt=""
             onclick="Lightbox.open('${scanId}','${f.thumbnail_token}','${f.file_type}','${_escAttr(f.filename)}')"
             style="cursor:pointer"
             onerror="this.style.display='none'">
        <div class="blurry-info">
          <span class="blurry-name">${_esc(f.filename)}</span>
          <span class="badge ${levelClass}">${level}</span>
          <div class="blur-meter-track">
            <div class="blur-meter-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
      container.appendChild(row);
    }
  }

  function collectBlurSkips() {
    const skipped = [];
    document.querySelectorAll(".blurry-keep-cb").forEach(cb => {
      if (!cb.checked) skipped.push(cb.dataset.token);
    });
    return skipped;
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
    document.getElementById("groups-container")?.classList.add("combine-active");
    document.querySelectorAll(".combine-checkbox").forEach(cb => { cb.style.display = ""; });
    _updateCombineCount();
    // Make whole cards clickable — use named function so removeEventListener works
    document.querySelectorAll("[data-group-id]").forEach(card => {
      card.addEventListener("click", _onCardCombineClick);
    });
  }

  function _exitCombineMode() {
    _combineMode = false;
    _selectedForCombine.clear();
    document.getElementById("combine-toolbar").classList.remove("visible");
    document.getElementById("groups-container")?.classList.remove("combine-active");
    document.querySelectorAll(".combine-checkbox").forEach(cb => {
      cb.style.display = "none";
      cb.checked = false;
    });
    document.querySelectorAll(".selected-for-combine").forEach(c => c.classList.remove("selected-for-combine"));
    document.querySelectorAll("[data-group-id]").forEach(card => {
      card.removeEventListener("click", _onCardCombineClick);
    });
  }

  function _onCardCombineClick(e) {
    if (!_combineMode) return;
    // Let interactive elements (inputs, buttons, labels) handle their own clicks
    if (e.target.closest("input, button, a, label")) return;
    const groupId = this.dataset.groupId;
    if (!groupId) return;
    const cb = this.querySelector(".combine-checkbox");
    const nowSelected = !_selectedForCombine.has(groupId);
    if (nowSelected) {
      _selectedForCombine.add(groupId);
      this.classList.add("selected-for-combine");
      if (cb) cb.checked = true;
    } else {
      _selectedForCombine.delete(groupId);
      this.classList.remove("selected-for-combine");
      if (cb) cb.checked = false;
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
    const latest = targets[targets.length - 1];

    // Flatten merge history: if base was already a combined group, absorb its
    // prior _merged_from so uncombine always restores fully to original state.
    let allMergedFrom, originalBaseFiles, originalFolderName;
    if (base._merged_from) {
      allMergedFrom      = [...base._merged_from, ...others];
      originalBaseFiles  = base._original_files;
      originalFolderName = base._original_folder_name;
    } else {
      allMergedFrom      = others;
      originalBaseFiles  = [...base.files];
      originalFolderName = base.proposed_folder_name;
    }

    base._original_files       = originalBaseFiles;
    base._original_folder_name = originalFolderName;
    base._merged_from          = allMergedFrom;

    // Rebuild files: original base files + every merged group's current files
    base.files = [...originalBaseFiles];
    for (const g of allMergedFrom) {
      base.files.push(...g.files);
    }
    base.file_count = base.files.length;

    // Date range: start = base.date (earliest), end = latest across all constituents
    const allEndDates = allMergedFrom.map(g => g.end_date || g.date);
    const trueEndDate = allEndDates.reduce((max, d) => d > max ? d : max, base.date);
    if (trueEndDate !== base.date) {
      base.end_date = trueEndDate;
      const startShort = _isoToDisplay(base.date);
      const endShort   = _isoToDisplay(trueEndDate);
      base.proposed_folder_name = `${startShort}-${endShort}`;
    } else {
      base.end_date = null;
      base.proposed_folder_name = originalFolderName;
    }

    // Remove merged groups from scanData
    _scanData.groups = groups.filter(g => !ids.includes(g.group_id) || g.group_id === base.group_id);
    _scanData.group_count = _scanData.groups.length;

    // Re-render
    _exitCombineMode();
    render(_scanData);
  }

  function uncombineGroup(groupId) {
    const g = _scanData?.groups.find(g => g.group_id === groupId);
    if (!g || !g._merged_from) return;

    // Restore original state
    g.files               = g._original_files;
    g.file_count          = g._original_files.length;
    g.proposed_folder_name = g._original_folder_name;
    delete g.end_date;

    // Re-insert the split-off groups right after this one, sorted by date
    const idx = _scanData.groups.indexOf(g);
    _scanData.groups.splice(idx + 1, 0, ...g._merged_from);
    _scanData.group_count = _scanData.groups.length;

    delete g._merged_from;
    delete g._original_files;
    delete g._original_folder_name;

    render(_scanData);
  }

  // Convert ISO date string "2021-04-02" → "210402" (yymmdd)
  function _isoToDisplay(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
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
      group_id:         g.group_id,
      description:      document.getElementById(`desc-${g.group_id}`)?.value.trim() || "",
      skip:             document.getElementById(`skip-${g.group_id}`)?.checked || false,
      end_date:         g.end_date || null,
      merged_group_ids: g._merged_from ? g._merged_from.map(m => m.group_id) : null,
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
    collectGroups, collectUndatedAssignments, collectBlurSkips,
    useFileMtime,
    uncombineGroup,
  };
})();
