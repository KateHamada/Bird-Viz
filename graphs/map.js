// TODO: 
// add a slider to go between each era
// have each ring be the color of whether it's continental vs island
// have each ring show the data for the flightless vs flighted birds

// Path to the CSV, relative to this page. Commit the file to your repo at this path.
const DATA_URL = 'data/Avotrex_traits_v1.csv';
// Each era lists the status codes that belong to it. Anything else counts as Present Day.
const ERAS = [
  { label: 'Prehistoric / Pre-1500', statuses: ['EP', 'EPU'], color: '#8c6d31' },
  { label: 'Historical (post-1500)', statuses: ['EX', 'EH'], color: '#7b3294' },
  { label: 'Edge of Extinction', statuses: ['EW', 'CR'], color: '#d6604d' },
  { label: 'Present Day', statuses: [], color: '#2166ac' }
];
function eraOf(status) {
  const i = ERAS.findIndex(e => e.statuses.includes(status));
  return i === -1 ? ERAS.length - 1 : i;
}
// Small CSV parser that handles quoted fields
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
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
async function drawMap() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Could not load ' + DATA_URL + ' (' + res.status + ')');
  const birds = parseCSV(await res.text())
    .map(r => ({
      ...r,
      lat: parseFloat(r.lat),
      long: parseFloat(r.long),
      body_mass: parseFloat(r.body_mass),
      era: eraOf((r.status || '').trim())
    }))
    .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.long) && Number.isFinite(d.body_mass));
  // Marker size scales with log body mass
  const logs = birds.map(d => Math.log10(d.body_mass));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  const size = d => 6 + 22 * (Math.log10(d.body_mass) - lo) / (hi - lo || 1);
  // One trace per era so the legend can toggle them
  const traces = ERAS.map((era, i) => {
    const sub = birds.filter(d => d.era === i);
    return {
      type: 'scattergeo',
      mode: 'markers',
      name: era.label + ' (' + sub.length + ')',
      lat: sub.map(d => d.lat),
      lon: sub.map(d => d.long),
      text: sub.map(d => '<b>' + d.species + '</b><br>' + d.archipelago + '<br>Status: ' + d.status + '<br>Body mass: ' + d.body_mass.toFixed(1) + ' g'),
      hoverinfo: 'text',
      marker: { size: sub.map(size), color: era.color, opacity: 0.75, line: { width: 0.5, color: '#444' } }
    };
  });
  const layout = {
    margin: { t: 10, b: 10, l: 10, r: 10 },
    legend: { orientation: 'h', y: -0.05 },
    geo: { projection: { type: 'natural earth' }, showland: true, landcolor: '#eee', showocean: true, oceancolor: '#dceaf5', showcountries: true }
  };
  document.getElementById('map').textContent = '';
  Plotly.newPlot('map', traces, layout, { responsive: true });
}
drawMap().catch(err => {
  console.error(err);
  document.getElementById('map').textContent = 'Could not load the data: ' + err.message;
});