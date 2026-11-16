// Test sans navigateur : joue la solution de chaque étage touche par touche et vérifie qu'il est réussi.
// Usage : node tests/run.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const els = {};
const stub = () => ({ textContent: '', innerHTML: '', value: '', hidden: false, dataset: {}, style: {}, className: '', children: [],
  classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, blur() {}, focus() {},
  getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), closest: () => null });
const el = s => els[s] || (els[s] = stub());
el('#level-menu').hidden = true; el('#success').hidden = true; el('#hint-box').hidden = true;
const listeners = [];
const ctx = { document: { querySelector: el, activeElement: null, addEventListener() {} },
  window: { addEventListener: (t, f) => { if (t === 'keydown') listeners.push(f); } },
  localStorage: { getItem: () => null, setItem() {} }, structuredClone, setTimeout, clearTimeout, console };
vm.createContext(ctx);
const src = ['game.js', 'solutions.js', 'keys.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
vm.runInContext(src + '\nthis.__g = { get e() { return editorState }, get idx() { return index }, set idx(v) { index = v }, get unlocked() { return unlocked }, start: () => startLevel(), L: levels };', ctx);
const g = ctx.__g;
const press = (key, o = {}) => listeners.forEach(f => f({ key, ctrlKey: false, altKey: false, metaKey: false, getModifierState: () => false, preventDefault() {}, ...o }));
function play(seq) {
  for (const t of seq.match(/<[A-Za-z]+(?:-.)?>|[\s\S]/g)) {
    if (t === '<Esc>') press('Escape'); else if (t === '<CR>') press('Enter'); else if (t === '<BS>') press('Backspace');
    else if (t === '<C-w>') press('w', { altKey: true });
    else if (/^<C-.>$/.test(t)) press(t[3], { ctrlKey: true });
    else press(t);
  }
}
let failed = 0;
g.L.forEach((l, i) => {
  if (!l.editor) return;
  g.idx = i; g.start();
  const before = g.unlocked;
  if (!l.solution) { console.log(`FAIL étage ${i + 1} (${l.editor.file}) : pas de solution`); failed++; return; }
  play(l.solution);
  const ok = !before && g.unlocked;
  if (!ok) { failed++; console.log(`FAIL étage ${i + 1} (${l.editor.file}) ${l.solution} →`, JSON.stringify(g.e.lines), g.e.row, g.e.col, g.e.mode); }
});
// Compteurs : 3dd supprime trois lignes, 2x deux caractères, 5G va à la ligne 5
const lvl = file => g.L.findIndex(l => l.editor && l.editor.file === file);
g.idx = lvl('scroll.js'); g.start(); play('3dd');
if (g.e.lines.length !== 6) { failed++; console.log('FAIL 3dd', g.e.lines.length); }
g.idx = lvl('scroll.js'); g.start(); play('5G');
if (g.e.row !== 4) { failed++; console.log('FAIL 5G', g.e.row); }
g.idx = lvl('auth.js'); g.start(); play('2x');
if (g.e.lines[0] !== 'if (isReady) return;'.replace('(!','(!').slice(0, 4) + 'isReady) return;'.slice(0) && g.e.lines[0].length !== 19) { failed++; console.log('FAIL 2x', g.e.lines[0]); }
console.log(failed ? `${failed} étage(s) en échec` : `OK : ${g.L.filter(l => l.editor).length} étages d'édition résolus au clavier`);
process.exit(failed ? 1 : 0);
