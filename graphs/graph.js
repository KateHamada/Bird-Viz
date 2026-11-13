// Avotrex extinct-bird visualizations using Plotly.js
// Expects Plotly to be loaded first, and these elements on the page:
//   <select id="map-color">  (optional)  <div id="map-chart">  <div id="island-chart">  <div id="scatter-chart">

// Path to the CSV, relative to the page (commit the file to your repo)
const DATA_URL = 'data/Avotrex_traits_v1.csv';

// ---------- shared constants ----------
const FLIGHT_SCALE = [[0, '#b2182b'], [0.5, '#f7f7f7'], [1, '#2166ac']];
const ENDEM_COLORS = { insular: '#d95f02', continental: '#1b9e77' };
const STATUS_COLORS = { EX: '#7b3294', EP: '#1b7837', EH: '#e08214', EW: '#2166ac', EPU: '#999999', CR: '#d6604d' };

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
function makeSizer(data) {
  const logs = data.map(d => Math.log10(d.body_mass));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  // marker size scales with log body mass
  return d => 6 + 22 * (Math.log10(d.body_mass) - lo) / (hi - lo || 1);
}

function hoverText(d) {
  return (
    `<b>${d.species}</b><br>${d.order} / ${d.family}<br>` +
    `Status: ${d.status}<br>${d.archipelago}<br>` +
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

// ---------- 1. map of where species lived ----------
function renderMap(data, elementId = 'map-chart', colorBy = 'flight') {
  const sizeOf = makeSizer(data);
  let traces;

  if (colorBy === 'flight') {
    traces = flightTraces(data, (sub, t, i) => ({
      type: 'scattergeo',
      mode: 'markers',
      name: 'Flight: ' + t,
      lat: sub.map(d => d.lat),
      lon: sub.map(d => d.long),
      text: sub.map(hoverText),
      hoverinfo: 'text',
      marker: flightMarker(sub, t, i, sub.map(sizeOf))
    }));
  } else {
    const key = colorBy === 'status' ? 'status' : 'island_endemicity';
    const colors = colorBy === 'status' ? STATUS_COLORS : ENDEM_COLORS;
    traces = [...new Set(data.map(d => d[key]))].sort().map(g => {
      const sub = data.filter(d => d[key] === g);
      return {
        type: 'scattergeo',
        mode: 'markers',
        name: g,
        lat: sub.map(d => d.lat),
        lon: sub.map(d => d.long),
        text: sub.map(hoverText),
        hoverinfo: 'text',
        marker: { size: sub.map(sizeOf), color: colors[g] || '#888', opacity: 0.7, line: { width: 0.5, color: '#444' } }
      };
    });
  }

  const layout = {
    title: { text: 'Where the species lived' },
    margin: { t: 40, b: 0, l: 0, r: 0 },
    geo: {
      projection: { type: 'natural earth' },
      showland: true, landcolor: '#eef0f2',
      showocean: true, oceancolor: '#dbe9f4',
      showcountries: false, coastlinecolor: '#aaa'
    },
    legend: { orientation: 'h', y: -0.02 },
    autosize: true
  };

  Plotly.react(elementId, traces, layout, config);
}

// ---------- 2. island vs continental ----------
function renderIslandComparison(data, elementId = 'island-chart') {
  const traces = [];
  ['insular', 'continental'].forEach(g => {
    const sub = data.filter(d => d.island_endemicity === g);
    traces.push({
      type: 'violin',
      name: g,
      legendgroup: g,
      x: sub.map(() => g),
      y: sub.map(d => d.flight_ability),
      xaxis: 'x',
      yaxis: 'y',
      points: 'all', jitter: 0.4, pointpos: 0,
      spanmode: 'hard', scalemode: 'width',
      box: { visible: true },
      meanline: { visible: false },
      fillcolor: ENDEM_COLORS[g], opacity: 0.55,
      line: { color: ENDEM_COLORS[g] },
      marker: { size: 3, color: ENDEM_COLORS[g], opacity: 0.5 },
      text: sub.map(d => d.species),
      hoverinfo: 'text+y'
    });
    traces.push({
      type: 'box',
      name: g,
      legendgroup: g,
      showlegend: false,
      x: sub.map(() => g),
      y: sub.map(d => d.body_mass),
      xaxis: 'x2',
      yaxis: 'y2',
      boxpoints: 'all', jitter: 0.4, pointpos: 0,
      fillcolor: ENDEM_COLORS[g],
      line: { color: ENDEM_COLORS[g] },
      marker: { size: 3, color: ENDEM_COLORS[g], opacity: 0.5 },
      text: sub.map(d => d.species),
      hoverinfo: 'text+y'
    });
  });

  const layout = {
    title: { text: 'Island vs. continental species' },
    margin: { t: 60, b: 40, l: 60, r: 20 },
    grid: { rows: 1, columns: 2, pattern: 'independent' },
    xaxis: { domain: [0, 0.47] },
    xaxis2: { domain: [0.55, 1] },
    yaxis: { title: 'Flight ability (0 = flightless, 1 = full flight)', range: [-0.05, 1.05] },
    yaxis2: { title: 'Body mass (g)', type: 'log' },
    legend: { orientation: 'h', y: 1.1 },
    autosize: true
  };

  Plotly.newPlot(elementId, traces, layout, config);
}

// ---------- 3. wing length vs tarsus length ----------
function renderWingTarsus(data, elementId = 'scatter-chart') {
  const traces = flightTraces(data, (sub, t, i) => ({
    type: 'scatter',
    mode: 'markers',
    name: 'Flight: ' + t,
    x: sub.map(d => d.wing_length),
    y: sub.map(d => d.tarsus_length),
    text: sub.map(hoverText),
    hoverinfo: 'text',
    marker: flightMarker(sub, t, i, 8)
  }));

  const layout = {
    title: { text: 'Wing length vs. tarsus length' },
    xaxis: { title: 'Wing length (mm)', type: 'log' },
    yaxis: { title: 'Tarsus length (mm)', type: 'log' },
    margin: { t: 60, r: 20, l: 60, b: 50 },
    legend: { orientation: 'h', y: 1.08 },
    autosize: true
  };

  Plotly.newPlot(elementId, traces, layout, config);
}

// Automatically load graphs when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadAvotrex();

    const select = document.getElementById('map-color');
    renderMap(data, 'map-chart', select ? select.value : 'flight');
    if (select) select.addEventListener('change', () => renderMap(data, 'map-chart', select.value));

    renderIslandComparison(data, 'island-chart');
    renderWingTarsus(data, 'scatter-chart');
  } catch (err) {
    console.error(err);
    ['map-chart', 'island-chart', 'scatter-chart'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Could not load the data: ' + err.message;
    });
  }
});