// _shot.js — headless Edge screenshot of the sankey PoC.
// usage: node _render/_shot.js [outName] [winWxH] [file]
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outName = process.argv[2] || 'shot.png';
const win = process.argv[3] || '1600,900';
const file = process.argv[4] || 'honeycreeper_sankey.html';
const root = path.resolve(__dirname, '..');
const url = 'file:///' + path.join(root, file).replace(/\\/g, '/');
const out = path.join(root, '_render', outName);
const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=' + win, '--screenshot=' + out.replace(/\\/g, '/'), url];
try {
  execSync('"' + edge + '" ' + args.map(function (a) { return /[ &]/.test(a) ? '"' + a + '"' : a; }).join(' '), { maxBuffer: 1 << 26, stdio: 'pipe' });
  console.log('OK', out, fs.statSync(out).size + ' bytes');
} catch (e) {
  console.log('ERR', (e.stdout || '').toString().slice(0, 300), (e.stderr || '').toString().slice(0, 500));
}

