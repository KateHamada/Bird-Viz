// species-quality.js: the data-quality view for one species. Load after species-common.js.
// Page element: <div id="species-quality">

// How each *_imputation_type code reads on the page
const SOURCE_TEXT = {
  Literature: 'From the literature',
  Measured_skin: 'Measured on skin specimens',
  Imputed_from_skeleton: 'Imputed from skeleton measurements',
  Imputed_from_bodySize: 'Imputed from body size',
  Imputed: 'Imputed',
  Estimated_from_descriptions: 'Estimated from descriptions',
  Estimated_from_GenusMedian: 'Estimated from the genus median',
  Estimated_from_FamilyMedian: 'Estimated from the family median'
};
const DIRECT_CODES = ['Literature', 'Measured_skin'];

// [column, label, unit]; all of these share one source column (skin_imputation_type)
const SKIN_FIELDS = [
  ['beak_length_culmen', 'Beak length (culmen)', 'mm'],
  ['beak_length_nares', 'Beak length (nares)', 'mm'],
  ['beak_width', 'Beak width', 'mm'],
  ['beak_depth', 'Beak depth', 'mm'],
  ['tarsus_length', 'Tarsus length', 'mm'],
  ['wing_length', 'Wing length', 'mm'],
  ['kipps_distance', "Kipp's distance", 'mm'],
  ['tail_length', 'Tail length', 'mm']
];

const SPQ_CSS = `
.sp-score { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin: 6px 0; }
.sp-score-num { display: flex; align-items: baseline; gap: 6px; line-height: 1; }
.sp-score-num b { font-size: 3.6rem; }
.sp-score-num span { font-size: 1.4rem; opacity: .7; }
.sp-score-main { margin: 0; font-size: 1.05rem; }
.sp-score .sp-note { margin: 2px 0 0; font-size: .9rem; }
.sp-meter { display: flex; gap: 3px; margin: 8px 0 4px; max-width: 360px; }
.sp-meter i { flex: 1; height: 12px; border: 1.5px solid currentColor; border-radius: 2px; opacity: .45; }
.sp-meter i.on { background: currentColor; opacity: 1; }
.sp-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin: 16px 0; }
.sp-card { padding: 10px 14px 12px; border-radius: 8px; }
.sp-card.direct { border: 2px solid currentColor; }
.sp-card.indirect { border: 2px dashed rgba(128,128,128,.85); }
.sp-card h4 { margin: 0 0 6px; font-size: 1rem; }
.sp-card h4 small { font-weight: 400; opacity: .7; margin-left: 6px; }
.sp-cardsrc { margin: 0 0 10px; font-size: .88rem; }
.sp-badge { display: inline-block; font-size: .72rem; padding: 0 7px; border-radius: 10px; margin-right: 6px; white-space: nowrap; }
.sp-badge.direct { border: 2px solid currentColor; font-weight: 600; }
.sp-badge.indirect { border: 1.5px dashed currentColor; }
.sp-vals { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0; font-size: .85rem; }
.sp-vals dt { opacity: .75; }
.sp-vals dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sp-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.sp-stat { border: 1px solid rgba(128,128,128,.4); border-radius: 6px; padding: 6px 14px; min-width: 80px; }
.sp-stat b { display: block; font-size: 1.2rem; }
.sp-stat span { font-size: .75rem; opacity: .7; font-family: monospace; }
`;

// Three groups, one per source column. Every value still counts once toward the score.
function qualityGroups(tr) {
  return [
    { title: 'Flight ability', code: tr.flight_imputation_type,
      values: [['0 = flightless, 1 = full flight', fmt(tr.flight_ability)]] },
    { title: 'Skin measurements', code: tr.skin_imputation_type,
      values: SKIN_FIELDS.map(([col, label, unit]) => [label, `${fmt(tr[col])} ${unit}`]) },
    { title: 'Body mass', code: tr.body_imputation_type,
      values: [['Body mass', `${fmt(tr.body_mass)} g`]] }
  ];
}

function renderQuality(key) {
  const box = byId('species-quality');
  if (!box) return;
  injectStyle('spq-style', SPQ_CSS);
  const tr = sp.traits.get(key);
  box.textContent = '';

  if (!tr) {
    box.appendChild(mk('p', 'sp-note', 'This species is not in the traits file, so there are no trait values to assess.'));
    return;
  }

  const groups = qualityGroups(tr);
  const isDirect = g => DIRECT_CODES.includes(g.code);
  const total = groups.reduce((n, g) => n + g.values.length, 0);
  const direct = groups.filter(isDirect).reduce((n, g) => n + g.values.length, 0);

  // 1. the headline: how many of this species' values are direct
  const score = mk('div', 'sp-score');
  const num = mk('div', 'sp-score-num');
  num.append(mk('b', null, String(direct)), mk('span', null, `/ ${total}`));
  const text = mk('div');
  text.append(
    mk('p', 'sp-score-main', 'values are direct (measured or from the literature)'),
    mk('p', 'sp-note', `${total - direct} are imputed or estimated from other data`));
  score.append(num, text);
  box.appendChild(score);

  const meter = mk('div', 'sp-meter');
  meter.setAttribute('aria-hidden', 'true');
  groups.forEach(g => g.values.forEach(() => meter.appendChild(mk('i', isDirect(g) ? 'on' : ''))));
  box.appendChild(meter);

  // 2. where each group of values comes from
  const cards = mk('div', 'sp-cards');
  groups.forEach(g => {
    const direct_ = isDirect(g);
    const card = mk('div', 'sp-card ' + (direct_ ? 'direct' : 'indirect'));
    const h = mk('h4', null, g.title);
    if (g.values.length > 1) h.appendChild(mk('small', null, `${g.values.length} values`));
    const src = mk('p', 'sp-cardsrc');
    src.append(mk('span', 'sp-badge ' + (direct_ ? 'direct' : 'indirect'), direct_ ? '✓ Direct' : '≈ Indirect'),
      SOURCE_TEXT[g.code] || g.code);
    src.title = g.code;
    const dl = mk('dl', 'sp-vals');
    g.values.forEach(([label, value]) => dl.append(mk('dt', null, label), mk('dd', null, value)));
    card.append(h, src, dl);
    cards.appendChild(card);
  });
  box.appendChild(cards);

  box.appendChild(mk('p', 'sp-note',
    '✓ Direct = measured or taken from the literature. ≈ Indirect = imputed or estimated from other data. ' +
    'The eight skin measurements share one source, so they are shown together.'));

  // 3. dataset-wide context, so the numbers above can be read against the rest of the file
  const n = sp.all.length;
  const pct = k => Math.round((100 * k) / n) + '%';
  box.appendChild(mk('p', 'sp-note',
    `Across all ${n} species: flight ability is from the literature for ` +
    `${pct(sp.all.filter(d => d.flight_imputation_type === 'Literature').length)}, ` +
    `skin traits are measured for ${pct(sp.all.filter(d => d.skin_imputation_type === 'Measured_skin').length)}, ` +
    `and body mass is from the literature for ${pct(sp.all.filter(d => d.body_imputation_type === 'Literature').length)}.`));

  const stats = mk('div', 'sp-stats');
  ['n_emm', 'n_skel', 'n_body'].forEach(col => {
    const s = mk('div', 'sp-stat');
    s.append(mk('b', null, String(tr[col] ?? '')), mk('span', null, col));
    stats.appendChild(s);
  });
  box.append(mk('p', 'sp-note', 'Sample-size columns from the traits file, shown under their column names:'), stats);
}

registerSpeciesRenderer(renderQuality);