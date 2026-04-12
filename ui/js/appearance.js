/**
 * Appearance — Mango Design System integration.
 * Uses applyThemePackage() from themes.js and applyFont() from fonts.js.
 * Persists to localStorage under 'mango-theme-pkg', 'mango-font', 'mango-scale'.
 */

const Appearance = (() => {

  const DEFAULT_THEME = 'void';
  const DEFAULT_FONT  = 'poppins';
  const DEFAULT_SCALE = 15;

  // ── Bootstrap (before DOMContentLoaded to avoid flash) ──────────────────
  (function bootstrap() {
    const theme = localStorage.getItem('mango-theme-pkg') || DEFAULT_THEME;
    const font  = localStorage.getItem('mango-font')      || DEFAULT_FONT;
    const scale = parseInt(localStorage.getItem('mango-scale') || DEFAULT_SCALE, 10);
    applyThemePackage(theme);
    applyFont(font);
    document.documentElement.style.fontSize = scale + 'px';
  })();

  // ── Build theme grid ────────────────────────────────────────────────────
  function _buildThemeGrid() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const current = localStorage.getItem('mango-theme-pkg') || DEFAULT_THEME;

    Object.entries(THEMES).forEach(([key, t]) => {
      const card = document.createElement('button');
      card.className = 'settings-theme-card' + (key === current ? ' active' : '');
      card.dataset.theme = key;
      card.style.background = t.bg;
      card.innerHTML = `
        <span class="settings-theme-badge">${t.mode === 'light' ? '☀' : ''}</span>
        <div class="settings-theme-dot" style="background:${t.amber}"></div>
        <div class="settings-theme-name" style="color:${t.text}">${t.label}</div>
      `;
      card.addEventListener('click', () => {
        applyThemePackage(key);
        grid.querySelectorAll('.settings-theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === key));
      });
      grid.appendChild(card);
    });
  }

  // ── Build font grid ─────────────────────────────────────────────────────
  function _buildFontGrid() {
    const grid = document.getElementById('font-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const current = localStorage.getItem('mango-font') || DEFAULT_FONT;

    Object.entries(FONT_OPTIONS).forEach(([key, f]) => {
      const btn = document.createElement('button');
      btn.className = 'settings-font-btn' + (key === current ? ' active' : '');
      btn.dataset.font = key;
      btn.style.fontFamily = f.family;
      btn.textContent = f.label;
      btn.addEventListener('click', () => {
        applyFont(key);
        grid.querySelectorAll('.settings-font-btn').forEach(b => b.classList.toggle('active', b.dataset.font === key));
      });
      grid.appendChild(btn);
    });
  }

  // ── Scale buttons ───────────────────────────────────────────────────────
  function _initScale() {
    const current = parseInt(localStorage.getItem('mango-scale') || DEFAULT_SCALE, 10);
    document.querySelectorAll('.scale-option').forEach(btn => {
      const val = parseInt(btn.dataset.scale, 10);
      btn.classList.toggle('active', val === current);
      btn.addEventListener('click', () => {
        document.documentElement.style.fontSize = val + 'px';
        localStorage.setItem('mango-scale', val);
        document.querySelectorAll('.scale-option').forEach(b => b.classList.toggle('active', parseInt(b.dataset.scale, 10) === val));
      });
    });
  }

  // ── Open / close ────────────────────────────────────────────────────────
  function _open() {
    _buildThemeGrid();
    _buildFontGrid();
    _initScale();
    document.getElementById('appearance-overlay').classList.add('open');
  }

  function _close() {
    document.getElementById('appearance-overlay').classList.remove('open');
  }

  function init() {
    document.getElementById('appearance-btn').addEventListener('click', _open);
    document.getElementById('appearance-close').addEventListener('click', _close);
    document.getElementById('appearance-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('appearance-overlay')) _close();
    });
  }

  return { init };
})();

Appearance.init();
