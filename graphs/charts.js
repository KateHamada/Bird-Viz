// charts.js: the island vs. continental and wing vs. tarsus charts. Needs common.js loaded first.
// Page elements: <div id="island-chart">  <div id="scatter-chart">

// ---------- 2. island vs continental ----------
function renderIslandComparison(all, visible, elementId = 'island-chart') {
  const traces = [];
  ['insular', 'continental'].forEach(g => {
    const sub = visible.filter(d => d.island_endemicity === g);
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
    yaxis2: { title: 'Body mass (g)', type: 'log', range: logRange(all, 'body_mass') },
    legend: { orientation: 'h', y: 1.1 },
    uirevision: 'island',
    autosize: true
  };

  Plotly.react(elementId, traces, layout, config);
}

// ---------- 3. wing length vs tarsus length ----------
function renderWingTarsus(all, visible, elementId = 'scatter-chart') {
  const traces = flightTraces(visible, (sub, t, i) => ({
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
    xaxis: { title: 'Wing length (mm)', type: 'log', range: logRange(all, 'wing_length') },
    yaxis: { title: 'Tarsus length (mm)', type: 'log', range: logRange(all, 'tarsus_length') },
    margin: { t: 60, r: 20, l: 60, b: 50 },
    legend: { orientation: 'h', y: 1.08 },
    uirevision: 'scatter',
    autosize: true
  };

  Plotly.react(elementId, traces, layout, config);
}

// ---------- wiring ----------
registerRenderer((all, visible) => renderIslandComparison(all, visible, 'island-chart'), ['island-chart']);
registerRenderer((all, visible) => renderWingTarsus(all, visible, 'scatter-chart'), ['scatter-chart']);