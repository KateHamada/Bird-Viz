/* hc_glyphs.js — parametric honeycreeper silhouettes (dead on its back = extinct, flying = extant; 'perched' kept for comparison).
   Every body part is scaled from the species' morphometrics (AVOTREX / AVONET):
     wing_length  -> body length (0.78·W) and, in flight, the raised wing itself
     body_mass    -> body depth (∝ mass^1/3) and head size
     tail_length  -> tail          tarsus_length -> legs and toes (dead, perched)
     beak_length_culmen / beak_depth -> bill length / base thickness
   Bill CURVATURE and lower-mandible length are not measured in the datasets; they come from the beak_kind /
   beak_curve_deg / lower_mand columns of honeycreeper_nodes.csv (qualitative, from the species accounts).
   Geometry is built in millimetres in a body frame (x = forward, y = down), then scaled. In the 'dead' pose the bird
   lies on its back (belly up, so a decurved bill curves UP), head right, tail left; the ground is y = 0.
   HCGlyphs.draw(sp, {pose, scale, facing}) -> { parts:[{d, role, rotate}], anchor, P, mount(parent, style) }
   anchor = [x, y] in mm of the tail tip (dead pose), used to line the bird up with the end of its ribbon. */
var HCGlyphs = (function () {
  'use strict';
  var RAD = Math.PI / 180;
  function num(v, d) { var f = parseFloat(v); return isFinite(f) ? f : d; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function rot(p, deg, o) { // rotate p by deg (positive = clockwise on screen) about o
    o = o || [0, 0]; var a = deg * RAD, c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1];
    return [o[0] + x * c - y * s, o[1] + x * s + y * c];
  }
  function polyD(pts) { return 'M' + pts.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join('L') + 'Z'; }
  function smoothD(pts, k, open) { // Catmull-Rom spline -> cubic Beziers (closed unless `open`)
    k = k == null ? 0.5 : k; var n = pts.length, m = open ? n - 1 : n, d = 'M' + r2(pts[0][0]) + ',' + r2(pts[0][1]);
    for (var i = 0; i < m; i++) {
      var p0 = open ? pts[Math.max(i - 1, 0)] : pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = open ? pts[Math.min(i + 2, n - 1)] : pts[(i + 2) % n];
      d += 'C' + r2(p1[0] + (p2[0] - p0[0]) * k / 3) + ',' + r2(p1[1] + (p2[1] - p0[1]) * k / 3) + ' ' +
        r2(p2[0] - (p3[0] - p1[0]) * k / 3) + ',' + r2(p2[1] - (p3[1] - p1[1]) * k / 3) + ' ' + r2(p2[0]) + ',' + r2(p2[1]);
    }
    return open ? d : d + 'Z';
  }

  function params(sp) {
    var W = num(sp.wing_length, 70), T = num(sp.tail_length, 45), R = num(sp.tarsus_length, 21), M = num(sp.body_mass, 15);
    var P = { W: W, T: T, R: R, M: M, BL: num(sp.beak_length_culmen, 16), BD: num(sp.beak_depth, 5), BW: num(sp.beak_width, 4) };
    P.Lb = 0.78 * W;                  // body length (chest to rump)
    P.Db = 13.4 * Math.cbrt(M);       // body depth
    P.a = P.Lb / 2; P.b = P.Db / 2;
    P.rh = 0.28 * P.Db;               // head radius
    P.kind = sp.beak_kind || 'straight';
    P.curve = num(sp.beak_curve_deg, 0);
    P.lower = num(sp.lower_mand, 1);
    return P;
  }

  // ---------- head + torso as ONE smooth outline ----------
  function bodyOutline(P) {
    var a = P.a, b = P.b, r = P.rh, Hc = [0.70 * a, -0.70 * b];
    function h(dx, dy) { return [Hc[0] + r * dx, Hc[1] + r * dy]; }
    var pts = [
      h(0.90, -0.42), h(0.18, -1.00), h(-0.78, -0.72),                       // forehead, crown, back of head
      [0.08 * a, -0.97 * b], [-0.26 * a, -1.03 * b], [-0.64 * a, -0.86 * b], // nape dip, shoulder, mid-back
      [-0.99 * a, -0.42 * b], [-0.98 * a, 0.16 * b], [-0.56 * a, 0.74 * b],  // rump, vent, rear belly
      [0.04 * a, 1.00 * b], [0.58 * a, 0.84 * b], [0.90 * a, 0.40 * b],      // belly, lower breast, breast
      h(0.62, 0.98), h(0.96, 0.52)                                           // throat (recedes under the head), chin
    ];
    return { d: smoothD(pts, 0.55), Hc: Hc };
  }

  // ---------- bill: sampled center line + thickness profile (heading in the BODY frame; sgn = -1 flips the curvature, belly-up) ----------
  function bill(P, base, headingBody, scaleL, sgn) {
    sgn = sgn || 1;
    var N = 24, L = P.BL * (scaleL || 1), x = base[0], y = base[1];
    var curve = sgn * P.curve * RAD, kind = P.kind, h0 = headingBody * RAD;
    var d0 = (kind === 'sickle' || kind === 'decurved') ? Math.max(P.BD * 0.80, 3.6) : (kind === 'conical' ? P.BD * 1.12 : Math.max(P.BD * 0.95, 3.2));
    var top = [], bot = [], tip = [x, y];
    for (var i = 0; i <= N; i++) {
      var u = i / N, h;
      if (kind === 'hooked' || kind === 'pincer') { var q = Math.max(0, (u - 0.5) / 0.5); h = h0 + curve * q * q * (3 - 2 * q); }
      else h = h0 + curve * Math.pow(u, 1.10);
      if (i > 0) { x += Math.cos(h) * L / N; y += Math.sin(h) * L / N; }
      var t;
      if (kind === 'conical') t = d0 * Math.pow(1 - u, 0.80) * (0.6 + 0.4 * (1 - u));
      else if (kind === 'hooked') t = d0 * Math.pow(1 - u * u, 0.72);
      else t = d0 * Math.pow(1 - u, 0.60);
      var nx = Math.sin(h), ny = -Math.cos(h);
      top.push([x + nx * t * 0.5, y + ny * t * 0.5]); bot.push([x - nx * t * 0.5, y - ny * t * 0.5]);
      tip = [x, y];
    }
    var out = { d: polyD(top.concat(bot.reverse())), tip: tip };
    if (P.lower < 0.95) { // short, stout lower mandible (nukupuʻu, ʻākiapōlāʻau)
      var lx = base[0], ly = base[1] + sgn * d0 * 0.20, ll = L * P.lower, lt = [], lb = [], hh = h0 + sgn * 9 * RAD;
      for (var j = 0; j <= 10; j++) {
        var v = j / 10; lx += Math.cos(hh) * ll / 10; ly += Math.sin(hh) * ll / 10;
        var th = d0 * 0.95 * Math.pow(1 - v, 0.65);
        lt.push([lx, ly - th * 0.5]); lb.push([lx, ly + th * 0.5]);
      }
      out.lower = polyD(lt.concat(lb.reverse()));
    }
    return out;
  }

  // ---------- tail (body frame; rise = degrees the tip is lifted relative to the body axis) ----------
  function tail(P, rise, spread) {
    var a = P.a, b = P.b, T = P.T * 0.84, s = spread || 1;   // honeycreeper tails are short and fairly broad
    var pts = [[-0.55 * a, -0.62 * b], [-a - 0.45 * T, -0.40 * b * s], [-a - T, -0.54 * b * s - 0.03 * T],
      [-a - T + 0.12 * T, 0], [-a - T, 0.54 * b * s + 0.03 * T], [-a - 0.45 * T, 0.40 * b * s], [-0.55 * a, 0.30 * b]];
    var o = [-0.80 * a, 0];
    return polyD(pts.map(function (p) { return rot(p, rise, o); }));
  }

  // ---------- poses ----------
  function perched(P) {
    var tilt = -24, a = P.a, b = P.b, r = P.rh, bo = bodyOutline(P), g = [];
    g.push({ d: tail(P, 14, 1), role: 'body' });
    g.push({ d: bo.d, role: 'body' });
    var kind = P.kind, hs = (kind === 'sickle' || kind === 'decurved') ? -16 : (kind === 'straight' ? 2 : (kind === 'conical' ? 10 : 8));
    var base = [bo.Hc[0] + r * 0.86, bo.Hc[1] + r * (kind === 'sickle' || kind === 'decurved' ? 0.12 : 0.20)];
    var bl = bill(P, base, hs - tilt, 1);
    g.push({ d: bl.d, role: 'beak' });
    if (bl.lower) g.push({ d: bl.lower, role: 'beak' });
    var out = g.map(function (p) { return { d: p.d, role: p.role, rotate: tilt }; });
    // legs (screen frame): short tarsus, bent slightly forward, toes spread
    var hip = rot([-0.02 * a, 0.90 * b], tilt), R = P.R * 0.62, toe = 0.85 * R, legs = '';
    [-0.05 * P.Lb, 0.11 * P.Lb].forEach(function (dx) {
      var x0 = hip[0] + dx, y0 = hip[1] - 0.10 * b, kx = x0 + 0.16 * R, ky = y0 + 0.62 * R, x1 = kx - 0.08 * R, y1 = ky + 0.52 * R;
      legs += 'M' + r2(x0) + ',' + r2(y0) + 'L' + r2(kx) + ',' + r2(ky) + 'L' + r2(x1) + ',' + r2(y1) +
        'M' + r2(x1) + ',' + r2(y1) + 'L' + r2(x1 + toe) + ',' + r2(y1 + 0.15 * toe) +
        'M' + r2(x1) + ',' + r2(y1) + 'L' + r2(x1 + toe * 0.85) + ',' + r2(y1 - 0.22 * toe) +
        'M' + r2(x1) + ',' + r2(y1) + 'L' + r2(x1 + toe * 0.7) + ',' + r2(y1 + 0.50 * toe) +
        'M' + r2(x1) + ',' + r2(y1) + 'L' + r2(x1 - toe * 0.6) + ',' + r2(y1 + 0.12 * toe);
    });
    out.push({ d: legs, role: 'leg', rotate: 0 });
    return out;
  }

  function wingPoly(W) { // wing frame: +u along the wing, v<0 = trailing edge; four primary 'fingers' at the tip
    return [[0, 0.07 * W], [0.25 * W, 0.12 * W], [0.55 * W, 0.13 * W], [0.80 * W, 0.10 * W], [0.97 * W, 0.02 * W], [1.0 * W, -0.06 * W],
      [0.93 * W, -0.13 * W], [0.92 * W, -0.21 * W], [0.84 * W, -0.17 * W], [0.82 * W, -0.27 * W], [0.74 * W, -0.23 * W], [0.71 * W, -0.32 * W],
      [0.60 * W, -0.30 * W], [0.45 * W, -0.34 * W], [0.25 * W, -0.31 * W], [0.08 * W, -0.22 * W], [-0.02 * W, -0.08 * W]];
  }
  function flying(P) {
    var tilt = -26, a = P.a, b = P.b, r = P.rh, bo = bodyOutline(P), g = [];
    var S = [0.02 * a, -0.84 * b], WL = 0.72;                    // shoulder, wing-length factor
    function wingAt(sh, angle, k) {
      return polyD(wingPoly(P.W * WL * k).map(function (p) { var q = rot(p, angle); return [sh[0] + q[0], sh[1] + q[1]]; }));
    }
    g.push({ d: wingAt([S[0] - 0.12 * a, S[1] + 0.05 * b], -122, 0.92), role: 'wing' });   // far wing
    g.push({ d: tail(P, 10, 1.12), role: 'body' });
    g.push({ d: bo.d, role: 'body' });
    g.push({ d: wingAt(S, -98, 1.0), role: 'wing' });                                     // near wing
    var kind = P.kind, hs = (kind === 'sickle' || kind === 'decurved') ? -6 : (kind === 'straight' ? 6 : (kind === 'conical' ? 12 : 9));
    var base = [bo.Hc[0] + r * 0.86, bo.Hc[1] + r * (kind === 'sickle' || kind === 'decurved' ? 0.12 : 0.20)];
    var bl = bill(P, base, hs - tilt, 1);
    g.push({ d: bl.d, role: 'beak' });
    if (bl.lower) g.push({ d: bl.lower, role: 'beak' });
    return g.map(function (p) { return { d: p.d, role: p.role, rotate: tilt }; });
  }

  // Extinct: a bird on its back, head right, tail left, feet in the air. Ground is y = 0 and up is negative.
  function dead(P) {
    var a = P.a, h = 0.85 * P.Db, r = P.rh, T = 0.66 * P.T, kind = P.kind;   // lying flat, the tail is partly foreshortened
    var Hc = [1.12 * a, -1.2 * r];
    var body = smoothD([
      [-1.00 * a, -0.03 * h], [-1.00 * a, -0.28 * h], [-0.72 * a, -0.52 * h], [-0.25 * a, -0.80 * h],       // rump, belly rising
      [0.21 * a, -0.97 * h], [0.50 * a, -1.00 * h], [0.78 * a, -0.93 * h],                                    // top of the dome
      [Hc[0] - 0.45 * r, Hc[1] - 0.92 * r], [Hc[0] + 0.30 * r, Hc[1] - 0.98 * r], [Hc[0] + 0.85 * r, Hc[1] - 0.55 * r],   // head
      [Hc[0] + 1.00 * r, Hc[1] + 0.05 * r], [Hc[0] + 0.72 * r, Hc[1] + 0.78 * r], [Hc[0] + 0.05 * r, 0],
      [0.6 * a, 0], [0, 0], [-0.6 * a, 0]                                                                      // back on the ground
    ], 0.55);
    var parts = [
      { d: polyD([[-0.75 * a, -0.31 * h], [-a - 0.55 * T, -0.24 * h], [-a - 0.92 * T, -0.12 * h], [-a - T, -0.02 * h], [-a - 0.55 * T, 0], [-0.75 * a, 0]]), role: 'body' },
      { d: body, role: 'body' }
    ];
    // bill: straight kinds point up-right like a dead bird's beak; curved kinds lie along the ground and curve up (belly-up)
    var hs = kind === 'sickle' ? -4 : kind === 'decurved' ? -12 : (kind === 'hooked' || kind === 'pincer') ? -24 : -32;
    var bl = bill(P, [Hc[0] + 0.88 * r, Hc[1] - 0.14 * r], hs, 1, -1);
    parts.push({ d: bl.d, role: 'beak' });
    if (bl.lower) parts.push({ d: bl.lower, role: 'beak' });
    // two legs in the air, toes curled
    var R = 0.85 * P.R, toeL = Math.max(0.42 * R, 4), legs = '';
    [[-0.62 * a, -0.50 * h, -106, 0.95], [-0.74 * a, -0.34 * h, -160, 1.15]].forEach(function (L) {
      var ang = L[2] * RAD, ax = L[0] + Math.cos(ang) * R * L[3], ay = L[1] + Math.sin(ang) * R * L[3];
      legs += 'M' + r2(L[0]) + ',' + r2(L[1]) + 'L' + r2(ax) + ',' + r2(ay);
      [-0.62, 0, 0.62].forEach(function (s) {
        var th = ang + s;
        legs += 'M' + r2(ax) + ',' + r2(ay) + 'Q' + r2(ax + Math.cos(th) * toeL * 0.6) + ',' + r2(ay + Math.sin(th) * toeL * 0.6) + ' ' +
          r2(ax + Math.cos(th - 0.9) * toeL) + ',' + r2(ay + Math.sin(th - 0.9) * toeL);
      });
    });
    parts.push({ d: legs, role: 'leg' });
    // edge of the folded wing, a thin light line across the belly
    parts.push({ d: smoothD([[-a, -0.02 * h], [-0.72 * a, -0.40 * h], [-0.25 * a, -0.63 * h], [0.20 * a, -0.71 * h], [0.48 * a, -0.70 * h]], 0.5, true), role: 'line' });
    return { parts: parts, anchor: [-a - T, -0.02 * h] };
  }

  // ---------- public ----------
  function draw(sp, opts) {
    opts = opts || {};
    var P = params(sp), pose = opts.pose || 'dead', k = opts.scale || 0.42, facing = opts.facing == null ? 1 : opts.facing;
    var made = pose === 'flying' ? flying(P) : pose === 'perched' ? perched(P) : dead(P);
    var parts = made.parts || made;
    return {
      parts: parts, anchor: made.anchor || null, P: P, pose: pose, k: k, facing: facing,
      mount: function (parent, style) {
        style = style || {};
        var NS = 'http://www.w3.org/2000/svg';
        var root = document.createElementNS(NS, 'g');
        root.setAttribute('transform', 'scale(' + (facing * k) + ',' + k + ')');
        var halo = document.createElementNS(NS, 'g'), fill = document.createElementNS(NS, 'g');
        halo.setAttribute('fill', '#ffffff'); halo.setAttribute('stroke', '#ffffff'); halo.setAttribute('stroke-linejoin', 'round');
        halo.setAttribute('stroke-width', String(r2((style.halo == null ? 2.6 : style.halo) / k))); halo.setAttribute('opacity', '0.8');
        parts.forEach(function (p) {
          [halo, fill].forEach(function (grp, gi) {
            if (p.role === 'line' && !gi) return;
            var e = document.createElementNS(NS, 'path');
            e.setAttribute('d', p.d);
            if (p.rotate) e.setAttribute('transform', 'rotate(' + p.rotate + ')');
            if (p.role === 'line') {
              e.setAttribute('fill', 'none'); e.setAttribute('stroke', style.line || '#ffffff'); e.setAttribute('stroke-opacity', '0.85');
              e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-width', String(r2((style.lineW || 1.2) / k)));
            } else if (p.role === 'leg') {
              e.setAttribute('fill', 'none'); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round');
              e.setAttribute('stroke-width', String(r2((gi ? (style.legW || 1.7) : 4.0) / k)));
              e.setAttribute('stroke', gi ? (style.leg || style.body || '#0f172a') : '#ffffff');
            } else if (gi) {
              e.setAttribute('fill', p.role === 'beak' ? (style.beak || style.body || '#0f172a') : p.role === 'wing' ? (style.wing || style.body || '#0f172a') : (style.body || '#0f172a'));
              e.setAttribute('stroke', 'none');
            }
            grp.appendChild(e);
          });
        });
        root.appendChild(halo); root.appendChild(fill);
        if (style.opacity != null) root.setAttribute('opacity', String(style.opacity));
        parent.appendChild(root);
        return root;
      }
    };
  }
  return { draw: draw, params: params };
})();
if (typeof module !== 'undefined') module.exports = HCGlyphs;
