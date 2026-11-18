/* hc_model.js — layout + geometry model for the honeycreeper ribbon-Sankey (pure JS, no DOM; also loadable in Node).
   Input globals: HC_NODES, HC_EDGES, HC_POP (poc/data/honeycreeper_data.js).
   HCModel.build(cfg) returns { cfg, T, root, leaves, nodes, ribbons, X:{…}, Hcanvas, … }.

   LAYOUT IN ONE PARAGRAPH
   A flow-conserving ("alluvial") layout is computed first: every clade ribbon is as thick as the sum of its
   descendants' founding widths, so the founding trunk is one tall band that is sliced by the nested nodes.
   A second layout puts every node at the center of its leaf rows (generous row pitch). The picture shown is a smooth
   blend of the two:  y(x) = (1-Φ(x))·compact + Φ(x)·rows,  Φ rising from 0 at the crown to 1 at the end of the
   deep-time panel.  That is what makes the ribbons FAN out of the trunk. A short S-curve at every fork absorbs the
   offset between the parent's slot and the child's place on the fan, so ribbons leave their parent at distributed
   slots, never cross, and never overlap (a convex blend of two non-overlapping arrangements). */
var HCModel = (function () {
  'use strict';

  var DEFAULTS = {
    pitch: 32,            // leaf row pitch (px)
    topPad: 130, botPad: 110,
    barW: 7,              // node bar thickness
    slotGap: 1.2,         // gap between slots on a node bar
    wMin: 1.2, wMax: 22,  // ribbon width range (px)
    logLo: 1.7, logHi: 6.3, wLo: 2.5, wHi: 21.5, // width = f(log10 birds)
    X0: 30,               // x of the stem origin (7.2 mya)
    deepKnots: [[7.2, 0], [3.4, 470], [0.5, 1360]], // piecewise-linear deep-time axis: [mya, px from X0]
    tStem: 7.2, tDeepEnd: 0.5,
    phiPow: 1.5,          // shape of the fan-out Φ(x)
    breakGap: 84,         // pixels reserved for the axis break
    humanW: 820,          // width of the human-epoch panel
    ceKnots: [[1000, 0], [1800, 0.30], [1950, 0.54], [2026, 1]], // piecewise-linear CE axis (year, fraction of panel)
    nowYear: 2026,
    taperPx: 100,         // visual taper length (px) before an extinct ribbon's tip
    undatedWindow: [1090, 1760], // undated subfossil lineages end somewhere inside this window
    fullPastBreak: -50,   // Φ (fan-out) reaches 1 this far past the break (negative = before it)
    birthFrac: 0.6,       // a lineage is born at this fraction of its tier width and widens as the radiation fans out
    leafHop: 110,         // S-curve length for leaf-only parents
    tierN: { abundant: 4e5, common: 3e4, rare: 3e3, critical: 3e2 },
    taperPow: 1.8
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  function build(userCfg) {
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = DEFAULTS[k]; });
    if (userCfg) Object.keys(userCfg).forEach(function (k) { cfg[k] = userCfg[k]; });

    // ================= tree =================
    var spp = {};
    HC_NODES.forEach(function (n) { spp[n.key] = n; });
    var T = {};
    function tn(key) {
      if (!T[key]) T[key] = { key: key, kids: [], parent: null, isLeaf: !!spp[key], sp: spp[key] || null, label: null, t: null, ev: null };
      return T[key];
    }
    HC_EDGES.forEach(function (e) {
      var p = tn(e.parent_key), c = tn(e.child_key);
      p.kids.push(c); c.parent = p;
      p.t = parseFloat(e.divergence_mya);
      c.birth = p.t; c.ev = e.evidence; c.edge = e;
      if (e.child_label) c.label = e.child_label;
    });
    var root = T.hc_ancestor;
    var stemT = parseFloat(root.edge.divergence_mya);

    // ================= leaf fate =================
    function eraOf(sp) {
      if (sp.display_status === 'extant') return 'present';
      var y = parseInt(sp.extinction_year || '1400', 10);
      if (y < 1500) return 'prehistoric';
      if (y < 1900) return 'historic';
      return 'edge';
    }
    Object.keys(T).forEach(function (k) {
      var n = T[k]; if (!n.isLeaf) return;
      var sp = n.sp;
      n.era = eraOf(sp);
      n.extant = sp.display_status === 'extant';
      n.endYear = n.extant ? null : (sp.extinction_year ? parseInt(sp.extinction_year, 10) : null);
      n.undated = !n.extant && n.endYear == null;
    });

    // ================= vertical order: survivors on top =================
    function stats(n) {
      if (n._stats) return n._stats;
      if (n.isLeaf) return (n._stats = { leaves: 1, extant: n.extant ? 1 : 0, score: n.extant ? 3000 : (n.endYear || 1400) });
      var s = { leaves: 0, extant: 0, sum: 0 };
      n.kids.forEach(function (k) { var q = stats(k); s.leaves += q.leaves; s.extant += q.extant; s.sum += q.score * q.leaves; });
      s.score = s.sum / s.leaves; n._stats = s; return s;
    }
    (function order(n) {
      if (n.isLeaf) return;
      n.kids.forEach(order);
      n.kids.sort(function (a, b) {
        var A = stats(a), B = stats(b);
        var fa = A.extant / A.leaves, fb = B.extant / B.leaves;
        if (Math.abs(fa - fb) > 1e-9) return fb - fa;
        if (Math.abs(A.score - B.score) > 1e-9) return B.score - A.score;
        return B.leaves - A.leaves;
      });
    })(root);
    var leaves = [];
    (function walk(n) { if (n.isLeaf) leaves.push(n); else n.kids.forEach(walk); })(root);
    leaves.forEach(function (n, i) { n.idx = i; });

    // ================= population width model =================
    function W(N) {
      if (N <= 0) return 0;
      var u = (Math.log(N) / Math.LN10 - cfg.logLo) / (cfg.logHi - cfg.logLo);
      return clamp(cfg.wLo + (cfg.wHi - cfg.wLo) * u, cfg.wMin, cfg.wMax);
    }
    leaves.forEach(function (n) {
      var sp = n.sp, pop = HC_POP[n.key] || null;
      n.pop = pop;
      n.baseN = pop ? pop.anchors[0][1] : (cfg.tierN[sp.peak_tier] || cfg.tierN.rare);
      n.w0 = W(n.baseN);
      n.nAt = function (year) {
        if (!pop) return n.baseN;
        var a = pop.anchors;
        if (year <= a[0][0]) return a[0][1];
        for (var i = 0; i < a.length - 1; i++) {
          if (year <= a[i + 1][0]) {
            var u = smooth((year - a[i][0]) / (a[i + 1][0] - a[i][0]));
            return Math.exp(Math.log(Math.max(a[i][1], 0.5)) * (1 - u) + Math.log(Math.max(a[i + 1][1], 0.5)) * u);
          }
        }
        return a[a.length - 1][1];
      };
      n.nowN = n.extant ? n.nAt(cfg.nowYear) : 0;
      n.wNow = n.extant ? W(n.nowN) : 0;
    });

    // ================= row layout (y) =================
    function lcaTime(a, b) {
      var anc = {}; for (var n = a.parent; n; n = n.parent) anc[n.key] = n;
      for (var m = b.parent; m; m = m.parent) if (anc[m.key]) return m.t;
      return 0;
    }
    var LCA_EXTRA = function (t) { return t >= 4.0 ? 26 : t >= 3.0 ? 16 : t >= 2.4 ? 9 : t >= 1.8 ? 4 : 0; };
    var yy = cfg.topPad;
    leaves.forEach(function (n, i) {
      if (i > 0) yy += cfg.pitch + LCA_EXTRA(lcaTime(leaves[i - 1], n));
      n.y = yy;
    });
    var yTop = leaves[0].y, yBot = leaves[leaves.length - 1].y;
    var Hcanvas = yBot + cfg.botPad;

    // ---- compact (alluvial) layout. Every leaf has a full width w0 (population tier). A lineage is born at
    //      birthFrac·w0 and widens with the growth factor g(x) as the radiation fans out, so at every x a clade
    //      ribbon is exactly as thick as the sum of its members (+ slot gaps): flow is conserved at all times.
    var NL = leaves.length, Sbefore = [], Stot = 0;
    leaves.forEach(function (n, i) { Sbefore[i] = Stot; Stot += n.w0; });
    (function cover(n) {
      if (n.isLeaf) { n.i0 = n.i1 = n.idx; n.S = n.w0; n.cnt = 1; n.H = n.w0; return; }
      n.kids.forEach(cover);
      n.i0 = n.kids[0].i0; n.i1 = n.kids[n.kids.length - 1].i1;
      n.S = Sbefore[n.i1] + leaves[n.i1].w0 - Sbefore[n.i0];
      n.cnt = n.i1 - n.i0 + 1;
      n.H = n.S + cfg.slotGap * (n.cnt - 1);      // full-grown height (used by the row layout)
    })(root);
    var rootC = (yTop + yBot) / 2;

    // ---- row layout: node center = thickness-weighted mean of children, kept inside its own rows
    (function span(n) {
      if (n.isLeaf) { n.spanTop = n.y; n.spanBot = n.y; return; }
      n.kids.forEach(span); n.spanTop = n.kids[0].spanTop; n.spanBot = n.kids[n.kids.length - 1].spanBot;
    })(root);
    (function rows(n) {
      if (n.isLeaf) { n.rr = n.y; return; }
      n.kids.forEach(rows);
      var s = 0, ws = 0; n.kids.forEach(function (k) { s += k.H * k.rr; ws += k.H; });
      var c = s / ws;
      var lo = n.spanTop - cfg.pitch / 2 + n.H / 2 + 2, hi = n.spanBot + cfg.pitch / 2 - n.H / 2 - 2;
      n.rr = lo <= hi ? clamp(c, lo, hi) : (n.spanTop + n.spanBot) / 2;
    })(root);

    // ================= x scales =================
    var dk = cfg.deepKnots;
    function xDeep(t) {
      if (t >= dk[0][0]) return cfg.X0 + dk[0][1] - (t - dk[0][0]) * ((dk[1][1] - dk[0][1]) / (dk[0][0] - dk[1][0]));
      for (var i = 0; i < dk.length - 1; i++) {
        if (t >= dk[i + 1][0]) {
          var u = (dk[i][0] - t) / (dk[i][0] - dk[i + 1][0]);
          return cfg.X0 + dk[i][1] + u * (dk[i + 1][1] - dk[i][1]);
        }
      }
      var j = dk.length - 1;
      return cfg.X0 + dk[j][1] + (dk[j][0] - t) * ((dk[j][1] - dk[j - 1][1]) / (dk[j - 1][0] - dk[j][0]));
    }
    var xDeepEnd = xDeep(cfg.tDeepEnd);
    var XB0 = xDeepEnd + cfg.breakGap, XB1 = XB0 + cfg.humanW;
    var knots = cfg.ceKnots;
    function xCE(year) {
      if (year <= knots[0][0]) return XB0;
      for (var i = 0; i < knots.length - 1; i++) {
        if (year <= knots[i + 1][0]) {
          var u = (year - knots[i][0]) / (knots[i + 1][0] - knots[i][0]);
          return XB0 + cfg.humanW * (knots[i][1] + u * (knots[i + 1][1] - knots[i][1]));
        }
      }
      return XB1;
    }
    function yearOfX(x) {
      var f = clamp((x - XB0) / cfg.humanW, 0, 1);
      for (var i = 0; i < knots.length - 1; i++) {
        if (f <= knots[i + 1][1]) {
          var u = (f - knots[i][1]) / (knots[i + 1][1] - knots[i][1]);
          return knots[i][0] + u * (knots[i + 1][0] - knots[i][0]);
        }
      }
      return knots[knots.length - 1][0];
    }
    var X_NOW = xCE(cfg.nowYear);
    var xRoot = xDeep(root.t);
    var xFull = XB0 + cfg.fullPastBreak;
    function Phi(x) { var u = clamp((x - xRoot) / (xFull - xRoot), 0, 1); return smooth(Math.pow(u, cfg.phiPow)); }
    function growth(x) { return cfg.birthFrac + (1 - cfg.birthFrac) * Phi(x); }
    function HAt(n, x) { return growth(x) * n.S + cfg.slotGap * (n.cnt - 1); }
    function ccAt(n, x) {
      var gx = growth(x), G = cfg.slotGap;
      var top0 = rootC - (gx * Stot + G * (NL - 1)) / 2;
      return top0 + gx * Sbefore[n.i0] + G * n.i0 + HAt(n, x) / 2;
    }
    function fam(n, x) { var f = Phi(x); return (1 - f) * ccAt(n, x) + f * n.rr; }

    // ================= ends of ribbons =================
    var undated = leaves.filter(function (n) { return n.undated; });
    var GOLD = 0.6180339887;
    undated.forEach(function (n, i) {
      var f = (i * GOLD) % 1;
      n.endYear = Math.round(cfg.undatedWindow[0] + f * (cfg.undatedWindow[1] - cfg.undatedWindow[0]));
      n.endEstimated = true;
    });
    leaves.forEach(function (n) {
      n.endX = n.extant ? X_NOW : xCE(n.endYear);
      n.taperStartX = n.extant ? null : Math.max(XB0 - 20, n.endX - cfg.taperPx);
    });

    function taper(s) { s = clamp(s, 0, 1); return 1 - Math.pow(s, cfg.taperPow); }
    function leafWidth(n, x) {
      var g = growth(x);
      if (x < XB0) return g * n.w0;
      if (n.extant) return g * (n.pop ? W(n.nAt(yearOfX(x))) : n.w0);
      if (x <= n.taperStartX) return g * n.w0;
      if (x >= n.endX) return 0;
      return g * n.w0 * taper((x - n.taperStartX) / (n.endX - n.taperStartX));
    }

    // ================= nodes, ribbons =================
    var nodes = [], ribbons = [];
    var bw = cfg.barW;
    (function mk(n) {
      if (n.isLeaf) return;
      n.x = xDeep(n.t); n.cyDraw = fam(n, n.x); n.Hx = HAt(n, n.x);
      nodes.push(n);
      n.kids.forEach(mk);
    })(root);

    function leafList(n, out) { out = out || []; if (n.isLeaf) out.push(n); else n.kids.forEach(function (k) { leafList(k, out); }); return out; }
    var STEP = 4;

    function addRibbon(k, p, hopL) {
      var x0 = p.x + bw / 2;
      var slotY = p.cyDraw + (ccAt(k, p.x) - ccAt(p, p.x));
      var d = slotY - fam(k, x0);
      var xEnd = k.isLeaf ? k.endX : (xDeep(k.t) - bw / 2);
      var pts = [];
      var x = x0, guard = 0;
      while (true) {
        var u = hopL > 0 ? clamp((x - x0) / hopL, 0, 1) : 1;
        var yc = fam(k, x) + d * (1 - smooth(u));
        var w = k.isLeaf ? leafWidth(k, x) : HAt(k, x);
        pts.push([x, yc, w]);
        if (x >= xEnd) break;
        x = Math.min(xEnd, x + STEP);
        if (++guard > 4000) break;
      }
      var r = { key: k.key, node: k, parent: p, isLeaf: k.isLeaf, x0: x0, x1: xEnd, pts: pts, hop: hopL, slotY: slotY, delta: d };
      r.leaves = leafList(k);
      ribbons.push(r);
      k.ribbon = r;
      return r;
    }
    (function ribs(n) {
      if (n.isLeaf) return;
      var L = Infinity;
      n.kids.forEach(function (k) { if (!k.isLeaf) L = Math.min(L, xDeep(k.t) - bw / 2 - (n.x + bw / 2)); });
      if (!isFinite(L)) L = cfg.leafHop;
      n.hop = Math.max(40, L);
      n.kids.forEach(function (k) { addRibbon(k, n, n.hop); ribs(k); });
    })(root);

    var stem = { x0: xDeep(stemT), x1: root.x - bw / 2, y: root.cyDraw, H: root.Hx };

    function ribbonAt(r, x) {
      var pts = r.pts, n = pts.length;
      if (x <= pts[0][0]) return { y: pts[0][1], w: pts[0][2] };
      if (x >= pts[n - 1][0]) return { y: pts[n - 1][1], w: pts[n - 1][2] };
      var i = Math.min(n - 2, Math.floor((x - pts[0][0]) / STEP));
      while (i > 0 && pts[i][0] > x) i--;
      while (i < n - 2 && pts[i + 1][0] < x) i++;
      var a = pts[i], b = pts[i + 1], t = (x - a[0]) / (b[0] - a[0] || 1);
      return { y: a[1] + (b[1] - a[1]) * t, w: a[2] + (b[2] - a[2]) * t };
    }

    return {
      cfg: cfg, T: T, root: root, leaves: leaves, nodes: nodes, ribbons: ribbons, stem: stem, Hcanvas: Hcanvas,
      stemT: stemT, W: W, ribbonAt: ribbonAt, leafWidth: leafWidth,
      X: { xDeep: xDeep, xCE: xCE, yearOfX: yearOfX, XB0: XB0, XB1: XB1, xDeepEnd: xDeepEnd, X_NOW: X_NOW, xFull: xFull, xRoot: xRoot },
      Phi: Phi, fam: fam, yTop: yTop, yBot: yBot
    };
  }

  return { build: build, DEFAULTS: DEFAULTS, clamp: clamp, smooth: smooth };
})();
if (typeof module !== 'undefined') module.exports = HCModel;
