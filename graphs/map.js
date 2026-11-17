// map.js: draws the bird locations on a world map. Load AFTER common.js.
// common.js loads the CSV, builds the era slider, and calls the function below
// with all species and the species visible at the chosen era.
//
// TODO:
// have each ring be the color of whether it's continental vs island
// have each ring show the data for the flightless vs flighted birds

registerRenderer((all, visible) => {
  const size = makeSizer(all); // sized on all species so dots don't resize when the slider moves

  // One trace per era so the legend can still hide or show each group
  const traces = ERAS.map((era, i) => {
    const sub = visible.filter(d => d.era === i);
    return {
      type: 'scattergeo',
      mode: 'markers',
      name: era.label + ' (' + sub.length + ')',
      lat: sub.map(d => d.lat),
      lon: sub.map(d => d.long),
      text: sub.map(hoverText),
      hoverinfo: 'text',
      marker: { size: sub.map(size), color: era.color, opacity: 0.75, line: { width: 0.5, color: '#444' } }
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
  if (box.textContent) box.textContent = ''; // clear the "Loading map…" text
  Plotly.react('map', traces, layout, config);
}, ['map']);