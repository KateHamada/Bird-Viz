// species-common.js: shared code for the single-species pages (tree and data quality).
// Load after common.js, and before species-tree.js / species-quality.js.
//
// Page elements (all optional unless a page's own script needs them):
//   <input id="species-search" list="species-list">  <datalist id="species-list">
//   <div id="species-browse">   (builds Order > Family > Species dropdowns)
//   <p id="species-message">
//   <div id="species-header">   (add the attribute data-compact for a one-line header)
//   <a data-species-link="/other/page/">text</a>   (href is kept pointing at that page for the current species)
// Data: the traits CSV (loaded by common.js) and the taxonomy CSV. Set
// window.AVOTREX_TAXONOMY_URL on the page, like AVOTREX_DATA_URL for the traits.

const TAXONOMY_URL = window.AVOTREX_TAXONOMY_URL || 'data/Avotrex_taxonomy_v1.csv';
const BASE_TITLE = document.title;

const SP_BASE_CSS = `
.sp-search input { box-sizing: border-box; width: 100%; max-width: 440px; padding: 6px 10px; font: inherit; }
.sp-browse { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0 18px; font-size: .9rem; }
.sp-browse select { font: inherit; padding: 4px 6px; max-width: 100%; }
.sp-title small { font-weight: 400; opacity: .75; margin-left: .4em; font-size: .65em; }
.sp-status { margin: 4px 0 8px; }
.sp-facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 8px 0 24px; font-size: .9rem; }
.sp-facts dt { opacity: .7; } .sp-facts dd { margin: 0; }
.sp-panel { margin: 0 0 28px; }
.sp-panel h3 { font-size: 1.05rem; margin: 0 0 6px; }
.sp-note { font-size: .8rem; opacity: .75; margin: 4px 0 10px; }
.sp-dot { display: inline-block; width: .6em; height: .6em; border-radius: 50%; margin-right: 6px; }
.sp-code { font-family: monospace; font-size: .72rem; padding: 0 5px; margin-left: 6px; border-radius: 4px; background: rgba(128,128,128,.18); }
.sp-common { opacity: .7; font-size: .85rem; margin-left: 6px; }
@media (max-width: 600px) { .sp-facts { grid-template-columns: 1fr; } .sp-facts dt { margin-top: 6px; } }
`;

// ---------- small helpers ----------
function mk(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
const byId = id => document.getElementById(id);
const prettyName = key => key.replace(/_/g, ' ');
const norm = s => s.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const fmt = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = mk('style', null, css);
  style.id = id;
  document.head.appendChild(style);
}

function showMessage(text) {
  const m = byId('species-message');
  if (m) m.textContent = text || '';
}

// ---------- data ----------
async function loadTaxonomy(url = TAXONOMY_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  // trim every field: the file has at least one name with a trailing space
  return parseCSV(await res.text()).map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v ?? '').trim()])));
}

const sp = {
  all: [], tax: [], traits: new Map(), byKey: new Map(), byFamily: new Map(),
  orderCount: new Map(), superCount: new Map(), nameIndex: new Map()
};

function bump(map, key) { map.set(key, (map.get(key) || 0) + 1); }

function setup(all, taxRows) {
  sp.all = all;
  sp.tax = taxRows;
  all.forEach(d => sp.traits.set(d.species.trim(), d));
  taxRows.forEach(r => {
    sp.byKey.set(r.species, r);
    sp.nameIndex.set(norm(r.species), r.species);
    if (r.common_name && !sp.nameIndex.has(norm(r.common_name))) sp.nameIndex.set(norm(r.common_name), r.species);
    if (!sp.byFamily.has(r.family)) sp.byFamily.set(r.family, new Map());
    const genera = sp.byFamily.get(r.family);
    if (!genera.has(r.genus)) genera.set(r.genus, []);
    genera.get(r.genus).push(r);
    bump(sp.orderCount, r.order);
    bump(sp.superCount, r.superorder);
  });
  sp.byFamily.forEach(genera => genera.forEach(rows => rows.sort((a, b) => a.species.localeCompare(b.species))));
}

// ---------- header ----------
function renderHeader(key) {
  const box = byId('species-header');
  if (!box) return;
  const compact = box.hasAttribute('data-compact');
  const t = sp.byKey.get(key), tr = sp.traits.get(key);
  box.textContent = '';

  const h = mk('h2', 'sp-title', prettyName(key));
  if (t.common_name) h.append(' ', mk('small', null, t.common_name));
  box.appendChild(h);

  // status line, plus a note when the two files disagree about the status
  const status = mk('span');
  let note = '';
  if (tr) {
    const dot = mk('span', 'sp-dot');
    dot.style.background = ERAS[tr.era].color;
    dot.setAttribute('aria-hidden', 'true');
    status.append(dot, `${tr.status} · ${ERAS[tr.era].label}`);
    if (t.status && t.status !== tr.status) {
      note = `The taxonomy file lists this species as ${t.status}. This page uses the traits file's status, like the map and charts.`;
    }
  } else {
    status.textContent = `${t.status} (not in the traits file)`;
  }

  if (compact) {
    const p = mk('p', 'sp-status');
    p.appendChild(status);
    box.appendChild(p);
    if (note) box.appendChild(mk('p', 'sp-note', note));
    return;
  }

  const dl = mk('dl', 'sp-facts');
  const add = (label, valueNode) => {
    dl.appendChild(mk('dt', null, label));
    const dd = mk('dd');
    dd.append(valueNode);
    dl.appendChild(dd);
  };
  add('Status', status);
  if (note) add('Note', document.createTextNode(note));
  add('Authority', document.createTextNode(t.taxonomic_authority || 'not listed'));
  add('Formally described', document.createTextNode(t.formally_described || 'not listed'));
  if (tr) {
    add('Where', document.createTextNode(
      `${tr.island_endemicity}, ${prettyName(tr.archipelago)} (${prettyName(tr.region)})`));
  }
  box.appendChild(dl);
}

