// Vérifie le mini-Vim et chaque exercice de l'arcade. Usage : node tests/vim.test.js [--show]
const Vim = require('../vimcore.js');
const { COMMANDS, DRILLS, GROUPS } = require('../drills.js');
const show = process.argv.includes('--show');
let failed = 0;
const fail = (...a) => { failed++; console.log('FAIL', ...a); };
const mark = (lines, [r, c]) => lines.map((l, i) => (i === r ? l.slice(0, c) + '§' + l.slice(c) : l)).join(' ⏎ ');

for (const d of DRILLS) {
  const res = Vim.run(d.lines, d.cur, d.keys);
  const name = `${d.cmd} « ${d.keys} » sur ${JSON.stringify(d.lines)}`;
  if (res.mode !== 'n' || res.pend) fail(name, 'mode/pend non terminés', res.mode, res.pend);
  const moved = res.row !== d.cur[0] || res.col !== d.cur[1];
  const changed = JSON.stringify(res.lines) !== JSON.stringify(d.lines);
  if (!moved && !changed) fail(name, 'ne change rien');
  for (const alt of d.alts) {
    const a = Vim.run(d.lines, d.cur, alt);
    if (JSON.stringify([a.lines, a.row, a.col]) !== JSON.stringify([res.lines, res.row, res.col])) fail(name, 'variante différente', alt, JSON.stringify(a.lines));
  }
  if (show) console.log(`${d.keys.padEnd(14)} ${mark(d.lines, d.cur)}  →  ${mark(res.lines, [res.row, res.col])}`);
}
for (const c of COMMANDS) if (c.drills.length < 2) fail(c.k, 'moins de 2 exercices');
console.log(failed ? `${failed} échec(s)` : `OK : ${COMMANDS.length} commandes, ${DRILLS.length} exercices, ${GROUPS.length} groupes`);
process.exit(failed ? 1 : 0);
