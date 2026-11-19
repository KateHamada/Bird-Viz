// map.js: the extinction map. Needs common.js loaded first.
// Page elements: <div id="map-chart">  and optionally <select id="map-color">
// (values: flight, era, endemicity)

// ---------- 1. map of where species lived ----------
// all = every species (for stable sizing), visible = species up to the chosen era
function renderMap(all, visible, elementId = 'map-chart', colorBy = 'flight') {
  const sizeOf = makeSizer(all);
  const geoTrace = (sub, name, marker) => ({
    type: 'scattermap',
    mode: 'markers',
    name,
    lat: sub.map(d => d.lat),
    lon: sub.map(d => d.long),
    text: sub.map(hoverText),
    hoverinfo: 'text',
    marker
  });
  const plain = (sub, color) => ({
    size: sub.map(sizeOf), color, opacity: 0.7, line: { width: 0.5, color: '#444' }
  });
  let traces;

  if (colorBy === 'flight') {
    traces = flightTraces(visible, (sub, t, i) =>
      geoTrace(sub, 'Flight: ' + t, flightMarker(sub, t, i, sub.map(sizeOf))));
  } else if (colorBy === 'era' || colorBy === 'status') {
    // 'status' is kept as an alias so an older <option value="status"> still works
    traces = [];
    ERAS.forEach((era, i) => {
      if (!all.some(d => d.era === i)) return; // skip eras with no species (Present Day)
      const sub = visible.filter(d => d.era === i);
      traces.push(geoTrace(sub, era.label, plain(sub, era.color)));
    });
  } else {
    traces = ['insular', 'continental'].map(g => {
      const sub = visible.filter(d => d.island_endemicity === g);
      return geoTrace(sub, g, plain(sub, ENDEM_COLORS[g]));
    });
  }

  const layout = {
    title: { text: 'Where the species lived' },
    margin: { t: 40, b: 0, l: 0, r: 0 },
    map: {
        style: 'open-street-map', // swap style string here
        center: { lat: 20.6, lon: -157.5 },
        zoom: 1.1
    },
    legend: { orientation: 'h', y: -0.02 },
  };

  Plotly.react(elementId, traces, layout, config);
}

// ---------- wiring ----------
let mapColor = 'flight';

function drawMap(all, visible) {
  renderMap(all, visible, 'map-chart', mapColor);
}
registerRenderer(drawMap, ['map-chart']);

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('map-color');
  if (!select) return;
  mapColor = select.value;
  select.addEventListener('change', () => {
    mapColor = select.value;
    if (state.all.length) drawMap(state.all, visibleData());
  });
});