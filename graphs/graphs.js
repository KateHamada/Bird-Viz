// Function to render a placeholder graph using Plotly.js
function renderPlaceholderGraph(elementId = 'chart') {
  // Fake / Mock Data
  const trace1 = {
    x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    y: [20, 35, 25, 45, 30, 55],
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Sales',
    line: { color: '#6366f1', width: 3 },
    marker: { size: 8 }
  };

  const trace2 = {
    x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    y: [15, 22, 38, 28, 42, 48],
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Revenue',
    line: { color: '#10b981', width: 3, dash: 'dash' },
    marker: { size: 8 }
  };

  const data = [trace1, trace2];

  // Layout settings
  const layout = {
    title: { text: 'Placeholder Graph' },
    xaxis: { title: 'Month' },
    yaxis: { title: 'Value ($)' },
    margin: { t: 40, r: 30, l: 50, b: 50 },
    autosize: true
  };

  // Plotly config options
  const config = {
    responsive: true,
    displayModeBar: false // Set to true if you want the Plotly toolbar
  };

  // Render the plot into the DOM element
  Plotly.newPlot(elementId, data, layout, config);
}

// Automatically load graph when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  renderPlaceholderGraph('chart');
});