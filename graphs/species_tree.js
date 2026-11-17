// common.js: common code for all pages. Load before map.js and species_common.js.
// species_common.js: common code for species pages. Load after common.js, before species_tree.js.
// species-tree.js: the taxonomic tree for one species. Load after species-common.js.
// Page element: <div id="species-tree">

const SPT_CSS = `
.sp-tree, .sp-tree ul { list-style: none; margin: 0; padding-left: 18px; border-left: 1px solid rgba(128,128,128,.4); }
.sp-tree { padding-left: 0; border-left: 0; }
.sp-tree li { margin: 3px 0; line-height: 1.45; }
.sp-tree summary { cursor: pointer; }
.sp-tree [aria-current] { font-weight: 700; }
.sp-rank { font-size: .68rem; text-transform: uppercase; letter-spacing: .05em; opacity: .65; margin-right: 6px; }
.sp-count { opacity: .65; font-size: .82rem; margin-left: 6px; }
.sp-legend { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: .8rem; margin-top: 10px; opacity: .85; }
`;

// ---------- taxonomic tree ----------
function speciesItem(row, selected) {
  const li = mk('li');
  const tr = sp.traits.get(row.species);
  const dot = mk('span', 'sp-dot');
  dot.style.background = tr ? ERAS[tr.era].color : '#999';
  dot.setAttribute('aria-hidden', 'true');
  li.appendChild(dot);

  const name = prettyName(row.species);
  if (selected) {
    const s = mk('strong', null, name);
    s.setAttribute('aria-current', 'true');
    li.appendChild(s);
  } else {
    const a = mk('a', null, name);
    a.href = '?species=' + encodeURIComponent(row.species);
    a.addEventListener('click', ev => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return; // let new-tab clicks through
      ev.preventDefault();
      show(row.species, true);
    });
    li.appendChild(a);
  }
  li.appendChild(mk('span', 'sp-code', tr ? tr.status : row.status));
  if (row.common_name) li.appendChild(mk('span', 'sp-common', row.common_name));
  return li;
}

function rankNode(rank, name, countText) {
  const li = mk('li');
  li.append(mk('span', 'sp-rank', rank), mk('strong', null, name));
  if (countText) li.appendChild(mk('span', 'sp-count', countText));
  return li;
}

function renderTree(key) {
  const box = byId('species-tree');
  if (!box) return;
  injectStyle('spt-style', SPT_CSS);
  const t = sp.byKey.get(key);
  box.textContent = '';

  const genera = sp.byFamily.get(t.family);
  const familySize = [...genera.values()].reduce((n, rows) => n + rows.length, 0);

  const genusList = mk('ul');
  [...genera.keys()].sort().forEach(g => {
    const rows = genera.get(g);
    const li = mk('li');
    if (g === t.genus) {
      li.append(mk('span', 'sp-rank', 'genus'), mk('strong', null, g), mk('span', 'sp-count', `${rows.length} species`));
      const ul = mk('ul');
      rows.forEach(r => ul.appendChild(speciesItem(r, r.species === key)));
      li.appendChild(ul);
    } else {
      const d = mk('details');
      const s = mk('summary');
      s.append(mk('span', 'sp-rank', 'genus'), mk('strong', null, g), mk('span', 'sp-count', `${rows.length} species`));
      const ul = mk('ul');
      rows.forEach(r => ul.appendChild(speciesItem(r, false)));
      d.append(s, ul);
      li.appendChild(d);
    }
    genusList.appendChild(li);
  });

  const family = rankNode('family', t.family, `${familySize} species, ${genera.size} genera`);
  family.appendChild(genusList);
  const order = rankNode('order', t.order, `${sp.orderCount.get(t.order)} species`);
  order.appendChild(mk('ul')).appendChild(family);
  const superorder = rankNode('superorder', t.superorder, `${sp.superCount.get(t.superorder)} species`);
  superorder.appendChild(mk('ul')).appendChild(order);

  const root = mk('ul', 'sp-tree');
  root.appendChild(superorder);

  const h = mk('h3', null, 'Taxonomic tree');
  const note = mk('p', 'sp-note',
    'Taxonomic hierarchy from the taxonomy file, not an evolutionary tree. Other genera in the family are collapsed; click one to open it.');

  const legend = mk('div', 'sp-legend');
  ERAS.forEach((era, i) => {
    if (!sp.all.some(d => d.era === i)) return; // skip eras with no species (Present Day)
    const item = mk('span');
    const dot = mk('span', 'sp-dot');
    dot.style.background = era.color;
    dot.setAttribute('aria-hidden', 'true');
    item.append(dot, `${era.label} (${era.statuses.join(', ')})`);
    legend.appendChild(item);
  });

  box.append(h, note, root, legend);
}

registerSpeciesRenderer(renderTree);