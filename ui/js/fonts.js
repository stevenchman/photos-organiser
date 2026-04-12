/**
 * Mango Design System — Font Options
 *
 * All fonts are loaded from Google Fonts.
 * Copy the <link> tag below into your HTML <head>.
 * Call applyFont(key) to switch fonts at runtime.
 */

// Google Fonts link — paste into HTML <head>
const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Sora:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Nunito:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Oswald:wght@300;400;500;600;700&family=Bebas+Neue&family=Playfair+Display:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@300;400;700&family=EB+Garamond:wght@400;500;600;700&family=Cormorant+Garamond:wght@300;400;500;600;700&family=DM+Serif+Display&family=Libre+Baskerville:wght@400;700&family=Spectral:wght@300;400;500;600;700&display=swap" rel="stylesheet">`;

const FONT_OPTIONS = {
  // ── Sans-serif ──
  poppins:       { label: 'Poppins',          family: "'Poppins', sans-serif",            group: 'sans' },
  inter:         { label: 'Inter',            family: "'Inter', sans-serif",              group: 'sans' },
  outfit:        { label: 'Outfit',           family: "'Outfit', sans-serif",             group: 'sans' },
  'dm-sans':     { label: 'DM Sans',          family: "'DM Sans', sans-serif",            group: 'sans' },
  nunito:        { label: 'Nunito',           family: "'Nunito', sans-serif",             group: 'sans' },
  sora:          { label: 'Sora',             family: "'Sora', sans-serif",               group: 'sans' },
  raleway:       { label: 'Raleway',          family: "'Raleway', sans-serif",            group: 'sans' },
  'space-grotesk': { label: 'Space Grotesk',  family: "'Space Grotesk', sans-serif",      group: 'sans' },
  oswald:        { label: 'Oswald',           family: "'Oswald', sans-serif",             group: 'sans' },
  bebas:         { label: 'Bebas Neue',       family: "'Bebas Neue', sans-serif",         group: 'sans' },
  mono:          { label: 'JetBrains Mono',   family: "'JetBrains Mono', monospace",      group: 'sans' },
  system:        { label: 'System UI',        family: 'system-ui, sans-serif',            group: 'sans' },
  // ── Serif ──
  playfair:      { label: 'Playfair Display', family: "'Playfair Display', serif",        group: 'serif' },
  lora:          { label: 'Lora',             family: "'Lora', serif",                    group: 'serif' },
  merriweather:  { label: 'Merriweather',     family: "'Merriweather', serif",            group: 'serif' },
  'eb-garamond': { label: 'EB Garamond',      family: "'EB Garamond', serif",             group: 'serif' },
  cormorant:     { label: 'Cormorant',        family: "'Cormorant Garamond', serif",      group: 'serif' },
  'dm-serif':    { label: 'DM Serif',         family: "'DM Serif Display', serif",        group: 'serif' },
  baskerville:   { label: 'Baskerville',      family: "'Libre Baskerville', serif",       group: 'serif' },
  spectral:      { label: 'Spectral',         family: "'Spectral', serif",               group: 'serif' },
};

function applyFont(key) {
  const f = FONT_OPTIONS[key] || FONT_OPTIONS.poppins;
  const r = document.documentElement;
  r.style.setProperty('--font-body',  f.family);
  r.style.setProperty('--font-ui',    f.family);
  r.style.setProperty('--font-title', f.family);
  localStorage.setItem('mango-font', key);
}

if (typeof module !== 'undefined') module.exports = { FONT_OPTIONS, FONTS_LINK, applyFont };
