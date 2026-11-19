// check_model.js — loads the generated data + hc_model.js in Node and prints layout diagnostics + overlap/crossing/slope checks.
//   node poc/_render/check_model.js [--leaves]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const data = fs.readFileSync(path.join(root, 'data', 'honeycreeper_data.js'), 'utf8');
const ctx = new Function(data + '; return { HC_NODES, HC_EDGES, HC_POP };')();
global.HC_NODES = ctx.HC_NODES; global.HC_EDGES = ctx.HC_EDGES; global.HC_POP = ctx.HC_POP;
const HCModel = require(path.join(root, 'assets', 'hc_model.js'));
const m = HCModel.build();
const X = m.X;
console.log('canvas height', Math.round(m.Hcanvas), ' XB0', Math.round(X.XB0), ' XB1', Math.round(X.XB1), ' X_NOW', Math.round(X.X_NOW), ' xFull', Math.round(X.xFull));
console.log('root H', m.root.H.toFixed(0), ' stem y', m.stem.y.toFixed(0), ' ribbons', m.ribbons.length, ' nodes', m.nodes.length);

if (process.argv.includes('--leaves')) {
  m.leaves.forEach(n => console.log(String(Math.round(n.y)).padStart(5), n.w0.toFixed(1).padStart(5), n.wNow.toFixed(1).padStart(5), n.era.padEnd(11), String(n.endYear || 'now').padEnd(5), n.key));
}

// ---- slope check: max |dy/dx| along each ribbon centreline
const worst = [];
m.ribbons.forEach(r => {
  let ms = 0, at = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const s = Math.abs((r.pts[i][1] - r.pts[i - 1][1]) / (r.pts[i][0] - r.pts[i - 1][0]));
    if (s > ms) { ms = s; at = r.pts[i][0]; }
  }
  worst.push({ key: r.key, ms, at, H: r.node.isLeaf ? r.node.w0 : r.node.H });
});
worst.sort((a, b) => b.ms - a.ms);
console.log('--- steepest ribbons (max |dy/dx|)');
worst.slice(0, 10).forEach(w => console.log(w.ms.toFixed(2).padStart(6), 'at x=' + Math.round(w.at), 'thick ' + w.H.toFixed(0).padStart(4), w.key));

// ---- overlap / crossing check
// active ribbons at x form a cut; order by first leaf index; neighbours must be separated by >= (w_i + w_j)/2
let minGap = 1e9; const bad = []; let samples = 0;
const rb = m.ribbons.map(r => ({ r, first: Math.min.apply(null, r.leaves.map(l => l.idx)) }));
for (let x = 30; x <= X.XB1; x += 3) {
  const act = [];
  rb.forEach(o => { if (x >= o.r.x0 && x <= o.r.x1) { const a = m.ribbonAt(o.r, x); act.push({ key: o.r.key, first: o.first, y: a.y, w: a.w }); } });
  act.sort((a, b) => a.first - b.first);
  samples++;
  for (let i = 0; i < act.length - 1; i++) {
    const g = (act[i + 1].y - act[i + 1].w / 2) - (act[i].y + act[i].w / 2);
    if (g < minGap) minGap = g;
    if (g < -0.05) bad.push({ x, a: act[i].key, b: act[i + 1].key, g: +g.toFixed(2) });
  }
}
console.log('--- overlap check: samples', samples, ' min gap', minGap.toFixed(2), ' violations', bad.length);
const seen = {};
bad.forEach(b => { const k = b.a + '|' + b.b; if (!seen[k]) seen[k] = b; });
Object.values(seen).slice(0, 15).forEach(b => console.log('  x=' + b.x, b.a, '/', b.b, 'gap', b.g));
