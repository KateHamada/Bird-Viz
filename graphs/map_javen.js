// map.js: the one Avotrex map. Load AFTER common.js (it loads the CSV, builds the era
// slider, and calls drawMap below with all species and the species up to the chosen era).
//
// Page elements: <div id="map">  <div id="map-details">  <select id="map-color"> (optional)
// The select's values: flight, status, era, endemicity.
//
// What it does:
//  - one circle per recorded lat/long; circles with several species are larger
//  - click a circle to list its species in #map-details
//  - click an item in the legend to hide or show it (double-click to show only that item)
//  - the dropdown changes what the circles are colored by; the slider changes which eras are shown
//
// TODO (from the old map.js): have each ring show flightless vs. flighted birds.
// (Coloring the circles by island vs. continental is now the "endemicity" option.)

// Status view: a lighter and darker shade of each era's color
const STATUS_ORDER = ['EP', 'EPU', 'EX', 'EH', 'EW', 'CR'];
const STATUS_COLORS = { EP: '#8c6d31', EPU: '#c9a96e', EX: '#7b3294', EH: '#b995d0', EW: '#d6604d', CR: '#f2a58d' };

const mapState = {
  colorBy: 'era',
  all: [],
  visible: [],
  cats: [],            // the legend items for the current colorBy
  hidden: new Set(),   // indexes into cats that the user hid via the legend
  selectedKey: null,   // the clicked location, "lat,long"
  lastColorBy: null
};

const locKey = d => `${d.lat},${d.long}`;
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;

// ---------- legend items for each color mode ----------
// Each item: label, match(d), style(speciesGroups) -> marker settings (the size is added later)
function buildCategories(all, colorBy) {
  const solid = color => () => ({ color, opacity: 0.75, line: { width: 0.5, color: '#444' } });

  if (colorBy === 'flight') {
    return ['Literature', 'Imputed'].map((t, i) => ({
      label: 'Flight: ' + t,
      match: d => d.flight_imputation_type === t,
      // a circle with several species is colored by their mean flight ability
      style: groups => ({
        symbol: t === 'Imputed' ? 'circle-open' : 'circle', // open = flight ability was imputed
        color: groups.map(g => mean(g.map(d => d.flight_ability))),
        colorscale: FLIGHT_SCALE, cmin: 0, cmax: 1, opacity: 0.8,
        line: { width: t === 'Imputed' ? 2 : 0.5, color: t === 'Imputed' ? undefined : '#444' },
        showscale: i === 0,
        colorbar: { title: { text: 'Flight ability (mean)' }, thickness: 12, len: 0.6 }
      }),
      note: g => (g.length > 1 ? `Mean flight ability: ${mean(g.map(d => d.flight_ability)).toFixed(2)}` : '')
    }));
  }

  if (colorBy === 'status') {
    const present = [...new Set(all.map(d => d.status))];
    const order = [
      ...STATUS_ORDER.filter(s => present.includes(s)),
      ...present.filter(s => !STATUS_ORDER.includes(s)).sort()
    ];
    return order.map(s => {
      const era = ERA_OF_STATUS[s];
      return {
        label: era === undefined ? s : `${s} · ${ERAS[era].label}`,
        match: d => d.status === s,
        style: solid(STATUS_COLORS[s] || '#888')
      };
    });
  }

  if (colorBy === 'endemicity') {
    return ['insular', 'continental'].map(g => ({
      label: g, match: d => d.island_endemicity === g, style: solid(ENDEM_COLORS[g])
    }));
  }

  // 'era' (default); eras with no species, like Present Day, are left out
  return ERAS
    .map((era, i) => ({ label: era.label, match: d => d.era === i, style: solid(era.color), has: all.some(d => d.era === i) }))
    .filter(c => c.has);
}

// ---------- the clicked-location panel ----------
function showDetails() {
  const details = document.getElementById('map-details');
  if (!details) return;
  const { selectedKey, visible, cats, hidden } = mapState;
  const catIndex = d => cats.findIndex(c => c.match(d));
  const species = selectedKey
    ? visible.filter(d => locKey(d) === selectedKey && !hidden.has(catIndex(d)))
    : [];

  details.textContent = '';
  if (!species.length) {
    details.textContent = 'Click a circle to see the species at this location.';
    return;
  }

  const heading = document.createElement('h2');
  heading.textContent = `${species.length} species`;
  const list = document.createElement('ul');
  list.className = 'species-list';
  species.forEach(d => {
    const item = document.createElement('li');
    item.className = 'species-card';
    item.style.border = `2px solid ${ERAS[d.era].color}`;
    const name = document.createElement('strong');
    name.textContent = d.species.replace(/_/g, ' ');
    item.appendChild(name);
    [
      `${d.order} / ${d.family}`,
      `Status: ${d.status} (${ERAS[d.era].label})`,
      d.archipelago,
      `Flight ability: ${d.flight_ability} (${d.flight_imputation_type})`,
      `Body mass: ${d.body_mass.toFixed(1)} g (${d.body_imputation_type})`
    ].forEach(text => {
      const line = document.createElement('p');
      line.textContent = text;
      item.appendChild(line);
    });
    list.appendChild(item);
  });
  details.append(heading, list);
}

