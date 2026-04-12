/**
 * Mango Design System — Theme Definitions
 *
 * Each theme defines the full set of CSS variable values.
 * Pass a theme key to applyThemePackage(key) to switch themes.
 *
 * Fields:
 *   label       Display name shown in settings
 *   mode        'dark' | 'light' — sets html[data-theme]
 *   bg          Page background colour
 *   surface     Raised surface (cards, inputs)
 *   panel       Panels, sidebars, overlays
 *   border      Subtle divider / border
 *   border2     Slightly stronger border
 *   amber       Accent colour (all highlights)
 *   amberDim    Darker accent (pressed/hover)
 *   amberGlow   Low-opacity accent (rgba string)
 *   glassBg     Glass panel background (rgba string)
 *   glassBorder Glass panel border (rgba string)
 *   text        Primary text
 *   textDim     Tertiary / label text
 *   textMid     Secondary text
 *   textMuted   Placeholder / muted text
 *   grad        CSS background gradient for the html element
 */

const THEMES = {
  // ── Dark ──────────────────────────────────────────────────────────────
  void:     { label:'Void',     mode:'dark',  bg:'#040609', surface:'#090c18', panel:'#0e1222', border:'#181e32', border2:'#202640', amber:'#FF8C00', amberDim:'#cc7000', amberGlow:'rgba(255,140,0,0.10)', glassBg:'rgba(6,8,18,0.52)',   glassBorder:'rgba(255,255,255,0.08)', text:'#dde2ef', textDim:'#404c6a', textMid:'#7a86a8', textMuted:'#606880', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(0,210,80,0.22) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(110,0,210,0.24) 0%,transparent 52%),radial-gradient(ellipse 55% 65% at 5% 40%,rgba(0,150,210,0.20) 0%,transparent 52%),radial-gradient(ellipse 40% 40% at 50% 50%,rgba(0,70,150,0.10) 0%,transparent 60%),#040609' },
  obsidian: { label:'Obsidian', mode:'dark',  bg:'#080808', surface:'#111111', panel:'#181818', border:'#242424', border2:'#303030', amber:'#f59e0b', amberDim:'#d07c05', amberGlow:'rgba(245,158,11,0.10)', glassBg:'rgba(0,0,0,0.60)',    glassBorder:'rgba(255,255,255,0.07)', text:'#e8e2d8', textDim:'#4a4540', textMid:'#8a8070', textMuted:'#686060', grad:'radial-gradient(ellipse 55% 55% at 80% 20%,rgba(245,158,11,0.18) 0%,transparent 55%),radial-gradient(ellipse 60% 60% at 20% 80%,rgba(180,80,0,0.14) 0%,transparent 55%),#080808' },
  forest:   { label:'Forest',   mode:'dark',  bg:'#030d06', surface:'#071408', panel:'#0a1c0c', border:'#122010', border2:'#1a2e18', amber:'#4ec97a', amberDim:'#35a05a', amberGlow:'rgba(78,201,122,0.10)',  glassBg:'rgba(3,12,6,0.55)',   glassBorder:'rgba(78,201,122,0.08)',  text:'#d8eedd', textDim:'#3a5e40', textMid:'#6a9870', textMuted:'#507858', grad:'radial-gradient(ellipse 55% 60% at 85% 15%,rgba(0,200,60,0.26) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 10% 85%,rgba(0,120,40,0.22) 0%,transparent 52%),#030d06' },
  dusk:     { label:'Dusk',     mode:'dark',  bg:'#08040f', surface:'#100820', panel:'#160d2a', border:'#22163a', border2:'#301e50', amber:'#a855f7', amberDim:'#8b3de0', amberGlow:'rgba(168,85,247,0.12)',  glassBg:'rgba(8,4,16,0.55)',   glassBorder:'rgba(168,85,247,0.10)', text:'#e8ddf8', textDim:'#4a3a6a', textMid:'#8a70b8', textMuted:'#6a5090', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(140,0,255,0.28) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(200,0,180,0.22) 0%,transparent 52%),#08040f' },
  ember:    { label:'Ember',    mode:'dark',  bg:'#0d0602', surface:'#160c04', panel:'#1e1206', border:'#2e1a08', border2:'#3e2210', amber:'#f97316', amberDim:'#d45f05', amberGlow:'rgba(249,115,22,0.12)',  glassBg:'rgba(12,6,2,0.55)',   glassBorder:'rgba(249,115,22,0.08)',  text:'#f0e0d0', textDim:'#5a3820', textMid:'#a07050', textMuted:'#806040', grad:'radial-gradient(ellipse 55% 60% at 85% 15%,rgba(255,80,0,0.28) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 80%,rgba(200,40,0,0.22) 0%,transparent 52%),#0d0602' },
  glacier:  { label:'Glacier',  mode:'dark',  bg:'#060a12', surface:'#0c1220', panel:'#10182c', border:'#182236', border2:'#202e46', amber:'#4d9fff', amberDim:'#2a7de0', amberGlow:'rgba(77,159,255,0.12)',  glassBg:'rgba(6,10,20,0.55)',  glassBorder:'rgba(77,159,255,0.08)',  text:'#d8e4f8', textDim:'#3a4e6a', textMid:'#6a80a8', textMuted:'#506080', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(0,100,255,0.24) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(0,50,200,0.20) 0%,transparent 52%),#060a12' },
  midnight: { label:'Midnight', mode:'dark',  bg:'#03050e', surface:'#080c1a', panel:'#0c1024', border:'#141826', border2:'#1c2234', amber:'#f43f5e', amberDim:'#c0243e', amberGlow:'rgba(244,63,94,0.10)',   glassBg:'rgba(3,5,14,0.60)',   glassBorder:'rgba(244,63,94,0.08)',   text:'#e8d8e0', textDim:'#503050', textMid:'#907080', textMuted:'#705060', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(255,0,60,0.22) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(100,0,80,0.20) 0%,transparent 52%),#03050e' },
  storm:    { label:'Storm',    mode:'dark',  bg:'#0a0c10', surface:'#141820', panel:'#1c2028', border:'#262c38', border2:'#323844', amber:'#94a3b8', amberDim:'#64748b', amberGlow:'rgba(148,163,184,0.10)', glassBg:'rgba(10,12,16,0.58)', glassBorder:'rgba(255,255,255,0.07)', text:'#e2e8f0', textDim:'#3a4455', textMid:'#647080', textMuted:'#506070', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(80,100,140,0.22) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(50,70,100,0.18) 0%,transparent 52%),#0a0c10' },
  crimson:  { label:'Crimson',  mode:'dark',  bg:'#0e0303', surface:'#180606', panel:'#200a0a', border:'#321010', border2:'#421818', amber:'#ef4444', amberDim:'#b91c1c', amberGlow:'rgba(239,68,68,0.12)',   glassBg:'rgba(14,3,3,0.58)',   glassBorder:'rgba(239,68,68,0.08)',   text:'#fde8e8', textDim:'#5a2020', textMid:'#a85050', textMuted:'#804040', grad:'radial-gradient(ellipse 55% 60% at 85% 15%,rgba(220,0,0,0.28) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 80%,rgba(160,0,0,0.22) 0%,transparent 52%),#0e0303' },
  neon:     { label:'Neon',     mode:'dark',  bg:'#000000', surface:'#080810', panel:'#0c0c18', border:'#141428', border2:'#1c1c34', amber:'#FF8C00', amberDim:'#cc7000', amberGlow:'rgba(255,140,0,0.12)',   glassBg:'rgba(0,0,0,0.70)',    glassBorder:'rgba(255,140,0,0.10)',   text:'#e0fff8', textDim:'#204040', textMid:'#40a090', textMuted:'#306060', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(255,140,0,0.20) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(0,100,255,0.18) 0%,transparent 52%),#000000' },
  mocha:    { label:'Mocha',    mode:'dark',  bg:'#0c0906', surface:'#160e0a', panel:'#1e140e', border:'#2e1e16', border2:'#3e2a1e', amber:'#cd8b5a', amberDim:'#a86a3a', amberGlow:'rgba(205,139,90,0.12)',  glassBg:'rgba(12,9,6,0.58)',   glassBorder:'rgba(205,139,90,0.08)',  text:'#f0e0d0', textDim:'#5a4030', textMid:'#a07060', textMuted:'#806050', grad:'radial-gradient(ellipse 55% 60% at 80% 20%,rgba(200,100,40,0.22) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 20% 80%,rgba(140,60,20,0.18) 0%,transparent 52%),#0c0906' },
  ocean:    { label:'Ocean',    mode:'dark',  bg:'#020d12', surface:'#051620', panel:'#082030', border:'#0e2a3e', border2:'#143550', amber:'#06b6d4', amberDim:'#0891b2', amberGlow:'rgba(6,182,212,0.10)',   glassBg:'rgba(2,12,18,0.58)',  glassBorder:'rgba(6,182,212,0.08)',   text:'#d0f0f8', textDim:'#204050', textMid:'#408090', textMuted:'#306070', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(0,180,220,0.24) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(0,100,180,0.20) 0%,transparent 52%),#020d12' },
  // ── Light ─────────────────────────────────────────────────────────────
  sand:     { label:'Sand',     mode:'light', bg:'#f5f0e8', surface:'#ede8dc', panel:'#e8e0d0', border:'#d8d0c0', border2:'#c8c0b0', amber:'#c97c00', amberDim:'#a06000', amberGlow:'rgba(201,124,0,0.12)',  glassBg:'rgba(245,240,232,0.70)', glassBorder:'rgba(0,0,0,0.08)', text:'#2a2010', textDim:'#8a7a60', textMid:'#6a5a40', textMuted:'#7a6a50', grad:'radial-gradient(ellipse 55% 60% at 85% 15%,rgba(245,180,80,0.28) 0%,transparent 52%),radial-gradient(ellipse 60% 55% at 15% 85%,rgba(220,150,50,0.20) 0%,transparent 52%),#f5f0e8' },
  arctic:   { label:'Arctic',   mode:'light', bg:'#e8f0f8', surface:'#dde8f0', panel:'#d4e0ec', border:'#c0d0e0', border2:'#a8c0d8', amber:'#2266cc', amberDim:'#1a4ea0', amberGlow:'rgba(34,102,204,0.12)', glassBg:'rgba(232,240,248,0.70)', glassBorder:'rgba(0,0,0,0.08)', text:'#18202e', textDim:'#6080a0', textMid:'#406088', textMuted:'#507090', grad:'radial-gradient(ellipse 55% 60% at 88% 8%,rgba(0,120,220,0.16) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 88%,rgba(0,80,180,0.12) 0%,transparent 52%),#e8f0f8' },
  chalk:    { label:'Chalk',    mode:'light', bg:'#f8f8f6', surface:'#f0f0ec', panel:'#e8e8e2', border:'#dcdcd4', border2:'#cecec4', amber:'#6366f1', amberDim:'#4f52cc', amberGlow:'rgba(99,102,241,0.10)', glassBg:'rgba(248,248,246,0.75)', glassBorder:'rgba(0,0,0,0.06)', text:'#1a1a2e', textDim:'#888898', textMid:'#555568', textMuted:'#707080', grad:'radial-gradient(ellipse 55% 60% at 85% 15%,rgba(100,100,240,0.12) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 85%,rgba(80,80,200,0.08) 0%,transparent 52%),#f8f8f6' },
  petal:    { label:'Petal',    mode:'light', bg:'#fdf0f4', surface:'#f8e8ee', panel:'#f0dde5', border:'#e8d0da', border2:'#dcc0cc', amber:'#db2777', amberDim:'#be185d', amberGlow:'rgba(219,39,119,0.10)', glassBg:'rgba(253,240,244,0.75)', glassBorder:'rgba(0,0,0,0.06)', text:'#2a1020', textDim:'#9a7080', textMid:'#7a5060', textMuted:'#886070', grad:'radial-gradient(ellipse 55% 60% at 85% 15%,rgba(240,100,160,0.20) 0%,transparent 52%),radial-gradient(ellipse 65% 55% at 15% 85%,rgba(200,60,120,0.14) 0%,transparent 52%),#fdf0f4' },
  // Custom theme — populated at runtime by buildCustomTheme()
  custom:   { label:'Custom',   mode:'dark',  bg:'#0a0c10', surface:'#141820', panel:'#1c2028', border:'#262c38', border2:'#323844', amber:'#FF8C00', amberDim:'#cc7000', amberGlow:'rgba(255,140,0,0.10)', glassBg:'rgba(10,12,16,0.58)', glassBorder:'rgba(255,255,255,0.07)', text:'#e2e8f0', textDim:'#3a4455', textMid:'#647080', textMuted:'#506070', grad:'conic-gradient(from 0deg,#f43f5e33,#f97316,#4d9fff66,#a855f733,#FF8C0033,#f43f5e33)' },
};

