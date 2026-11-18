/* sankey_render.js — PoC honeycreeper SANKEY TREE (v2).
   Every species ribbon forks off its PARENT at the parent's divergence time;
   the two ancestor bands carry the SUM of their children's widths (true
   Sankey flow: width(parent) = sum of children), so the primary clade is a
   thick band that fans out into its 54 Pliocene species. Branches, not bars.
   Reads HC_NODES / HC_EDGES / HC_TRUNKS from data/honeycreeper_data.js.
   Pure SVG + vanilla JS. Era colors mirror the project-wide ERAS scheme. */

var ERA_COLOR = { prehistoric: '#8c6d31', historic: '#7b3294', edge: '#d6604d', present: '#2166ac' };
var TIER_W = { abundant: 24, common: 16, rare: 10, critical: 5, extinct: 0 };

// ---- BROKEN x-axis: panel A = deep time (mya), panel B = human epoch (CE) ----
var DEEP_LO = 0.3;
var W_A = 560, GAP = 56, W_B = 430;
var X0 = 12, XA1 = X0 + W_A, XB0 = XA1 + GAP, XB1 = XB0 + W_B;
var PLOT_W = 12 + W_A + GAP + W_B;
var LABEL_COL = PLOT_W + 16, SVG_W = PLOT_W + 244;

// Panel A is PIECEWISE-LINEAR in mya: steep from 7.2 -> 4.0 mya, gentle from
// 4.0 -> 0.3. A plain linear scale would collapse all 54 primary-clade forks
// into one vertical wall at 3.2-3.8 mya; this gives the radiation fan real
// horizontal room while keeping 7.2 / 5.7 / 4.7 spaced out.
var xRad0 = X0 + (7.2 - 4.0) / (7.2 - DEEP_LO) * W_A;
function xRad(mya) {
  return mya >= 4.0 ? X0 + (7.2 - mya) / (7.2 - DEEP_LO) * xRad0
    : xRad0 + (4.0 - mya) / (4.0 - DEEP_LO) * (XA1 - xRad0);
}
var X_TRUNK = xRad(7.2);

var MOD_KNOTS = [[1000, 0], [1500, 0.27], [1800, 0.5], [1950, 0.72], [2030, 1]];
function fracModern(y) {
  if (y <= 1000) return 0;
  if (y >= 2030) return 1;
  for (var i = 0; i < MOD_KNOTS.length - 1; i++) {
    var y0 = MOD_KNOTS[i][0], f0 = MOD_KNOTS[i][1], y1 = MOD_KNOTS[i + 1][0], f1 = MOD_KNOTS[i + 1][1];
    if (y >= y0 && y <= y1) return f0 + (y - y0) / (y1 - y0) * (f1 - f0);
  }
  return 1;
}
function xMod(ce) { return XB0 + fracModern(ce) * W_B; }
var X_PLATEAU = xMod(1850); // ribbons hold tier width to "decline begins", then taper
var X_NOW = xMod(2025);
// prehistoric species have NO extinction year (null) — subfossil lineages that
// died out before the modern record. Per the plan ("subfossil extinctions begin
// near the right edge"), spread their tapers across the pre-1500 window on the
// human-epoch panel instead of collapsing onto a single 1400-CE point (the blob).
var X_PREH0 = xMod(1000) + 14;
var X_PREH1 = xMod(1650);

var byKey = {};
HC_NODES.forEach(function (n) { byKey[n.key] = n; });
function eraOf(n) {
  if (n.display_status === 'extant') return 'present';
  var y = parseInt(n.extinction_year || '1400', 10);
  if (y < 1500) return 'prehistoric';
  if (y < 1900) return 'historic';
  return 'edge';
}
function noDna(n) { return n.display_status === 'prehistoric' && !n.avonet_key; }
function widthOf(n) { return TIER_W[n.peak_tier] != null ? TIER_W[n.peak_tier] : 8; }

