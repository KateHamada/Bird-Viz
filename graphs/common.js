// common.js: shared code for the Avotrex visualizations. Load this FIRST.
//
// Provides the eras, CSV loading, helpers, the era slider, and a tiny registry:
// map.js and charts.js each call registerRenderer(fn, elementIds), and every
// renderer is called as fn(all, visible) once the data loads and whenever the
// slider moves. Expects Plotly to be loaded before these scripts, and optionally
//   <div id="era-controls">   (the era slider is built here)

// Path to the CSV (commit the file to your repo). Each page can set
// window.AVOTREX_DATA_URL before loading this script; the fallback is relative
// to the page, which only works for a page at the site root.
const DATA_URL = window.AVOTREX_DATA_URL || 'data/Avotrex_traits_v1.csv';

// ---------- eras (the slider stops) ----------
// Each era lists the Avotrex status codes that belong to it. The slider is
// cumulative: moving to a later era keeps everything from the earlier ones.
const ERAS = [
  { label: 'Prehistoric / Pre-1500', window: '130,000 years ago – 1500 CE', statuses: ['EP', 'EPU'], color: '#8c6d31' },
  { label: 'Historical', window: 'Post-1500 CE', statuses: ['EX', 'EH'], color: '#7b3294' },
  { label: 'Edge of Extinction', window: 'Modern (captive / unconfirmed)', statuses: ['EW', 'CR'], color: '#d6604d' },
  { label: 'Present Day', window: 'Current (extant)', statuses: [], color: '#2166ac' }
];
const ERA_OF_STATUS = {};
ERAS.forEach((era, i) => era.statuses.forEach(s => (ERA_OF_STATUS[s] = i)));

// ---------- shared constants ----------
const FLIGHT_SCALE = [[0, '#b2182b'], [0.5, '#f7f7f7'], [1, '#2166ac']];
const ENDEM_COLORS = { insular: '#d95f02', continental: '#1b9e77' };

// Plotly config options
const config = {
  responsive: true,
  displayModeBar: true // map zoom/pan lives in the toolbar; set false to hide it
};

// ---------- data loading ----------
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const NUMERIC = ['lat', 'long', 'flight_ability', 'wing_length', 'tarsus_length', 'body_mass'];

function cleanRows(rows) {
  return rows
    .map(r => {
      const d = { ...r };
      NUMERIC.forEach(k => (d[k] = parseFloat(r[k])));
      d.status = (r.status || '').trim();
      // Era in which the species is lost. Unknown codes only appear at the last stop.
      d.era = ERA_OF_STATUS[d.status] ?? ERAS.length - 1;
      return d;
    })
    .filter(d => NUMERIC.every(k => Number.isFinite(d[k])));
}

async function loadAvotrex(url = DATA_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return cleanRows(parseCSV(await res.text()));
}

// ---------- helpers ----------
function makeSizer(all) {
  const logs = all.map(d => Math.log10(d.body_mass));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  // marker size scales with log body mass (computed on all species so sizes
  // don't change when the slider moves)
  return d => 6 + 22 * (Math.log10(d.body_mass) - lo) / (hi - lo || 1);
}

// Fixed log-axis range from all species, so axes don't jump when the slider moves
function logRange(all, key, pad = 0.1) {
  const logs = all.map(d => Math.log10(d[key]));
  return [Math.min(...logs) - pad, Math.max(...logs) + pad];
}

function hoverText(d) {
  return (
    `<b>${d.species}</b><br>${d.order} / ${d.family}<br>` +
    `Status: ${d.status} (${ERAS[d.era].label})<br>${d.archipelago}<br>` +
    `Flight ability: ${d.flight_ability} (${d.flight_imputation_type})<br>` +
    `Body mass: ${d.body_mass.toFixed(1)} g (${d.body_imputation_type})`
  );
}

// One trace per imputation type so open markers = imputed flight ability
function flightTraces(data, makeTrace) {
  return ['Literature', 'Imputed'].map((t, i) => {
    const sub = data.filter(d => d.flight_imputation_type === t);
    return makeTrace(sub, t, i);
  });
}

function flightMarker(sub, t, i, size) {
  return {
    size,
    symbol: t === 'Imputed' ? 'circle-open' : 'circle',
    color: sub.map(d => d.flight_ability),
    colorscale: FLIGHT_SCALE,
    cmin: 0,
    cmax: 1,
    line: { width: t === 'Imputed' ? 2 : 0.5, color: t === 'Imputed' ? undefined : '#444' },
    opacity: 0.8,
    showscale: i === 0,
    colorbar: { title: 'Flight ability', thickness: 12, len: 0.6 }
  };
}

