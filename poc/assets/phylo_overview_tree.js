/* phylo_overview_tree.js — angular overview of all species, one band per order.
   Reads PHYLO_OVERVIEW from data/phylo_overview_data.js (order -> era counts +
   top families). Pure SVG + vanilla JS. Era colors mirror graphs/common.js.
   Deliberately a *taxonomic* overview (no molecular tree covers all 11,619
   species); the time-calibrated storytelling phylogeny is on the honeycreeper
   page, the only region with one.
*/
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ERA_COLOR = { prehistoric: '#8c6d31', historic: '#7b3294', edge: '#d6604d', extant: '#2166ac' };
  var ERA_LABEL = { prehistoric: 'Prehistoric / Pre-1500', historic: 'Historical (post-1500)', edge: 'Edge of Extinction', extant: 'Present Day (extant)' };
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(x, y, s, cls, anchor, parent) {
    var t = el('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'start' }, parent);
    t.textContent = s;
    return t;
  }
  function fmtN(v) { return Number(v).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function famCount(p, k) { return p.families.reduce(function (a, f) { return a + f[k]; }, 0); }

  // The data script declares `const PHYLO_OVERVIEW` (a global lexical binding,
  // not a window property) — resolve it by name, mirroring sankey_render.js's
  // use of HC_NODES.
  var data = (typeof PHYLO_OVERVIEW !== 'undefined') ? PHYLO_OVERVIEW : null;
  if (!data) { document.getElementById('tree').textContent = 'Could not load phylo_overview_data.js'; return; }

  var legend = document.getElementById('legend');
  ['prehistoric', 'historic', 'edge', 'extant'].forEach(function (k) {
    legend.innerHTML += '<span><span class="sw" style="background:' + ERA_COLOR[k] + '"></span>' + ERA_LABEL[k] + '</span>';
  });

  // ---- layout: fixed height; band height = log scale of species count ----
  var bandX = 250, bandW = 520, rightPad = 26, topPad = 30, orderGap = 10;
  var W = bandX + bandW + rightPad + 170;
  var orders = data.orders.slice();
  var logs = orders.map(function (o) { return Math.log2(1 + o.n); });
  var logSum = logs.reduce(function (a, b) { return a + b; }, 0);
  var H_TARGET = 1250;
  var unit = (H_TARGET - orderGap * orders.length) / logSum;
  var y = topPad;
  var placed = orders.map(function (o, i) {
    var h = Math.max(14, logs[i] * unit);
    var rec = { name: o.name, n: o.n, families: o.families, y: y, h: h };
    y += h + orderGap;
    return rec;
  });
  var H = y - orderGap + 14;

  var host = document.getElementById('tree');
  var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' });
  var gSpine = el('g', { 'pointer-events': 'none' }, svg);
  var gBand = el('g', {}, svg);
  el('line', { x1: 218, y1: topPad - 8, x2: 218, y2: H - 8, stroke: '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, gSpine);
  txt(214, topPad - 14, 'AVES · ' + fmtN(data.total) + ' spp · ' + orders.length + ' orders', 'order-label', 'end', gSpine);

  placed.forEach(function (p) {
    var cy = p.y + p.h / 2;
    el('line', { x1: 218, y1: cy, x2: bandX - 6, y2: cy, stroke: '#94a3b8', 'stroke-width': 1.4 }, gSpine);
    el('line', { x1: bandX - 6, y1: p.y, x2: bandX - 6, y2: p.y + p.h, stroke: '#94a3b8', 'stroke-width': 1.4 }, gSpine);
    txt(210, cy - 3, p.name, 'order-label', 'end', gSpine);
    txt(210, cy + 11, fmtN(p.n) + ' spp · ' + p.families.length + ' fam', 'count-label', 'end', gSpine);
    var x = bandX;
    ['prehistoric', 'historic', 'edge', 'extant'].forEach(function (k) {
      var segW = (famCount(p, k) / p.n) * bandW;
      if (segW > 0.3) {
        var r = el('rect', { x: x, y: p.y, width: Math.max(0.5, segW - 0.6), height: p.h, fill: ERA_COLOR[k], 'fill-opacity': 0.85, 'shape-rendering': 'crispEdges' }, gBand);
        r.addEventListener('mousemove', function (e) { moveTip(e, orderTip(p)); });
        r.addEventListener('mouseleave', hideTip);
      }
      x += segW;
    });
    el('rect', { x: bandX, y: p.y, width: bandW, height: p.h, fill: 'none', stroke: '#e5e7eb', 'shape-rendering': 'crispEdges' }, gBand);
    var dom = ['extant', 'prehistoric', 'historic', 'edge'].reduce(function (a, b) { return famCount(p, a) >= famCount(p, b) ? a : b; });
    var domLabel = dom === 'extant' ? 'extant' : (famCount(p, dom) + ' extinct · ' + ERA_LABEL[dom].toLowerCase());
    txt(bandX + bandW + 10, cy + 3, domLabel, 'count-label', 'start', gBand);
  });
  host.appendChild(svg);
  function orderTip(p) {
    var top = p.families.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var rows = ['prehistoric', 'historic', 'edge', 'extant'].map(function (kk) {
      return '<div style="margin:1px 0;font-size:11.5px;color:#d1d5db"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + ERA_COLOR[kk] + ';margin-right:6px"></span>' + ERA_LABEL[kk] + ': <b style="color:#f9fafb">' + fmtN(famCount(p, kk)) + '</b></div>';
    }).join('');
    var fams = top.map(function (f) {
      var e = f.prehistoric + f.historic + f.edge;
      return '<div style="margin:1px 0;font-size:11.5px;color:#d1d5db">' + esc(f.name) + ': <b style="color:#f9fafb">' + fmtN(f.n) + '</b>' +
        (e ? ' <span style="color:#9ca3af">(' + fmtN(e) + ' extinct)</span>' : '') + '</div>';
    }).join('');
    return '<div style="font-weight:700;font-size:13px;margin-bottom:4px">' + esc(p.name) +
      ' <span style="color:#9ca3af;font-weight:400">· ' + fmtN(p.n) + ' species · ' + p.families.length + ' families</span></div>' +
      rows +
      '<div style="margin:7px 0 3px;color:#9ca3af;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em">Largest families</div>' +
      fams +
      (p.families.length > 8 ? '<div style="margin-top:3px;color:#9ca3af;font-size:11px">… and ' + (p.families.length - 8) + ' more</div>' : '');
  }
  function moveTip(e, html) {
    var tip = document.getElementById('tooltip');
    if (!tip) {
      tip = document.createElement('div'); tip.id = 'tooltip';
      tip.style.cssText = 'position:fixed;pointer-events:none;z-index:60;max-width:320px;background:#111827;color:#f9fafb;font-size:12.5px;line-height:1.45;padding:10px 12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.3);left:0;top:0;opacity:0;transition:opacity .08s ease';
      document.body.appendChild(tip);
    }
    tip.innerHTML = html; tip.style.opacity = '1';
    var pad = 14, tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = e.clientX + pad, yy = e.clientY + pad;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
    if (yy + th > window.innerHeight - 8) yy = e.clientY - th - pad;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, yy) + 'px';
  }
  function hideTip() { var t = document.getElementById('tooltip'); if (t) t.style.opacity = '0'; }
})();