// ================= Sankey tree layout =================
// Ribbon width = the species' population tier (log ladder). Leaf lanes stack
// in CSV order (which already groups the primary clade by genus); an internal
// node's band = the union of its children's lanes (so its width = the sum).
var MIN_W = 4, TOP2 = 56, MB2 = 46;
var childKeys = {};
HC_EDGES.forEach(function (e) { (childKeys[e.parent_key] = childKeys[e.parent_key] || []).push(e.child_key); });
var LEAF_ORDER = [];
(childKeys['hc_ancestor'] || []).forEach(function (k) {
  if (k === 'primary_clade') (childKeys['primary_clade'] || []).forEach(function (s) { LEAF_ORDER.push(s); });
  else LEAF_ORDER.push(k);
});
// index the prehistoric (no-DNA, no year) lineages so their tapers fan out
// across the pre-1500 window on the human-epoch panel instead of collapsing
// onto a single 1400-CE point (which piled them into a blob).
var prehIdx = {}, prehCount = 0;
LEAF_ORDER.forEach(function (k) {
  var n = byKey[k];
  if (n.display_status === 'prehistoric' && !n.extinction_year) prehIdx[k] = prehCount++;
});
var yBand = {}, cursor = 0, LEAF_H = 0;
LEAF_ORDER.forEach(function (k) {
  var h = Math.max(MIN_W, widthOf(byKey[k]));
  yBand[k] = { top: cursor, bot: cursor + h, y: cursor + h / 2 };
  cursor += h;
  LEAF_H += h;
});
var nodeTop = {}, nodeBot = {};
function spanOf(k) {
  if (yBand[k]) return [yBand[k].top, yBand[k].bot];
  var t = Infinity, b = -Infinity;
  (childKeys[k] || []).forEach(function (c) { var s = spanOf(c); if (s[0] < t) t = s[0]; if (s[1] > b) b = s[1]; });
  nodeTop[k] = t; nodeBot[k] = b;
  return [t, b];
}
spanOf('hc_ancestor');
function yOf2(k) { return TOP2 + yBand[k].y; }

// A child forks off its parent at the PARENT's divergence time (the Sankey
// rule: the flow leaves the parent node at the moment of the split).
var xDivM = { hc_ancestor: 7.2, primary_clade: 4.0 };
HC_EDGES.forEach(function (e) { xDivM[e.parent_key] = parseFloat(e.divergence_mya); });
var X_DIV = {};
HC_EDGES.forEach(function (e) { X_DIV[e.child_key] = xRad(xDivM[e.parent_key]); });

function endXof(n) {
  if (n.display_status === 'extant') return X_NOW;
  if (n.display_status === 'prehistoric' && !n.extinction_year) {
    var i = prehIdx[n.key], f = prehCount > 1 ? i / (prehCount - 1) : 0;
    return X_PREH0 + f * (X_PREH1 - X_PREH0);
  }
  var y = parseInt(n.extinction_year || '1400', 10);
  return xMod(y);
}


