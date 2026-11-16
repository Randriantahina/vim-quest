// Vérifie la pédagogie : ordre d'apprentissage, révisions, explications. Usage : node tests/learn.test.js
const Vim = require('../vimcore.js');
const D = require('../drills.js');
const L = require('../learn.js');
let failed = 0;
const fail = (...a) => { failed++; console.log('FAIL', ...a); };

// 1. Chaque exercice est réussi par sa propre solution selon le critère du jeu, et pas avant d'avoir joué.
for (const d of D.DRILLS) {
  if (L.isGoal(Vim.create(d.lines, d.cur), d)) fail('objectif déjà atteint au départ', d.cmd, d.keys);
  if (!L.isGoal(Vim.run(d.lines, d.cur, d.keys), d)) fail('solution refusée', d.cmd, d.keys);
}
// 2. Chaque commande a une explication complète.
for (const c of L.LIST) {
  const e = L.explain(c.k);
  if (!e.length || e.some(([k, t]) => !k || !t)) fail('explication incomplète', c.k, JSON.stringify(e));
}
// 3. Simulation d'un joueur parfait : tout est introduit, 3 fois de suite, dans l'ordre.
const s = L.newSave(), order = [], runs = {};
for (let i = 0; i < 400; i++) {
  const c = L.pickNext(s), r = L.rec(s, c.k);
  const mode = L.modeFor(s, c), d = L.drillFor(s, c);
  if (r.seen === 0) order.push(c.k);
  runs[c.k] = (runs[c.k] || 0) + 1;
  L.record(s, c, { hinted: false, keys: Vim.tokenize(d.keys).length, par: Vim.tokenize(d.keys).length, mode });
}
if (order.join() !== L.LIST.map(c => c.k).join()) fail('ordre d’introduction', order.join(' '));
if (L.LIST.some(c => (runs[c.k] || 0) < 3)) fail('commande jamais apprise');
// 4. Les erreurs rapprochent la révision : une commande aidée repasse plus vite qu'une maîtrisée.
const t = L.newSave();
const a = L.LIST[0], b = L.LIST[1];
for (const c of [a, b]) for (let i = 0; i < 3; i++) L.record(t, c, { hinted: false, keys: 2, par: 2, mode: Math.min(2, i) });
for (let i = 0; i < 3; i++) L.record(t, a, { hinted: false, keys: 2, par: 2, mode: 2 });
L.record(t, b, { hinted: true, keys: 2, par: 2, mode: 2 });
if (!(L.rec(t, a.k).box > L.rec(t, b.k).box)) fail('boîtes de révision', L.rec(t, a.k).box, L.rec(t, b.k).box);
// 5. Étoiles et niveaux
if (L.stars(2, 2) !== 3 || L.stars(3, 2) !== 2 || L.stars(9, 2) !== 1) fail('étoiles');
if (L.levelOf(0) !== 1 || L.levelOf(40) !== 2) fail('niveaux');
console.log(failed ? failed + ' échec(s)' : `OK : pédagogie (${L.LIST.length} commandes, ordre, révisions, explications)`);
process.exit(failed ? 1 : 0);