// ── Custom theme builder ───────────────────────────────────────────────
// Call this before applying the 'custom' theme to rebuild it from stored prefs.
function buildCustomTheme() {
  const base   = localStorage.getItem('mango-custom-base')   || 'dark';
  const accent = localStorage.getItem('mango-custom-accent') || '#FF8C00';
  const source = base === 'light' ? THEMES.chalk : THEMES.storm;
  const dim    = _darkenHex(accent, 25);
  THEMES.custom = {
    ...source,
    label: 'Custom',
    mode:  base,
    amber: accent,
    amberDim:    dim,
    amberGlow:   _hexToRgba(accent, 0.10),
    glassBorder: _hexToRgba(accent, 0.08),
    grad: `radial-gradient(ellipse 60% 60% at 80% 20%,${_hexToRgba(accent,0.20)} 0%,transparent 55%),radial-gradient(ellipse 55% 55% at 20% 80%,${_hexToRgba(accent,0.14)} 0%,transparent 55%),${source.bg}`,
  };
}

function _darkenHex(hex, pct) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  const f = 1 - pct/100;
  return '#' + [r,g,b].map(c => Math.max(0,Math.round(c*f)).toString(16).padStart(2,'0')).join('');
}
function _hexToRgba(hex, a) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Apply theme ────────────────────────────────────────────────────────
function applyThemePackage(key) {
  if (key === 'custom') buildCustomTheme();
  const t = THEMES[key] || THEMES.void;
  const r = document.documentElement;
  const b = document.body;
  const vars = {
    '--bg': t.bg, '--surface': t.surface, '--panel': t.panel,
    '--border': t.border, '--border2': t.border2,
    '--amber': t.amber, '--amber-dim': t.amberDim, '--amber-glow': t.amberGlow,
    '--glass-bg': t.glassBg, '--glass-border': t.glassBorder,
    '--text': t.text, '--text-dim': t.textDim, '--text-mid': t.textMid, '--text-muted': t.textMuted,
  };
  [r, b].forEach(el => {
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  });
  r.style.background = t.grad;
  r.dataset.theme = t.mode;
  localStorage.setItem('mango-theme-pkg', key);
  localStorage.setItem('mango-theme-mode', t.mode);
}

if (typeof module !== 'undefined') module.exports = { THEMES, buildCustomTheme, applyThemePackage };
