const fs = require('fs');
const DATA = 'c:/Users/Maximo/Documents/Bird-Viz/data/';
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
function eraOf(status) {
  if (['EP', 'EPU'].includes(status)) return 'prehistoric';
  if (['EX', 'EH'].includes(status)) return 'historic';
  if (['EW', 'CR'].includes(status)) return 'edge';
  return 'extant';
}
const tax = parseCSV(fs.readFileSync(DATA + 'Avotrex_taxonomy_v1.csv', 'utf8'));
const avo = parseCSV(fs.readFileSync(DATA + 'DB_Avonet_BirdLife.csv', 'utf8'));
const fam = {}; // key: order|family
const orders = {};
function add(order, family, era) {
  if (!order || !family) return;
  const k = order + '\u0001' + family;
  if (!fam[k]) { fam[k] = { order, family, prehistoric: 0, historic: 0, edge: 0, extant: 0, n: 0 }; orders[order] = orders[order] || { n: 0 }; }
  fam[k][era]++; fam[k].n++; orders[order].n++;
}
tax.forEach(r => add(r.order, r.family, eraOf(r.status)));
avo.forEach(r => add(r.order, r.families ? r.families : r.family, eraOf(r.status)));
// build nested structure
const out = { generated: new Date().toISOString().slice(0, 10), total: 0, orders: [] };
Object.keys(orders).sort((a, b) => orders[b].n - orders[a].n).forEach(ord => {
  const fams = Object.values(fam).filter(f => f.order === ord).sort((a, b) => b.n - a.n || a.family.localeCompare(b.family));
  out.orders.push({ name: ord, n: orders[ord].n, families: fams.map(f => ({ name: f.family, n: f.n, prehistoric: f.prehistoric, historic: f.historic, edge: f.edge, extant: f.extant })) });
  out.total += orders[ord].n;
});
const json = JSON.stringify(out);
const js = '// phylo_overview_data.js — aggregated (order -> family -> era counts) from\n' +
  '// data/Avotrex_taxonomy_v1.csv (610 extinct) + data/DB_Avonet_BirdLife.csv (11,009 extant).\n' +
  '// Regenerate: node poc/data/gen_phylo_overview.js\n' +
  'const PHYLO_OVERVIEW = ' + json + ';\n';
fs.writeFileSync('c:/Users/Maximo/Documents/Bird-Viz/poc/data/phylo_overview_data.js', js);
console.log('orders=' + out.orders.length, 'total=' + out.total, 'bytes=' + js.length);