// ================= SVG helpers =================
var NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  var el = document.createElementNS(NS, tag);
  for (var k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
function txt(x, y, s, cls, anchor, parent) {
  var t = svgEl('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'start' }, parent);
  t.textContent = s;
  return t;
}
// smooth right-angle bend from (x0,y0) to (x1,y1)
function elbow(x0, y0, x1, y1) {
  var c = Math.min(70, Math.max(10, (x1 - x0) * 0.5));
  return ' C' + (x0 + c) + ',' + y0 + ' ' + (x1 - c) + ',' + y1 + ' ' + x1 + ',' + y1;
}
// one species ribbon: fork at its parent's divergence, hold tier height to
// the 1850 "decline begins" line, then taper to a point at the extinction
// year (or hold to the 2025 edge if extant). Species that survive to 1000
// CE cross the axis break at their lane y and continue on the right panel.
function ribbonPath(n) {
  var b = yBand[n.key], xt = X_DIV[n.key], xEnd = endXof(n);
  var extant = n.display_status === 'extant';
  if (xt > xMod(1000)) xt = xMod(1000) - 8;
  var tT = b.top + TOP2, tB = b.bot + TOP2, ym = (tT + tB) / 2;
  var top, bot;
  if (extant) {
    top = 'M' + xt + ',' + tT + ' L' + X_PLATEAU + ',' + tT + elbow(X_PLATEAU, tT, X_NOW, tT);
    bot = 'M' + X_NOW + ',' + tB + ' C' + (X_PLATEAU + (X_NOW - X_PLATEAU) * 0.5) + ',' + tB + ' ' +
      (X_PLATEAU + (X_NOW - X_PLATEAU) * 0.5) + ',' + tB + ' ' + X_PLATEAU + ',' + tB + ' L' + xt + ',' + tB + ' Z';
  } else if (xEnd <= X_PLATEAU + 6) {
    top = 'M' + xt + ',' + tT + elbow(xt, tT, xEnd, ym);
    bot = 'L' + xEnd + ',' + (ym + 0.4) + ' C' + (xt + (xEnd - xt) * 0.85) + ',' + (ym + 0.4) + ' ' +
      (xt + (xEnd - xt) * 0.45) + ',' + tB + ' ' + xt + ',' + tB + ' Z';
  } else {
    top = 'M' + xt + ',' + tT + ' L' + X_PLATEAU + ',' + tT + elbow(X_PLATEAU, tT, xEnd, ym);
    bot = 'L' + xEnd + ',' + (ym + 0.4) + ' C' + (X_PLATEAU + (xEnd - X_PLATEAU) * 0.85) + ',' + (ym + 0.4) + ' ' +
      (X_PLATEAU + (xEnd - X_PLATEAU) * 0.45) + ',' + tB + ' ' + X_PLATEAU + ',' + tB + ' L' + xt + ',' + tB + ' Z';
  }
  return top + bot;
}
// Sankey bands for the two ancestor nodes: thick trunks that fan out, each
// species ribbon peeling off at its own divergence x (flow = sum of children).
function renderBands(gR) {
  function span(k) { var a = nodeTop[k], b = nodeBot[k]; return { a: a + TOP2, b: b + TOP2, y: (a + b) / 2 + TOP2 }; }
  var A = span('hc_ancestor'), P = span('primary_clade');
  svgEl('path', { d: 'M' + X_TRUNK + ',' + (A.y - 24) + ' L' + xRad0 + ',' + A.a + ' L' + xRad0 + ',' + A.b +
    ' L' + X_TRUNK + ',' + (A.y + 24) + ' Z', fill: '#475569', 'fill-opacity': 0.16, 'pointer-events': 'none' }, gR);
  svgEl('path', { d: 'M' + xRad0 + ',' + (P.y - 34) + ' L' + XA1 + ',' + P.a + ' L' + XA1 + ',' + P.b +
    ' L' + xRad0 + ',' + (P.y + 34) + ' Z', fill: '#7b3294', 'fill-opacity': 0.10, 'pointer-events': 'none' }, gR);
}


function buildFrame() {
  var H = TOP2 + LEAF_H + MB2;
  var svg = svgEl('svg', { viewBox: '0 0 ' + SVG_W + ' ' + H, width: SVG_W, height: H, role: 'img' });
  var gBg = svgEl('g', {}, svg);
  svgEl('rect', { x: X0, y: TOP2 - 22, width: W_A, height: LEAF_H + 22, fill: '#f8f7f4' }, gBg);
  svgEl('rect', { x: XB0, y: TOP2 - 22, width: W_B, height: LEAF_H + 22, fill: '#f4f7fb' }, gBg);
  txt(X0 + 6, TOP2 - 10, 'DEEP TIME · divergence (mya, piecewise linear)', 'panel-cap', 'start', gBg);
  txt(XB0 + 6, TOP2 - 10, 'HUMAN EPOCH · extinctions (linear, CE)', 'panel-cap', 'start', gBg);

  var gSpine = svgEl('g', { 'pointer-events': 'none' }, svg);
  svgEl('line', { x1: X_TRUNK, y1: TOP2, x2: X_TRUNK, y2: TOP2 + LEAF_H, stroke: '#94a3b8', 'stroke-width': 2.4, 'stroke-dasharray': '5 4' }, gSpine);
  svgEl('line', { x1: xRad0, y1: TOP2, x2: xRad0, y2: TOP2 + LEAF_H, stroke: '#94a3b8', 'stroke-width': 2.4, 'stroke-dasharray': '5 4' }, gSpine);
  // axis break between panels (unfilled stroked zigzag, not a solid shape)
  var midY = TOP2 + LEAF_H / 2;
  svgEl('path', { d: 'M' + XA1 + ',' + (midY - 15) + ' L' + (XA1 + 11) + ',' + (midY - 7) + ' L' + XA1 + ',' + (midY + 1) +
    ' L' + (XA1 + 11) + ',' + (midY + 9) + ' L' + XB0 + ',' + (midY + 9), 'class': 'break-zig',
    fill: 'none', stroke: '#94a3b8', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gSpine);
  var c1 = txt(X_TRUNK - 5, TOP2 + LEAF_H + 2, 'origin · Carpodacus (7.2 mya)', 'trunk-label', 'end', gSpine);
  c1.setAttribute('transform', 'rotate(-90 ' + (X_TRUNK - 5) + ' ' + (TOP2 + LEAF_H + 2) + ')');
  var c2 = txt(xRad0 - 5, TOP2 + LEAF_H + 2, 'primary-clade “big bang” (4.0 mya)', 'trunk-label', 'end', gSpine);
  c2.setAttribute('transform', 'rotate(-90 ' + (xRad0 - 5) + ' ' + (TOP2 + LEAF_H + 2) + ')');

  var gMil = svgEl('g', { 'pointer-events': 'none' }, svg);
  svgEl('rect', { x: xMod(1900), y: TOP2, width: X_NOW - xMod(1900), height: LEAF_H, fill: 'rgba(214,96,77,0.07)' }, gMil);
  function mil(ce, color, label, row) {
    var x = xMod(ce);
    svgEl('line', { x1: x, y1: TOP2, x2: x, y2: TOP2 + LEAF_H, 'class': 'milo-line', stroke: color }, gMil);
    txt(x, TOP2 + LEAF_H + (row === 'a' ? 20 : 34), label, 'milo-tick', 'middle', gMil);
  }
  mil(1000, '#8c6d31', '≈1000 Polynesians', 'a');
  mil(1500, '#7b3294', '1500 contact', 'b');
  mil(1826, '#64748b', '1826 Culex in', 'a');
  mil(1900, '#d6604d', '1900 malaria', 'b');
  svgEl('line', { x1: xMod(2023), y1: TOP2, x2: xMod(2023), y2: TOP2 + LEAF_H, stroke: '#b91c1c', 'stroke-width': 1.7 }, gMil);
  var t2023 = txt(xMod(2023), TOP2 - 4, '2023: 6 honeycreepers delisted as extinct', 'milo-tick', 'end', gMil);
  t2023.setAttribute('fill', '#b91c1c');

  var gAxis = svgEl('g', { 'class': 'axis', 'pointer-events': 'none' }, svg);
  [7, 6, 5, 4, 3, 2, 1].forEach(function (mya, i) {
    var x = xRad(mya);
    svgEl('line', { x1: x, y1: TOP2 - 4, x2: x, y2: TOP2 + 3, stroke: '#94a3b8' }, gAxis);
    if (mya !== 7) txt(x, TOP2 - (i % 2 ? 18 : 7), String(mya), null, 'middle', gAxis);
  });
  var xHalf = xRad(0.5);
  svgEl('line', { x1: xHalf, y1: TOP2 - 4, x2: xHalf, y2: TOP2 + 3, stroke: '#94a3b8' }, gAxis);
  txt(xHalf, TOP2 - 7, '0.5 mya', null, 'middle', gAxis);
  [1200, 1400, 1600, 1800, 2000].forEach(function (ce) {
    var x = xMod(ce);
    svgEl('line', { x1: x, y1: TOP2 + LEAF_H, x2: x, y2: TOP2 + LEAF_H + 4, stroke: '#94a3b8' }, gAxis);
    txt(x, TOP2 + LEAF_H + 12, ce, null, 'middle', gAxis);
  });
  txt(XB1, TOP2 + LEAF_H + 12, 'now', 'milo-tick', 'end', gAxis);
  txt(X0, H - 3, 'x-axis is broken:  millions of years ago (left)   ·   calendar years (right)', 'milo-tick', 'start', gAxis);
  return { svg: svg, H: H, gBg: gBg, gSpine: gSpine, gMil: gMil, gAxis: gAxis };
}


var activeEra = { prehistoric: true, historic: true, edge: true, present: true };
var ribbons = [], markers = [], endGlyphs = [], labelRows = [];
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
var fmtN = function (v) { return v == null ? '—' : Number(v).toLocaleString('en-US'); };

function renderRibbons(f) {
  var gR = f.svg.insertBefore(svgEl('g', {}, null), f.gSpine); // ribbons UNDER the spine lines
  ribbons = []; markers = []; endGlyphs = [];
  renderBands(gR); // Sankey bands: ancestor trunk + primary-clade radiation band
  // ---- one ribbon per species, forking off its parent ----
  LEAF_ORDER.forEach(function (k) {
    var n = byKey[k], era = eraOf(n), extant = n.display_status === 'extant';
    var p = svgEl('path', { d: ribbonPath(n), 'class': 'ribbon' + (extant ? ' ribbon-it' : ' ribbon-ext'), fill: ERA_COLOR[era],
      'fill-opacity': extant ? 0.92 : (n.declared_extinct_2023 ? 0.5 : 0.38),
      stroke: noDna(n) ? '#7c5a2b' : 'none', 'stroke-width': 1.1, 'stroke-opacity': 0.8,
      'stroke-dasharray': noDna(n) ? '4 3' : 'none', 'data-era': era, 'data-key': n.key }, gR);
    p.addEventListener('mousemove', function (e) {
      ribbons.forEach(function (r) { r.classList.add('dim'); });
      p.classList.remove('dim');
      moveTip(e, tooltipHTML(n));
    });
    p.addEventListener('mouseleave', function () {
      ribbons.forEach(function (r) { r.classList.remove('dim'); });
      hideTip();
    });
    ribbons.push(p);
    // loss marker (x) at the taper point
    if (!extant) {
      var m = { x: endXof(n), y: yOf2(k), era: era, declared: n.declared_extinct_2023 };
      var color = m.declared ? '#b91c1c' : (m.era === 'prehistoric' ? '#8c6d31' : (m.era === 'historic' ? '#7b3294' : '#d6604d'));
      markers.push(svgEl('path', { d: 'M' + (m.x - 3.2) + ',' + (m.y - 3.2) + ' L' + (m.x + 3.2) + ',' + (m.y + 3.2) +
        ' M' + (m.x - 3.2) + ',' + (m.y + 3.2) + ' L' + (m.x + 3.2) + ',' + (m.y - 3.2),
        stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'data-era': m.era, fill: 'none', 'pointer-events': 'none' }, gR));
    }
    // end glyph: data-driven bird silhouette (beak length + body mass)
    var gx = extant ? X_NOW + 3 : endXof(n) + 3;
    var g = birdGlyph(n, gx, yOf2(k), 0.9, !extant);
    var gb = svgEl('g', { 'class': 'end-glyph', 'data-era': era, 'pointer-events': 'none' }, gR);
    svgEl('path', { d: g.bodyD, fill: g.bodyColor }, gb);
    svgEl('path', { d: g.beakD, fill: g.beakColor }, gb);
    if (extant) svgEl('circle', { cx: g.eyeX, cy: g.eyeY, r: 0.7, fill: '#e2e8f0' }, gb);
    endGlyphs.push(gb);
  });
}

function birdGlyph(n, cx, cy, s, dead) {
  var bl = parseFloat(n.beak_length_culmen) || 14;
  var bm = parseFloat(n.body_mass) || 15;
  var sc = 1 + Math.min(1, Math.max(0, (Math.log10(bm) - 0.9) / 1.05)) * 0.55;
  var s2 = (s || 1) * sc;
  var beakLen = Math.max(4, Math.min(24, bl * 0.7)) * s2;
  var r = 3.0 * s2;
  var beakColor = dead ? '#9ca3af' : '#e2e8f0';
  var bodyColor = dead ? '#475569' : '#1f2937';
  var bodyD = 'M' + (cx - r) + ',' + cy + ' A' + r + ',' + r + ' 0 1 0 ' + (cx + r) + ',' + cy +
    ' A' + r + ',' + r + ' 0 1 0 ' + (cx - r) + ',' + cy + ' Z';
  var beakD = 'M' + (cx + r - 0.6) + ',' + (cy - 0.9 * s2) +
    ' L' + (cx + r + beakLen) + ',' + cy +
    ' L' + (cx + r - 0.6) + ',' + (cy + 0.9 * s2) + ' Z';
  return { bodyD: bodyD, beakD: beakD, beakColor: beakColor, bodyColor: bodyColor,
    eyeX: cx + r * 0.2, eyeY: cy - r * 0.28, r: r };
}


function renderLabels(f) {
  var gL = svgEl('g', { 'pointer-events': 'none' }, f.svg);
  f.gL = gL;
  txt(LABEL_COL + 10, TOP2 - 10, 'LINEAGE · (year = extinction)', 'panel-cap', 'start', gL);
  LEAF_ORDER.forEach(function (k) {
    var n = byKey[k], y = yOf2(k), it = n.display_status === 'extant', era = eraOf(n);
    svgEl('circle', { cx: LABEL_COL, cy: y, r: 3.4, fill: ERA_COLOR[era], 'fill-opacity': 0.85 }, gL);
    if (n.declared_extinct_2023)
      svgEl('path', { d: 'M' + (LABEL_COL - 2) + ',' + (y - 2) + ' l4,4 M' + (LABEL_COL + 2) + ',' + (y - 2) + ' l-4,4', stroke: '#fff', 'stroke-width': 1.1 }, gL);
    var yearStr = it ? '' : (n.extinction_year ? ' ' + n.extinction_year : ' †');
    labelRows.push({ el: txt(LABEL_COL + 8, y + 3, n.common_name + yearStr, 'sp-label' + (it ? ' it' : ''), 'start', gL), era: era, key: k });
  });
}

// Primary anthropogenic driver per lineage (cited literature). Malaria is the
// only red-flagged driver: the dominant, disproportionate honeycreeper killer.
var DRIVER = {
  malaria:    { label: 'Avian malaria', glyph: '✚' },
  predators:  { label: 'Introduced predators', glyph: '✱' },
  habitat:    { label: 'Habitat loss', glyph: '◆' },
  historical: { label: 'Historical loss (predation / habitat / collection)', glyph: '✱' },
  unknown:    { label: 'Driver unknown / subfossil only', glyph: '?' }
};
function driverOf(n) {
  if (n.display_status === 'extant') return null;
  var k = n.key;
  if (n.display_status === 'prehistoric') return 'unknown';
  var y = parseInt(n.extinction_year || '1400', 10);
  if (k === 'Melamprosops_phaeosoma') return 'habitat'; // poʻouli: highland forest + snail-host loss
  if (/Rhodacanthis|Chloridops/.test(k)) return 'habitat'; // koa-finches & grosbeaks: deforestation (James & Prince 2008)
  if (k === 'Psittirostra_psittacea' || k === 'Akialoa_lanaiensis' || k === 'Himatione_fraithii') return 'predators';
  return y >= 1890 ? 'malaria' : 'historical'; // Culex introduced 1826, epidemic from ~1900
}

function parentName(n) {
  var e = null;
  for (var i = 0; i < HC_EDGES.length; i++) if (HC_EDGES[i].child_key === n.key) { e = HC_EDGES[i]; break; }
  if (!e) return '—';
  if (e.parent_key === 'hc_ancestor') return 'Hawaiian honeycreeper ancestor';
  if (e.parent_key === 'primary_clade') return 'primary clade';
  return byKey[e.parent_key] ? byKey[e.parent_key].common_name : e.parent_key;
}
function divMya(n) {
  var e = null;
  for (var i = 0; i < HC_EDGES.length; i++) if (HC_EDGES[i].child_key === n.key) { e = HC_EDGES[i]; break; }
  return e ? e.divergence_mya : '—';
}

function tooltipHTML(n) {
  var rows = [];
  rows.push('<div class="tt-name">' + esc(n.common_name) + '</div>');
  rows.push('<div class="tt-sci">' + esc(n.key) + ' (' + esc(n.genus) + ')</div>');
  var flag = n.display_status === 'extant'
    ? '<span class="tt-flag" style="background:var(--present);color:#fff">EXTANT</span>'
    : n.display_status === 'prehistoric'
      ? '<span class="tt-flag" style="background:var(--prehistoric);color:#fff">PREHISTORIC †</span>'
      : '<span class="tt-flag" style="background:var(--historic);color:#fff">EXTINCT ' + esc(n.extinction_year) + '</span>';
  if (n.declared_extinct_2023) flag += ' <span class="tt-flag" style="background:#b91c1c;color:#fff">delisted 2023</span>';
  if (noDna(n)) flag += ' <span class="tt-flag" style="background:#334155;color:#fff">no DNA</span>';
  rows.push(flag);
  rows.push('<div class="tt-row"><span class="tt-k">Forked from</span> ' + esc(parentName(n)) + ' · ≈' + esc(divMya(n)) + ' mya</div>');
  rows.push('<div class="tt-row"><span class="tt-k">Status</span> ' + esc(n.extinction_caveat || (n.display_status === 'extant' ? 'Present day' : 'extinct ' + n.extinction_year)) + '</div>');
  rows.push('<div class="tt-row"><span class="tt-k">Population tier</span> ' + esc(n.peak_tier) + ' (ribbon width)</div>');
  if (n.population_estimate) rows.push('<div class="tt-row"><span class="tt-k">Count</span> ' + fmtN(n.population_estimate) + ' birds' + (n.count_year ? ' (' + n.count_year + ')' : '') + '</div>');
  if (n.peak_cite) rows.push('<div class="tt-row"><span class="tt-k">Cite</span> ' + esc(n.peak_cite) + '</div>');
  rows.push('<div class="tt-row"><span class="tt-k">Range</span> ' + esc(n.range) + '</div>');
  if (n.display_status !== 'extant') {
    var dk = driverOf(n);
    if (dk) {
      var dr = DRIVER[dk];
      var drvStyle = dk === 'malaria' ? 'color:#fca5a5;font-weight:700' : 'font-weight:700';
      rows.push('<div class="tt-row"><span class="tt-k">Primary driver</span> <span style="' + drvStyle + '">' + dr.glyph + ' ' + dr.label + '</span></div>');
    }
  }
  rows.push('<div class="tt-row"><span class="tt-k">Beak</span> ' + esc(n.beak_shape) + (n.beak_length_culmen ? ' · ' + esc(n.beak_length_culmen) + 'mm' : '') + ' · <span class="tt-k">mass</span> ' + (n.body_mass ? esc(n.body_mass) + 'g' : 'n/a') + '</div>');
  var conflict = (n.extinction_caveat && /conflict/i.test(n.extinction_caveat)) || (n.notes && /conflict/i.test(n.notes));
  if (conflict) rows.push('<div class="tt-row caveat">⚠ Data difficulty: sources disagree on the year — see extinction_caveat.</div>');
  if (n.avotrex_key) rows.push('<div class="tt-row"><span class="tt-k">AVOTREX</span> ' + esc(n.avotrex_key) + ' (' + esc(n.avotrex_status) + ')');
  if (n.avonet_key) rows.push('<div class="tt-row"><span class="tt-k">AVONET</span> ' + esc(n.avonet_key) + ' (' + esc(n.avonet_status) + ')');
  return rows.join('');
}


function moveTip(e, html) {
  var tip = document.getElementById('tooltip');
  tip.innerHTML = html; tip.style.opacity = '1';
  var pad = 14, tw = tip.offsetWidth, th = tip.offsetHeight;
  var x = e.clientX + pad, y = e.clientY + pad;
  if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - 8) y = e.clientY - th - pad;
  tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
}
function hideTip() { document.getElementById('tooltip').style.opacity = '0'; }
function applyFilter() {
  ribbons.forEach(function (p) { p.style.display = activeEra[p.getAttribute('data-era')] ? '' : 'none'; });
  markers.forEach(function (m) { m.style.display = activeEra[m.getAttribute('data-era')] ? '' : 'none'; });
  endGlyphs.forEach(function (g) { g.style.display = activeEra[g.getAttribute('data-era')] ? '' : 'none'; });
  labelRows.forEach(function (r) { r.el.style.display = activeEra[r.era] ? '' : 'none'; });
}

// ---- per-species data-quality table (the species_quality TODO, concretely) ----
function confidenceOf(n) {
  var conflict = /conflict|vs 19|1891|1896/i.test((n.extinction_caveat || '') + (n.notes || ''));
  if (n.display_status === 'prehistoric' && !n.avonet_key) return 'low';
  if (conflict) return 'low';
  if (n.display_status === 'extinct') return 'med';
  return 'high';
}
function srcOf(n) {
  var s = [];
  if (n.avotrex_key) s.push('AVOTREX:' + n.avotrex_key);
  if (n.avonet_key) s.push('AVONET:' + n.avonet_key);
  if (!s.length) s.push('Wikipedia 2026 (hand-keyed)');
  return s.join(' + ');
}
var dqSort = { key: 'common_name', dir: 1 };
function buildTable() {
  var box = document.getElementById('dq-table');
  if (!box) return;
  var cols = [
    ['common_name', 'Species'], ['display_status', 'Status'], ['extinction_year', 'Extinct (year)'],
    ['confidence', 'Confidence'], ['source', 'Source (key)'], ['peak_tier', 'Tier'], ['count_year', 'Count yr'], ['caveat', 'Caveat / data difficulty']
  ];
  function val(n, k) {
    if (k === 'confidence') return confidenceOf(n);
    if (k === 'source') return srcOf(n);
    if (k === 'caveat') return n.extinction_caveat || n.notes || '—';
    return (n[k] != null && n[k] !== '') ? n[k] : '—';
  }
  var rows = LEAF_ORDER.map(function (k) { return byKey[k]; });
  rows.sort(function (a, b) {
    var va = val(a, dqSort.key), vb = val(b, dqSort.key);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dqSort.dir;
    return String(va).localeCompare(String(vb)) * dqSort.dir;
  });
  var html = '<table class="dq"><thead><tr>';
  cols.forEach(function (c) { html += '<th data-k="' + c[0] + '">' + c[1] + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function (n) {
    html += '<tr>';
    cols.forEach(function (c) {
      var v = val(n, c[0]);
      if (c[0] === 'confidence') html += '<td><span class="conf ' + v + '">' + v + '</span></td>';
      else if (c[0] === 'caveat') html += '<td class="' + (/conflict/i.test(String(v)) ? 'caveat' : '') + '">' + esc(v) + '</td>';
      else html += '<td>' + esc(v) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  box.innerHTML = html;
  Array.prototype.forEach.call(box.querySelectorAll('th'), function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (dqSort.key === k) dqSort.dir = -dqSort.dir; else dqSort = { key: k, dir: 1 };
      buildTable();
    });
  });
}

// ---- init ----
(function init() {
  var viz = document.getElementById('viz');
  viz.innerHTML = '';
  var f = buildFrame();
  viz.appendChild(f.svg);
  renderRibbons(f);
  renderLabels(f);
  Array.prototype.forEach.call(document.querySelectorAll('.era-btn'), function (btn) {
    btn.addEventListener('click', function () {
      var era = btn.getAttribute('data-era');
      activeEra[era] = !activeEra[era];
      btn.setAttribute('aria-pressed', String(activeEra[era]));
      applyFilter();
    });
  });
  var lt = document.getElementById('label-toggle');
  if (lt) lt.addEventListener('click', function () {
    var on = lt.getAttribute('aria-pressed') !== 'true';
    lt.setAttribute('aria-pressed', String(on));
    lt.textContent = 'Labels: ' + (on ? 'on' : 'off');
    if (f.gL) f.gL.style.display = on ? '' : 'none';
  });
  var tt = document.getElementById('table-toggle');
  if (tt) tt.addEventListener('click', function () {
    var sec = document.getElementById('dq');
    var open = tt.getAttribute('aria-pressed') !== 'true';
    tt.setAttribute('aria-pressed', String(open));
    tt.textContent = 'Data table: ' + (open ? 'shown' : 'hidden');
    if (sec) sec.hidden = !open;
    if (open) buildTable();
  });
})();