// ---------- era slider ----------
const ERA_CSS = `
.era-slider { margin: 0 0 20px; }
.era-slider input[type=range] { display: block; box-sizing: border-box; }
.era-ticks { display: grid; gap: 8px; }
.era-tick { background: none; border: 0; border-top: 3px solid rgba(128,128,128,.35); color: inherit;
  font: inherit; font-size: .85rem; line-height: 1.35; padding: 8px 4px 4px; text-align: center; cursor: pointer; }
.era-tick[aria-pressed="true"] { border-top-color: currentColor; font-weight: 600; }
.era-tick span { display: block; font-weight: 400; opacity: .75; font-size: .78rem; }
.era-tick code { display: block; width: fit-content; margin: 4px auto 0; padding: 1px 6px; border-radius: 4px; font-size: .75rem;
  font-weight: 400; background: rgba(128,128,128,.18); }
.era-caption { margin: 8px 0 0; font-size: .85rem; opacity: .85; text-align: center; }
@media (max-width: 600px) { .era-tick span { display: none; } }
`;

// Builds the slider inside #containerId and calls onChange(eraIndex) when it moves.
// Returns the slider's starting era index.
function buildEraControls(containerId, all, onChange, startEra = ERAS.length - 1) {
  const box = document.getElementById(containerId);
  if (!box) return startEra;

  if (!document.getElementById('era-style')) {
    const style = document.createElement('style');
    style.id = 'era-style';
    style.textContent = ERA_CSS;
    document.head.appendChild(style);
  }

  const wrap = document.createElement('div');
  wrap.className = 'era-slider';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = ERAS.length - 1;
  slider.step = 1;
  slider.value = startEra;
  slider.setAttribute('aria-label', 'Era');
  // line the slider stops up with the centers of the label columns
  const pad = 50 / ERAS.length;
  slider.style.width = `${100 - 2 * pad}%`;
  slider.style.margin = `0 ${pad}% 4px`;

  const ticks = document.createElement('div');
  ticks.className = 'era-ticks';
  ticks.style.gridTemplateColumns = `repeat(${ERAS.length}, 1fr)`;

  const buttons = ERAS.map((era, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'era-tick';
    b.append(`${i + 1}. ${era.label}`);
    const win = document.createElement('span');
    win.textContent = era.window;
    const codes = document.createElement('code');
    codes.textContent = era.statuses.length ? era.statuses.join(', ') : 'Extant';
    b.append(win, codes);
    b.addEventListener('click', () => { slider.value = i; update(i); });
    ticks.appendChild(b);
    return b;
  });

  const caption = document.createElement('p');
  caption.className = 'era-caption';
  caption.setAttribute('aria-live', 'polite');

  function update(i) {
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    slider.setAttribute('aria-valuetext', ERAS[i].label);
    const shown = all.filter(d => d.era <= i).length;
    const codes = ERAS.slice(0, i + 1).flatMap(e => e.statuses);
    let text = `${shown} of ${all.length} species lost by this era (${codes.join(', ')})`;
    if (!all.some(d => d.era === i)) {
      text += i === ERAS.length - 1
        ? '. No extant species are in the traits file, so this matches the previous era.'
        : '. No species were added in this era.';
    }
    caption.textContent = text;
    onChange(i);
  }
  slider.addEventListener('input', () => update(Number(slider.value)));

  wrap.append(slider, ticks, caption);
  box.textContent = '';
  box.appendChild(wrap);
  update(startEra);
  return startEra;
}

// ---------- shared page wiring ----------
const state = { all: [], era: ERAS.length - 1, renderers: [] };

// fn(all, visible): all = every species, visible = species up to the chosen era
// elementIds: the page elements fn draws into (used for the load-error message)
function registerRenderer(fn, elementIds = []) {
  state.renderers.push({ fn, elementIds });
}

function visibleData() {
  return state.all.filter(d => d.era <= state.era);
}

function renderAll() {
  const visible = visibleData();
  state.renderers.forEach(r => {
    try { r.fn(state.all, visible); } catch (err) { console.error(err); }
  });
}

// Automatically load the data when the DOM is ready (scripts run before this fires)
document.addEventListener('DOMContentLoaded', async () => {
  try {
    state.all = await loadAvotrex();
    // builds the slider and draws everything once for the starting era
    state.era = buildEraControls('era-controls', state.all, i => { state.era = i; renderAll(); });
    if (!document.getElementById('era-controls')) renderAll();
  } catch (err) {
    console.error(err);
    state.renderers.forEach(r => r.elementIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Could not load the data: ' + err.message;
    }));
  }
});