// ---------- order > family > species dropdowns ----------
let browseSync = () => {};

function buildBrowse() {
  const box = byId('species-browse');
  if (!box) return;
  box.className = 'sp-browse';
  box.textContent = '';
  const select = label => {
    const s = mk('select');
    s.setAttribute('aria-label', label);
    return s;
  };
  const order = select('Order'), family = select('Family'), pick = select('Species');
  box.append('Or browse:', order, family, pick);

  const reset = (s, text, disabled) => {
    s.textContent = '';
    const o = mk('option', null, text);
    o.value = '';
    s.appendChild(o);
    s.disabled = disabled;
  };
  const addOption = (s, value, text) => {
    const o = mk('option', null, text);
    o.value = value;
    s.appendChild(o);
  };

  reset(order, 'Order…', false);
  [...sp.orderCount.keys()].sort().forEach(o => addOption(order, o, `${o} (${sp.orderCount.get(o)})`));

  function fillFamilies(orderName) {
    reset(family, 'Family…', !orderName);
    reset(pick, 'Species…', true);
    if (!orderName) return;
    const counts = new Map();
    sp.tax.filter(r => r.order === orderName).forEach(r => bump(counts, r.family));
    [...counts.keys()].sort().forEach(f => addOption(family, f, `${f} (${counts.get(f)})`));
  }
  function fillSpecies(familyName) {
    reset(pick, 'Species…', !familyName);
    if (!familyName) return;
    sp.tax.filter(r => r.family === familyName)
      .sort((a, b) => a.species.localeCompare(b.species))
      .forEach(r => addOption(pick, r.species, prettyName(r.species) + (r.common_name ? ` — ${r.common_name}` : '')));
  }

  fillFamilies('');
  order.addEventListener('change', () => fillFamilies(order.value));
  family.addEventListener('change', () => fillSpecies(family.value));
  pick.addEventListener('change', () => { if (pick.value) show(pick.value, true); });

  browseSync = key => {
    const t = sp.byKey.get(key);
    order.value = t.order;
    fillFamilies(t.order);
    family.value = t.family;
    fillSpecies(t.family);
    pick.value = key;
  };
}

// ---------- navigation ----------
const speciesRenderers = [];
// fn(key) draws one section for the chosen species
function registerSpeciesRenderer(fn) { speciesRenderers.push(fn); }

function show(key, push) {
  if (!sp.byKey.has(key)) return;
  showMessage('');
  const input = byId('species-search');
  if (input) input.value = prettyName(key);
  if (push) history.pushState({ species: key }, '', '?species=' + encodeURIComponent(key));
  document.title = `${prettyName(key)} | ${BASE_TITLE}`;
  renderHeader(key);
  speciesRenderers.forEach(fn => {
    try { fn(key); } catch (err) { console.error(err); }
  });
  browseSync(key);
  document.querySelectorAll('[data-species-link]').forEach(a => {
    a.href = a.dataset.speciesLink + '?species=' + encodeURIComponent(key);
  });
}

function findSpecies(query) {
  return sp.nameIndex.get(norm(query));
}

// Default when no ?species= is given: among species that have genus-mates (so the tree has
// something to show), the one with the most specimens behind its numbers
function defaultSpecies() {
  const score = d => (d.n_emm || 0) + (d.n_skel || 0) + (d.n_body || 0);
  const hasMates = d => {
    const t = sp.byKey.get(d.species.trim());
    return t && sp.byFamily.get(t.family).get(t.genus).length > 1;
  };
  const best = [...sp.all]
    .filter(hasMates)
    .sort((a, b) => score(b) - score(a) || a.species.localeCompare(b.species))[0];
  return best ? best.species.trim() : sp.tax[0].species;
}

function start() {
  injectStyle('sp-base-style', SP_BASE_CSS);

  const list = byId('species-list');
  if (list) {
    [...sp.tax].sort((a, b) => a.species.localeCompare(b.species)).forEach(r => {
      const o = mk('option');
      o.value = prettyName(r.species);
      if (r.common_name) o.label = r.common_name;
      list.appendChild(o);
    });
  }
  buildBrowse();

  const input = byId('species-search');
  if (input) {
    input.addEventListener('change', () => {
      const key = findSpecies(input.value);
      if (key) show(key, true);
      else if (input.value.trim()) showMessage(`No species matches "${input.value.trim()}".`);
    });
  }

  window.addEventListener('popstate', () => {
    const key = findSpecies(new URLSearchParams(location.search).get('species') || '') || defaultSpecies();
    show(key, false);
  });

  const wanted = new URLSearchParams(location.search).get('species');
  const key = wanted && findSpecies(wanted);
  show(key || defaultSpecies(), false);
  if (wanted && !key) showMessage(`No species matches "${wanted}". Showing an example instead.`);
}

// ---------- wiring ----------
const taxPromise = loadTaxonomy();
taxPromise.catch(() => {}); // the error is reported below, once the traits data has loaded
registerRenderer(all => {
  taxPromise
    .then(tax => { setup(all, tax); start(); })
    .catch(err => {
      console.error(err);
      showMessage('Could not load the data: ' + err.message);
    });
}, ['species-header']);