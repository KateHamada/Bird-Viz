// map.js: draws the bird locations on a world map. Load AFTER common.js.
// common.js loads the CSV, builds the era slider, and calls the function below
// with all species and the species visible at the chosen era.
//
// TODO:
// have each ring be the color of whether it's continental vs island
// have each ring show the data for the flightless vs flighted birds

let currentLocations = new Map();

registerRenderer((all, visible) => {
  const size = makeSizer(all); // sized on all species so dots don't resize when the slider moves
  const details = document.getElementById('map-details');
  if (details) {
    details.textContent = 'Click a circle to see the species at this location.';
  }

  currentLocations = new Map();
  visible.forEach(d => {
    const key = JSON.stringify([d.lat, d.long]);
    if (!currentLocations.has(key)) currentLocations.set(key, []);
    currentLocations.get(key).push(d);
  });

  // One trace per era so the legend can still hide or show each group
  const traces = ERAS.map((era, i) => {
    const grouped = new Map();
    visible.filter(d => d.era === i).forEach(d => {
      const key = JSON.stringify([d.lat, d.long]);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(d);
    });
    const groups = Array.from(grouped, ([key, species]) => ({ key, species }));
    return {
      type: 'scattergeo',
      mode: 'markers',
      name: era.label + ' (' + visible.filter(d => d.era === i).length + ')',
      lat: groups.map(group => group.species[0].lat),
      lon: groups.map(group => group.species[0].long),
      customdata: groups.map(group => group.key),
      text: groups.map(group => group.species.length > 1
        ? `<b>${group.species.length} species at this location</b><br>Click to see them`
        : hoverText(group.species[0])),
      hoverinfo: 'text',
      marker: {
        size: groups.map(group =>
          Math.max(...group.species.map(size)) + Math.min(group.species.length - 1, 8) * 2),
        color: era.color, opacity: 0.75, line: { width: 0.5, color: '#444' }
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
    }
  };

  const box = document.getElementById('map');
  if (box.textContent === 'Loading map…') box.textContent = '';
  Plotly.react('map', traces, layout, config).then(() => {
    if (box._locationClickHandler) return;
    box._locationClickHandler = event => {
      const point = event.points[0];
      const key = point.customdata;
      const species = currentLocations.get(key);
      const details = document.getElementById('map-details');
      if (!species || !details) return;

      details.textContent = '';
      const heading = document.createElement('h2');
      heading.textContent = `${species.length} species`;
      const list = document.createElement('ul');
      species.forEach(d => {
        const item = document.createElement('li');
        item.textContent = `${d.species} — ${d.order} / ${d.family} · ${d.status}`;
        list.appendChild(item);
      });
      details.append(heading, list);
    };
    box.on('plotly_click', box._locationClickHandler);
  });
}, ['map']);