// ---------- legend and click handling (attached once) ----------
function redrawMap() {
  drawMap(mapState.all, mapState.visible);
}

function attachMapHandlers(box) {
  if (box._avotrexHandlers) return;
  box._avotrexHandlers = true;

  box.on('plotly_click', event => {
    const point = event.points.find(p => p.customdata !== undefined);
    if (!point) return;
    mapState.selectedKey = point.customdata;
    showDetails();
  });

  // We keep the hidden set ourselves (one source of truth) and return false so Plotly's own
  // toggle doesn't also run; that way the slider and the panel always agree on what is hidden.
  box.on('plotly_legendclick', event => {
    const i = event.curveNumber;
    if (mapState.hidden.has(i)) mapState.hidden.delete(i);
    else mapState.hidden.add(i);
    redrawMap();
    return false;
  });

  box.on('plotly_legenddoubleclick', event => {
    const i = event.curveNumber;
    const others = mapState.cats.map((_, j) => j).filter(j => j !== i);
    const alreadyAlone = !mapState.hidden.has(i) && others.every(j => mapState.hidden.has(j));
    mapState.hidden.clear();
    if (!alreadyAlone) others.forEach(j => mapState.hidden.add(j)); // show only this item; again to show all
    redrawMap();
    return false;
  });
}

// ---------- drawing ----------
// all = every species (for stable sizing), visible = species up to the chosen era
function drawMap(all, visible) {
  const box = document.getElementById('map');
  if (!box) return;
  if (box.textContent === 'Loading map…') box.textContent = '';

  const size = makeSizer(all); // sized on all species so dots don't resize when the slider moves
  mapState.all = all;
  mapState.visible = visible;
  mapState.cats = buildCategories(all, mapState.colorBy);
  if (mapState.colorBy !== mapState.lastColorBy) { // new legend items: forget hidden items and the selection
    mapState.hidden.clear();
    mapState.selectedKey = null;
    mapState.lastColorBy = mapState.colorBy;
  }

  // species per location across all shown legend items, so the hover count matches the click panel
  const totals = new Map();
  visible.forEach(d => {
    if (mapState.hidden.has(mapState.cats.findIndex(c => c.match(d)))) return;
    totals.set(locKey(d), (totals.get(locKey(d)) || 0) + 1);
  });

  const traces = mapState.cats.map((cat, i) => {
    const members = visible.filter(cat.match);
    const grouped = new Map();
    members.forEach(d => {
      const key = locKey(d);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(d);
    });
    const groups = Array.from(grouped, ([key, species]) => ({ key, species }));
    return {
      type: 'scattergeo',
      mode: 'markers',
      name: `${cat.label} (${members.length})`,
      visible: mapState.hidden.has(i) ? 'legendonly' : true,
      lat: groups.map(g => g.species[0].lat),
      lon: groups.map(g => g.species[0].long),
      customdata: groups.map(g => g.key),
      text: groups.map(g => {
        const total = totals.get(g.key) || g.species.length;
        if (g.species.length === 1) {
          return hoverText(g.species[0]) + (total > 1 ? `<br><i>${total - 1} more at this location. Click to see them</i>` : '');
        }
        const note = cat.note ? cat.note(g.species) : '';
        return `<b>${total} species at this location</b>${note ? '<br>' + note : ''}<br>Click to see them`;
      }),
      hoverinfo: 'text',
      marker: {
        ...cat.style(groups.map(g => g.species)),
        size: groups.map(g => Math.max(...g.species.map(size)) + Math.min(g.species.length - 1, 8) * 2)
      }
    };
  });

  const layout = {
    margin: { t: 10, b: 10, l: 10, r: 10 },
    legend: { orientation: 'h', y: -0.05 },
    geo: {
      projection: { type: 'natural earth' },
      showland: true, landcolor: '#eee',
      showocean: true, oceancolor: '#dceaf5',
      showcountries: true
    },
    uirevision: 'map' // keep the user's zoom/pan when the slider or dropdown changes
  };

  Plotly.react('map', traces, layout, config).then(() => attachMapHandlers(box));
  showDetails();
}

// ---------- wiring ----------
registerRenderer(drawMap, ['map']);

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('map-color');
  if (!select) return;
  mapState.colorBy = select.value;
  select.addEventListener('change', () => {
    mapState.colorBy = select.value;
    if (state.all.length) drawMap(state.all, visibleData());
  });
});