/* sankey_render.js — honeycreeper RIBBON-SANKEY renderer (v5).
   Layout/geometry comes from hc_model.js (nested phylogeny, fan-out layout, population widths, tapers);
   silhouettes come from hc_glyphs.js. Pure SVG + vanilla JS.
   Reads HC_NODES / HC_EDGES / HC_POP from data/honeycreeper_data.js. */
(function () {
  'use strict';

  var M = HCModel.build();
  var cfg = M.cfg, X = M.X;

  // ---------------- palette ----------------
  var ERA_COLOR = { prehistoric: '#8c6d31', historic: '#7b3294', edge: '#d6604d', present: '#2166ac' };
  var ERA_LABEL = { prehistoric: 'prehistoric', historic: 'historical', edge: 'edge of extinction', present: 'extant' };
  var STEM = { fill: '#9d94bd', edge: '#6f6696', trunk: '#8a83ad' };
  var ISLAND_COLOR = {
    'Kaua\u02BBi': '#19a39b', 'O\u02BBahu': '#e0b23a', 'Moloka\u02BBi': '#7fb069', 'L\u0101na\u02BBi': '#e76f51',
    'Maui': '#8e5bd9', 'Maui Nui': '#b69be8', 'Hawai\u02BBi': '#ee8a3c', 'Laysan': '#3b6fe0', 'Nihoa': '#12b5d6', 'unresolved': '#cbd5e1'
  };

  // ---------------- svg helpers ----------------
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(x, y, s, cls, anchor, parent) {
    var t = el('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'start' }, parent);
    t.textContent = s;
    return t;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var fmtN = function (v) { return v == null ? '\u2014' : Number(v).toLocaleString('en-US'); };
  var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };

  // ---------------- canvas geometry ----------------
  var H = M.Hcanvas;
  var GLYPH_X = X.X_NOW + 56;        // center of the "flying" column
  var LABEL_X = X.X_NOW + 128;       // species labels
  var SVG_W = LABEL_X + 380;
  var Y_TOP = M.yTop - 26, Y_BOT = M.yBot + 26;
  var GLYPH_K_FLY = 0.36, GLYPH_K_DEAD = 0.46;   // px per mm: one common scale per pose, so bigger birds draw bigger

  // ---------------- ribbon geometry -> path ----------------
  function ribbonPath(pts) {
    var top = [], bot = [], i;
    for (i = 0; i < pts.length; i++) {
      top.push(f1(pts[i][0]) + ',' + f1(pts[i][1] - pts[i][2] / 2));
      bot.push(f1(pts[i][0]) + ',' + f1(pts[i][1] + pts[i][2] / 2));
    }
    return 'M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z';
  }

  // ---------------- species helpers ----------------
  function noDna(sp) { return sp.has_dna === 'no'; }
  var DRIVER = {
    malaria: { label: 'Avian malaria (mosquito-borne)', color: '#d6604d' },
    predators: { label: 'Introduced predators', color: '#6b7280' },
    habitat: { label: 'Habitat loss / forest clearing', color: '#4d7c3a' },
    historical: { label: 'Historic loss (predation / habitat / collecting)', color: '#8b6f47' },
    unknown: { label: 'Driver unknown \u2014 subfossil only', color: '#b8bfca' }
  };
  function driverOf(n) {
    if (n.extant) return null;
    var k = n.key, sp = n.sp;
    if (n.undated) return 'unknown';
    var y = n.endYear;
    if (k === 'Melamprosops_phaeosoma') return 'habitat';
    if (/Rhodacanthis|Chloridops/.test(k)) return 'habitat';
    if (k === 'Psittirostra_psittacea' || k === 'Akialoa_lanaiensis' || k === 'Himatione_fraithii') return 'predators';
    return y >= 1890 ? 'malaria' : 'historical';
  }

  // =====================================================================
  //  FRAME
  // =====================================================================
  var svg = el('svg', { viewBox: '0 0 ' + SVG_W + ' ' + H, width: SVG_W, height: H, role: 'img' });
  (function attach() { var v = document.getElementById('viz'); v.innerHTML = ''; v.appendChild(svg); })();
  var defs = el('defs', {}, svg);
  var hatch = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 6, height: 6, fill: '#ffffff', 'fill-opacity': 0 }, hatch);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#ffffff', 'stroke-width': 2, 'stroke-opacity': 0.5 }, hatch);
  var gBg = el('g', { 'pointer-events': 'none' }, svg);
  var gLeg = el('g', { 'pointer-events': 'none' }, svg);
  var gRib = el('g', {}, svg);
  var gNodes = el('g', { 'pointer-events': 'none' }, svg);
  var gOver = el('g', { 'pointer-events': 'none' }, svg);
  var gGlyph = el('g', { 'pointer-events': 'none' }, svg);
  var gLab = el('g', { 'pointer-events': 'none' }, svg);

  (function frame() {
    var x0 = 14, x1 = X.XB1 + 10;
    // one continuous panel behind everything
    el('rect', { x: x0, y: Y_TOP - 30, width: x1 - x0, height: (Y_BOT - Y_TOP) + 60, rx: 10, fill: '#f6f7fb' }, gBg);

    // ---- human-epoch bands: Polynesian era, malaria era
    var xP0 = X.xCE(1000), xP1 = X.xCE(1778);
    el('rect', { x: xP0, y: Y_TOP - 30, width: xP1 - xP0, height: (Y_BOT - Y_TOP) + 60, fill: '#f1e7d2', 'fill-opacity': 0.55 }, gBg);
    var xM0 = X.xCE(1900), xN = X.X_NOW;
    el('rect', { x: xM0, y: Y_TOP - 30, width: xN - xM0, height: (Y_BOT - Y_TOP) + 60, fill: '#f6d9d3', 'fill-opacity': 0.55 }, gBg);
    var xC0 = X.xCE(1826);
    el('rect', { x: xC0, y: Y_TOP - 30, width: xM0 - xC0, height: (Y_BOT - Y_TOP) + 60, fill: '#e6e0ee', 'fill-opacity': 0.5 }, gBg);

    // ---- deep-time gridlines (every fork column on the lattice) + ticks
    var gridT = [5.7, 4.6, 4.0, 3.4, 3.0, 2.7, 2.4, 2.1, 1.8, 1.5, 1.2, 0.9, 0.6];
    gridT.forEach(function (t) {
      var x = X.xDeep(t);
      el('line', { x1: x, y1: Y_TOP - 20, x2: x, y2: Y_BOT + 20, stroke: '#e4e7f0', 'stroke-width': 1 }, gBg);
    });

    // ---- axis break
    var bx0 = X.xDeepEnd + 18, bx1 = X.XB0 - 18, by0 = Y_TOP - 30, by1 = Y_BOT + 30;
    function zig(xa, dir) {
      var d = 'M' + xa + ',' + by0, y = by0, k = 0;
      while (y < by1) { y += 22; k++; d += ' L' + (xa + (k % 2 ? 7 : 0) * dir) + ',' + Math.min(y, by1); }
      return d;
    }
    el('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, fill: '#ffffff', 'fill-opacity': 0.9 }, gOver);
    el('path', { d: zig(bx0, 1), fill: 'none', stroke: '#9aa3b2', 'stroke-width': 1.4 }, gOver);
    el('path', { d: zig(bx1, 1), fill: 'none', stroke: '#9aa3b2', 'stroke-width': 1.4 }, gOver);
    var bm = (bx0 + bx1) / 2;
    var gt = el('g', { transform: 'translate(' + bm + ',' + ((Y_TOP + Y_BOT) / 2) + ') rotate(-90)' }, gOver);
    txt(0, 4, 'axis break \u00B7 0.5 million years ago \u2192 1000 CE (not to scale)', 'break-label', 'middle', gt);

    // ---- top axis: deep time
    var gAx = el('g', { 'class': 'axis' }, gOver);
    var ty = Y_TOP - 44;
    txt(X.xDeep(7.2), ty - 30, 'DEEP TIME \u00B7 millions of years ago', 'panel-cap', 'start', gAx);
    [7.2, 6, 5, 4, 3, 2, 1, 0.5].forEach(function (t) {
      var x = X.xDeep(t);
      el('line', { x1: x, y1: ty + 6, x2: x, y2: ty + 13, stroke: '#94a3b8' }, gAx);
      txt(x, ty, (t === 7.2 ? '7.2 mya' : t === 0.5 ? '0.5' : String(t)), null, 'middle', gAx);
    });
    // ---- top axis: human epoch
    txt(X.XB0, ty - 30, 'HUMAN EPOCH \u00B7 calendar years CE (stretches toward the present)', 'panel-cap', 'start', gAx);
    [1000, 1500, 1778, 1826, 1900, 1950, 2000].forEach(function (yr) {
      var x = X.xCE(yr);
      el('line', { x1: x, y1: ty + 6, x2: x, y2: ty + 13, stroke: '#94a3b8' }, gAx);
      txt(x, ty, String(yr), null, 'middle', gAx);
    });
    txt(X.X_NOW, ty, 'now', null, 'middle', gAx);

    // ---- milestone lines (human epoch)
    function mil(yr, color, label, dy, w, dash) {
      var x = X.xCE(yr);
      el('line', { x1: x, y1: Y_TOP - 22, x2: x, y2: Y_BOT + 22, stroke: color, 'stroke-width': w || 1, 'stroke-dasharray': dash || '3 4', 'stroke-opacity': 0.8 }, gBg);
      var t = txt(x + 5, Y_BOT + 40 + dy, label, 'milo-tick', 'start', gBg);
      t.setAttribute('fill', color);
    }
    mil(1000, '#8c6d31', '\u22481000 Polynesians arrive', 0);
    mil(1778, '#7b3294', '1778 Cook', 16);
    mil(1826, '#64748b', '1826 Culex mosquito', 32);
    mil(1900, '#d6604d', '1900 avian malaria spreads', 0);
    mil(2023, '#b91c1c', '2023: USFWS declares 6 extinct', 16, 1.6, '5 3');
    // "now" line, drawn in the frame BELOW the glyph layer
    el('line', { x1: X.X_NOW, y1: Y_TOP - 22, x2: X.X_NOW, y2: Y_BOT + 22, stroke: '#2166ac', 'stroke-width': 1.6, 'stroke-opacity': 0.55 }, gBg);
  })();

  // =====================================================================
  //  RIBBONS
  // =====================================================================
  var ribbonEls = {}, glyphEls = {}, labelEls = {};
  var activeEra = { prehistoric: true, historic: true, edge: true, present: true };

  function fateColor(n) { return ERA_COLOR[n.era]; }

  // stem (Carpodacus split -> crown)
  (function stem() {
    var s = M.stem;
    var yT = s.y - s.H / 2;
    var d = 'M' + f1(s.x0) + ',' + f1(yT) + ' L' + f1(s.x1) + ',' + f1(yT) + ' L' + f1(s.x1) + ',' + f1(yT + s.H) + ' L' + f1(s.x0) + ',' + f1(yT + s.H) + ' Z';
    el('path', { d: d, fill: STEM.trunk, 'fill-opacity': 0.92, stroke: STEM.edge, 'stroke-width': 1, 'stroke-opacity': 0.6 }, gRib);
    txt(s.x0 + 6, yT - 34, 'Honeycreeper founding lineage', 'trunk-label', 'start', gLab);
    txt(s.x0 + 6, yT - 14, 'split from the rosefinches (Carpodacus) \u2248 7.2 mya', 'trunk-sub', 'start', gLab);
  })();

  // internal ribbons first (behind), then species ribbons
  var order = M.ribbons.slice().sort(function (a, b) { return (a.isLeaf ? 1 : 0) - (b.isLeaf ? 1 : 0) || b.node.H - a.node.H; });
  var cladeStats = {};
  M.nodes.forEach(function (n) {
    var L = M.ribbons.filter(function (r) { return r.node === n; })[0];
    var lv = (function c(x, o) { o = o || []; if (x.isLeaf) o.push(x); else x.kids.forEach(function (k) { c(k, o); }); return o; })(n);
    cladeStats[n.key] = { total: lv.length, extant: lv.filter(function (l) { return l.extant; }).length };
  });

  order.forEach(function (r) {
    var n = r.node;
    var d = ribbonPath(r.pts);
    if (!r.isLeaf) {
      var cg = el('g', { 'class': 'ribbon clade', 'data-key': n.key }, gRib);
      el('path', { d: d, fill: STEM.fill, 'fill-opacity': 0.9, stroke: STEM.edge, 'stroke-width': 0.8, 'stroke-opacity': 0.55 }, cg);
      ribbonEls[n.key] = cg;
      cg.addEventListener('mousemove', function (e) { highlight(n); moveTip(e, cladeTip(n)); });
      cg.addEventListener('mouseleave', function () { highlight(null); hideTip(); });
      return;
    }
    // species ribbon: starts in the parent's color, blends to its fate color
    var gid = 'g_' + n.key.replace(/[^A-Za-z0-9_]/g, '_');
    var lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: r.x0, y1: 0, x2: r.x0 + r.hop + 120, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': STEM.fill }, lg);
    el('stop', { offset: '1', 'stop-color': fateColor(n) }, lg);
    var q = el('g', { 'class': 'ribbon ' + (n.extant ? 'ribbon-it' : 'ribbon-ext'), 'data-key': n.key, 'data-era': n.era }, gRib);
    el('path', { d: d, fill: 'url(#' + gid + ')', 'fill-opacity': n.extant ? 0.92 : 0.86, stroke: fateColor(n), 'stroke-width': 0.9, 'stroke-opacity': 0.5 }, q);
    if (noDna(n.sp)) el('path', { d: d, fill: 'url(#hatch)', stroke: 'none', 'pointer-events': 'none' }, q);
    if (n.pop && n.pop.surveys) n.pop.surveys.forEach(function (yr) {   // dots where a real survey count exists
      var sx = X.xCE(yr), rb = M.ribbonAt(r, sx);
      el('circle', { cx: f1(sx), cy: f1(rb.y), r: 3.1, fill: '#ffffff', stroke: '#0d3a6b', 'stroke-width': 1.5, 'pointer-events': 'none' }, q);
    });
    ribbonEls[n.key] = q;
    q.addEventListener('mousemove', function (e) { highlight(n); moveTip(e, tooltipHTML(n)); });
    q.addEventListener('mouseleave', function () { highlight(null); hideTip(); });
  });

  // node bars
  M.nodes.forEach(function (n) {
    var x = n.x - cfg.barW / 2, y = n.cyDraw - n.Hx / 2;
    el('rect', { x: x, y: y, width: cfg.barW, height: n.Hx, rx: 2.5, fill: STEM.edge, 'fill-opacity': 0.92 }, gNodes);
  });

  // clade labels on the nodes that tell the story
  var CLADE_LABELS = {
    cl_creepers_primary: null, primary_clade: 'primary clade \u00B7 the \u201Cbig bang\u201D',
    cl_lost: 'the lost clade \u2014 not one survivor', cl_nectar: 'red nectar-feeders', cl_finch: 'finch-billed clade',
    cl_G: '\u02BBamakihi \u00B7 \u02BBakepa \u00B7 nukupu\u02BBu', cl_akialoa_magumma: '\u02BBakialoa + \u02BBanianiau'
  };
  Object.keys(CLADE_LABELS).forEach(function (k) {
    var n = M.T[k]; if (!n || !CLADE_LABELS[k]) return;
    txt(n.x + 8, n.cyDraw - n.Hx / 2 - 8, CLADE_LABELS[k], 'clade-label', 'start', gLab);
  });

  // =====================================================================
  //  ENDS: glyphs + labels
  // =====================================================================
  // mounts a silhouette into group g; returns its pixel extent and tail-tip anchor relative to the glyph origin
  function mountGlyph(g, sp, pose, k, facing, style) {
    var gl = HCGlyphs.draw(sp, { pose: pose, scale: k, facing: facing });
    var root = gl.mount(g, style);
    var bb = root.getBBox();
    var x0 = facing > 0 ? bb.x * k : -(bb.x + bb.width) * k;
    return { x0: x0, x1: x0 + bb.width * k, y0: bb.y * k, y1: (bb.y + bb.height) * k,
      ax: gl.anchor ? gl.anchor[0] * k * facing : 0, ay: gl.anchor ? gl.anchor[1] * k : 0 };
  }
  var STYLE_EXT = { body: '#4b5563', opacity: 0.92, legW: 2.1, lineW: 1.3 }, STYLE_IT = { body: '#0b1220' };
  var prevFly = null;
  M.leaves.forEach(function (n) {
    var r = n.ribbon;
    var yEnd = M.ribbonAt(r, n.endX - 1).y;
    var isX = !n.extant;
    var g = el('g', { 'class': 'end-glyph', 'data-era': n.era }, gGlyph);
    if (typeof HCGlyphs !== 'undefined') {
      var ex = mountGlyph(g, n.sp, isX ? 'dead' : 'flying', isX ? GLYPH_K_DEAD : GLYPH_K_FLY, 1, isX ? STYLE_EXT : STYLE_IT);
      var tx, ty;
      if (isX) {
        tx = n.endX + 7 - ex.ax;                                   // its tail starts where its own ribbon comes to a point
        ty = yEnd - ex.ay;                                         // and the bird lies on that row's line
      } else {
        // flying column; consecutive survivors alternate a little left/right so their wings don't stack
        var close = prevFly !== null && (yEnd - prevFly.y) < 46;
        var stag = close ? !prevFly.stag : false;
        prevFly = { y: yEnd, stag: stag };
        tx = GLYPH_X + (stag ? 14 : -10) - (ex.x0 + ex.x1) / 2;
        ty = yEnd - (ex.y0 + ex.y1) / 2;
      }
      g.setAttribute('transform', 'translate(' + f1(tx) + ',' + f1(ty) + ')');
    } else {
      g.setAttribute('transform', 'translate(' + f1(isX ? n.endX + 10 : GLYPH_X) + ',' + f1(yEnd) + ')');
      el('circle', { r: 4, fill: isX ? '#64748b' : '#111827' }, g);
    }
    glyphEls[n.key] = g;

    // label: name + (population | extinction year) in ONE text element, so the two can never overlap
    var sp = n.sp;
    var lg = el('g', { 'data-era': n.era }, gLab);
    var meta = n.extant ? (n.pop ? '\u2248' + compactN(n.nowN) : '') : (n.undated ? '\u2020' : '\u2020 ' + n.endYear);
    var t = el('text', { x: LABEL_X, y: f1(yEnd + 5), 'class': 'sp-label ' + (n.extant ? 'it' : 'ex') }, lg);
    t.appendChild(document.createTextNode(sp.common_name));
    if (meta) {
      var tm = el('tspan', { 'class': 'sp-sub' + (sp.declared_extinct_2023 ? ' decl' : ''), dx: 7 }, t);
      tm.textContent = meta;
    }
    var dk = n.extant ? null : driverOf(n);
    el('circle', { cx: LABEL_X - 13, cy: f1(yEnd), r: 3.6, fill: n.extant ? ERA_COLOR.present : (dk ? DRIVER[dk].color : '#b8bfca') }, lg);
    if (sp.declared_extinct_2023) el('circle', { cx: LABEL_X - 13, cy: f1(yEnd), r: 7.4, fill: 'none', stroke: '#b91c1c', 'stroke-width': 1.7 }, lg);
    labelEls[n.key] = lg;
  });
  function compactN(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e4) return Math.round(v / 1e3) + 'k';
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v));
  }

  // =====================================================================
  //  LEGEND (sits in the empty top-left of the deep-time panel)
  // =====================================================================
  (function legend() {
    var g = el('g', { 'class': 'legend' }, gLeg);
    var x0 = 52, y0 = Y_TOP - 8, w = 744;
    var box = el('rect', { x: x0, y: y0, width: w, height: 10, rx: 12, fill: '#ffffff', 'fill-opacity': 0.94, stroke: '#d9deea' }, g);
    function T(x, y, s, cls, anchor) { return txt(x0 + x, y0 + y, s, cls || 'lg-t', anchor || 'start', g); }
    function smoothstep(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    var yy = 38;
    T(24, yy, 'HOW TO READ THIS', 'lg-h');

    // -- width key
    yy += 40; T(24, yy, 'Ribbon width = number of birds (log scale)', 'lg-b');
    var yS = yy + 28;
    [[100, '100'], [1000, '1,000'], [1e4, '10,000'], [1e5, '100,000'], [1e6, '1 million']].forEach(function (s, i) {
      var wpx = M.W(s[0]), cx = x0 + 24 + i * 142;
      el('rect', { x: cx, y: y0 + yS - wpx / 2, width: 92, height: wpx, rx: wpx / 2.6, fill: ERA_COLOR.present, 'fill-opacity': 0.92 }, g);
      T(24 + i * 142, yS + 32, s[1], 'lg-t');
    });

    // -- life-cycle sample: born small, widens, tapers to a point
    yy = yS + 76; T(24, yy, 'Through time', 'lg-b');
    var yR = yy + 32;
    var pts = [], L = 560, base = 17;
    for (var sx = 0; sx <= L; sx += 4) {
      var wv = sx < 170 ? base * (cfg.birthFrac + (1 - cfg.birthFrac) * smoothstep(sx / 170)) : (sx < 330 ? base : base * (1 - Math.pow((sx - 330) / (L - 330), cfg.taperPow)));
      pts.push([x0 + 24 + sx, y0 + yR, Math.max(0, wv)]);
    }
    var gidL = 'lg_life';
    var lgr = el('linearGradient', { id: gidL, gradientUnits: 'userSpaceOnUse', x1: x0 + 24, y1: 0, x2: x0 + 24 + L, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': STEM.fill }, lgr);
    el('stop', { offset: '0.6', 'stop-color': ERA_COLOR.edge }, lgr);
    el('stop', { offset: '1', 'stop-color': ERA_COLOR.edge }, lgr);
    el('path', { d: ribbonPath(pts), fill: 'url(#' + gidL + ')', 'fill-opacity': 0.88 }, g);
    T(24, yR + 32, 'born small, widens as the group radiates (modeled)', 'lg-t');
    T(24 + L, yR + 54, 'tapers to a point at extinction', 'lg-t', 'end');
    el('circle', { cx: x0 + 24 + L + 56, cy: y0 + yR, r: 3.1, fill: '#fff', stroke: '#0d3a6b', 'stroke-width': 1.5 }, g);
    T(24 + L + 70, yR + 5, 'survey', 'lg-t');
    T(24 + L + 70, yR + 27, 'count', 'lg-t');

    // -- color key + marks
    yy = yR + 92; T(24, yy, 'Color and marks', 'lg-b');
    var r1 = yy + 30, r2 = yy + 58, r3 = yy + 86;
    [[STEM.fill, 'shared ancestry', 24, r1], [ERA_COLOR.present, 'alive today', 270, r1], [ERA_COLOR.prehistoric, 'lost before 1500 (subfossil)', 470, r1],
      [ERA_COLOR.historic, 'lost 1500\u20131900', 24, r2], [ERA_COLOR.edge, 'lost after 1900 (malaria era)', 270, r2]].forEach(function (c) {
      el('rect', { x: x0 + c[2], y: y0 + c[3] - 13, width: 32, height: 14, rx: 4, fill: c[0] }, g);
      T(c[2] + 42, c[3] - 1, c[1], 'lg-t');
    });
    el('rect', { x: x0 + 24, y: y0 + r3 - 13, width: 32, height: 14, rx: 4, fill: ERA_COLOR.prehistoric }, g);
    el('rect', { x: x0 + 24, y: y0 + r3 - 13, width: 32, height: 14, rx: 4, fill: 'url(#hatch)' }, g);
    T(66, r3 - 1, 'hatched = placement inferred (no DNA)', 'lg-t');
    el('circle', { cx: x0 + 497, cy: y0 + r3 - 6, r: 7.4, fill: 'none', stroke: '#b91c1c', 'stroke-width': 1.7 }, g);
    el('circle', { cx: x0 + 497, cy: y0 + r3 - 6, r: 3.6, fill: ERA_COLOR.edge }, g);
    T(514, r3 - 1, 'declared extinct 2023', 'lg-t');
    var r4 = r3 + 32, r5 = r4 + 28;   // the dot beside each extinct name is a rule-of-thumb guess at the main driver of loss
    T(24, r4, 'Dot beside a name = likely main driver of loss (rule of thumb)', 'lg-t');
    [['malaria', 'malaria', 24], ['predators', 'predators', 114], ['habitat', 'habitat loss', 221], ['historical', 'earlier losses', 353], ['unknown', 'unknown', 501]].forEach(function (d) {
      el('circle', { cx: x0 + d[2] + 6, cy: y0 + r5 - 5, r: 5, fill: DRIVER[d[0]].color }, g);
      T(d[2] + 18, r5, d[1], 'lg-t');
    });

    // -- bird key
    yy = r5 + 42; T(24, yy, 'Birds', 'lg-b');
    var yB = yy + 34;
    if (typeof HCGlyphs !== 'undefined') {
      var spFly = M.T.Drepanis_coccinea ? M.T.Drepanis_coccinea.sp : M.leaves[0].sp;
      var spPer = M.T.Drepanis_funerea ? M.T.Drepanis_funerea.sp : M.leaves[M.leaves.length - 1].sp;
      var g1 = el('g', {}, g), a1 = mountGlyph(g1, spFly, 'flying', GLYPH_K_FLY * 1.2, 1, STYLE_IT);
      g1.setAttribute('transform', 'translate(' + (x0 + 70 - (a1.x0 + a1.x1) / 2) + ',' + (y0 + yB - (a1.y0 + a1.y1) / 2) + ')');
      T(118, yB + 6, 'flying = survives today', 'lg-t');
      var g2 = el('g', {}, g), a2 = mountGlyph(g2, spPer, 'dead', GLYPH_K_DEAD * 1.2, 1, STYLE_EXT);
      g2.setAttribute('transform', 'translate(' + (x0 + 330 - a2.x0) + ',' + (y0 + yB - (a2.y0 + a2.y1) / 2) + ')');
      T(330 + (a2.x1 - a2.x0) + 16, yB + 6, 'on its back = extinct', 'lg-t');
    }
    T(24, yB + 48, 'Body, wing, tail and bill are scaled from measured size; bill curvature is qualitative.', 'lg-t sm');
    box.setAttribute('height', yB + 48 + 22);
  })();

  // =====================================================================
  //  TOOLTIPS + HIGHLIGHT
  // =====================================================================
  var allKeys = Object.keys(ribbonEls);
  function ancestry(n) { var o = [], x = n; while (x && x.key !== 'carpodacus') { o.push(x.key); x = x.parent; } return o; }
  function descendants(n, o) { o = o || []; o.push(n.key); if (!n.isLeaf) n.kids.forEach(function (k) { descendants(k, o); }); return o; }
  function highlight(n) {
    if (!n) { allKeys.forEach(function (k) { ribbonEls[k].classList.remove('dim'); }); Object.keys(glyphEls).forEach(function (k) { glyphEls[k].classList.remove('dim'); labelEls[k].classList.remove('dim'); }); return; }
    var on = {};
    ancestry(n).forEach(function (k) { on[k] = 1; });
    if (!n.isLeaf) descendants(n).forEach(function (k) { on[k] = 1; });
    allKeys.forEach(function (k) { ribbonEls[k].classList[on[k] ? 'remove' : 'add']('dim'); });
    Object.keys(glyphEls).forEach(function (k) { var d = on[k] ? 'remove' : 'add'; glyphEls[k].classList[d]('dim'); labelEls[k].classList[d]('dim'); });
  }

  function parentLabel(n) {
    var p = n.parent;
    if (!p) return '\u2014';
    if (p.key === 'hc_ancestor') return 'founding honeycreeper lineage';
    return p.label || p.key;
  }
  function popLine(n) {
    if (n.extant && n.pop) {
      var a = n.pop.anchors, last = a[a.length - 1];
      return '\u2248' + fmtN(Math.round(n.nowN)) + ' birds (' + (last[0]) + ')' + (n.pop.confidence === 'measured' ? ' \u00B7 survey' : ' \u00B7 order of magnitude');
    }
    return null;
  }
  function tooltipHTML(n) {
    var sp = n.sp, rows = [];
    rows.push('<div class="tt-name">' + esc(sp.common_name) + '</div>');
    rows.push('<div class="tt-sci">' + esc(sp.key.replace(/_/g, ' ')) + '</div>');
    var flag = n.extant
      ? '<span class="tt-flag" style="background:var(--present);color:#fff">EXTANT</span>'
      : n.undated
        ? '<span class="tt-flag" style="background:var(--prehistoric);color:#fff">PREHISTORIC \u2020 (undated)</span>'
        : '<span class="tt-flag" style="background:' + ERA_COLOR[n.era] + ';color:#fff">EXTINCT ' + esc(sp.extinction_year) + '</span>';
    if (sp.declared_extinct_2023) flag += ' <span class="tt-flag" style="background:#b91c1c;color:#fff">declared extinct 2023</span>';
    if (sp.has_dna === 'no') flag += ' <span class="tt-flag" style="background:#334155;color:#fff">no DNA \u00B7 placement inferred</span>';
    else if (sp.has_dna === 'low') flag += ' <span class="tt-flag" style="background:#334155;color:#fff">poor-quality DNA</span>';
    rows.push(flag);
    rows.push('<div class="tt-row"><span class="tt-k">Branch</span> ' + esc(parentLabel(n)) + ' \u00B7 split \u2248' + n.birth.toFixed(1) + ' mya</div>');
    rows.push('<div class="tt-row"><span class="tt-k">Status</span> ' + esc(sp.extinction_caveat || (n.extant ? 'Present day' : 'extinct ' + sp.extinction_year)) + '</div>');
    var pl = popLine(n);
    if (pl) rows.push('<div class="tt-row"><span class="tt-k">Population</span> ' + pl + '</div>');
    else rows.push('<div class="tt-row"><span class="tt-k">Population</span> unknown \u2014 ribbon width is an assumed ' + esc(sp.peak_tier) + ' tier</div>');
    if (sp.peak_cite) rows.push('<div class="tt-row"><span class="tt-k">Source</span> ' + esc(sp.peak_cite) + '</div>');
    rows.push('<div class="tt-row"><span class="tt-k">Range</span> ' + esc(sp.range) + (sp.island_conf === 'low' ? ' <span class="caveat">(island unresolved)</span>' : '') + '</div>');
    var dk = driverOf(n);
    if (dk) rows.push('<div class="tt-row"><span class="tt-k">Primary driver</span> <span style="font-weight:700;color:' + (dk === 'malaria' ? '#fca5a5' : '#e5e7eb') + '">' + DRIVER[dk].label + '</span></div>');
    rows.push('<div class="tt-row"><span class="tt-k">Beak</span> ' + esc(sp.beak_shape) + ' \u00B7 ' + esc(sp.beak_length_culmen) + ' mm culmen \u00B7 <span class="tt-k">mass</span> ' + esc(sp.body_mass) + ' g</div>');
    rows.push('<div class="tt-row"><span class="tt-k">Wing / tail / tarsus</span> ' + esc(sp.wing_length) + ' / ' + esc(sp.tail_length) + ' / ' + esc(sp.tarsus_length) + ' mm</div>');
    if (n.endEstimated) rows.push('<div class="tt-row caveat">\u26A0 Undated subfossil lineage: the end point is an arbitrary spread across the Polynesian-era window (1000\u20131778 CE), not a date.</div>');
    var conflict = (sp.extinction_caveat && /conflict/i.test(sp.extinction_caveat)) || (sp.notes && /conflict/i.test(sp.notes));
    if (conflict) rows.push('<div class="tt-row caveat">\u26A0 Data difficulty: sources disagree on the extinction year.</div>');
    return rows.join('');
  }
  function cladeTip(n) {
    var st = cladeStats[n.key] || { total: 0, extant: 0 };
    var rows = [];
    rows.push('<div class="tt-name">' + esc(n.label || n.key) + '</div>');
    rows.push('<div class="tt-row">' + st.total + ' lineages \u00B7 <b>' + st.extant + ' survive</b> \u00B7 ' + (st.total - st.extant) + ' extinct</div>');
    rows.push('<div class="tt-row"><span class="tt-k">Splits into its branches</span> \u2248' + n.t.toFixed(1) + ' mya</div>');
    rows.push('<div class="tt-row"><span class="tt-k">Evidence</span> ' + (n.ev === 'dna' ? 'genome-scale DNA tree (Campana et al. 2026)' : 'inferred from taxonomy (no usable DNA)') + '</div>');
    if (st.extant === 0) rows.push('<div class="tt-row caveat">An entire branch of the honeycreeper tree has been lost.</div>');
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

  // =====================================================================
  //  FILTERS / TABLE / INIT
  // =====================================================================
  function applyFilter() {
    M.leaves.forEach(function (n) {
      var d = activeEra[n.era] ? '' : 'none';
      ribbonEls[n.key].style.display = d; glyphEls[n.key].style.display = d; labelEls[n.key].style.display = d;
    });
  }
  function confidenceOf(n) {
    var sp = n.sp, conflict = /conflict|vs 19|1891|1896/i.test((sp.extinction_caveat || '') + (sp.notes || ''));
    if (sp.has_dna === 'no') return 'low';
    if (conflict) return 'low';
    if (!n.extant) return 'med';
    return n.pop && n.pop.confidence === 'measured' ? 'high' : 'med';
  }
  function srcOf(sp) {
    var s = [];
    if (sp.avotrex_key) s.push('AVOTREX:' + sp.avotrex_key);
    if (sp.avonet_key) s.push('AVONET:' + sp.avonet_key);
    if (!s.length) s.push('Wikipedia 2026 (hand-keyed)');
    return s.join(' + ');
  }
  var dqSort = { key: 'common_name', dir: 1 };
  function buildTable() {
    var box = document.getElementById('dq-table');
    if (!box) return;
    var cols = [['common_name', 'Species'], ['status', 'Status'], ['end', 'Extinct (year)'], ['confidence', 'Confidence'], ['dna', 'DNA'], ['source', 'Source (key)'],
      ['pop', 'Population (now)'], ['island', 'Island'], ['caveat', 'Caveat / data difficulty']];
    function val(n, k) {
      var sp = n.sp;
      if (k === 'status') return n.extant ? 'extant' : ERA_LABEL[n.era];
      if (k === 'end') return n.extant ? '\u2014' : (n.undated ? 'undated (subfossil)' : n.endYear);
      if (k === 'confidence') return confidenceOf(n);
      if (k === 'dna') return sp.has_dna;
      if (k === 'source') return srcOf(sp);
      if (k === 'pop') return n.extant && n.pop ? '\u2248' + fmtN(Math.round(n.nowN)) + ' (' + n.pop.anchors[n.pop.anchors.length - 1][0] + ')' : '\u2014';
      if (k === 'island') return sp.island + (sp.island_conf === 'low' ? ' (unresolved)' : '');
      if (k === 'caveat') return sp.extinction_caveat || sp.notes || '\u2014';
      return sp[k] != null && sp[k] !== '' ? sp[k] : '\u2014';
    }
    var rows = M.leaves.slice();
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

  (function init() {
    var viz = document.getElementById('viz');
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
      gLab.style.display = on ? '' : 'none';
    });
    var zt = document.getElementById('zoom-toggle');   // fit-to-window <-> full size with horizontal scroll
    if (zt) zt.addEventListener('click', function () {
      var full = zt.getAttribute('aria-pressed') !== 'true';
      zt.setAttribute('aria-pressed', String(full));
      zt.textContent = 'Zoom: ' + (full ? '1:1 (scroll)' : 'fit');
      var sc = document.getElementById('viz-scroll');
      sc.style.overflowX = full ? 'auto' : 'hidden';
      svg.style.width = full ? SVG_W + 'px' : '';
      svg.style.maxWidth = full ? 'none' : '';
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
    window.HC_MODEL = M; // handy for debugging / render scripts
  })();
})();
