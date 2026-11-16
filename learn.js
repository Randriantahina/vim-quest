// Pédagogie : quoi enseigner, dans quel ordre, quand réviser, comment expliquer. Aucune dépendance au DOM.
(function (root) {
  'use strict';
  const { GROUPS, COMMANDS } = root.DRILLS_DATA;

  // On apprend d'abord ce qui sert tout de suite (bouger, supprimer, écrire), puis on affine.
  const GROUP_ORDER = [0, 3, 4, 1, 5, 2, 6, 7, 8, 9, 10];
  const LIST = GROUP_ORDER.flatMap(g => COMMANDS.filter(c => c.group === g));
  const INTERVAL = [2, 4, 8, 16, 30]; // révision espacée : nombre de défis avant de revoir, selon la boîte (0 à 4)
  const INTRO_REPS = 3;               // 1re fois guidée, 2e aidée, 3e en autonomie

  const newSave = () => ({ xp: 0, streak: 0, bestStreak: 0, counter: 0, done: 0, sinceNew: 0, cmds: {} });
  const rec = (s, id) => s.cmds[id] || (s.cmds[id] = { box: 0, seen: 0, last: -99 });
  const learned = (s, c) => rec(s, c.k).seen >= INTRO_REPS;
  const byId = id => LIST.find(c => c.k === id);

  // 0 = guidé (touches imposées), 1 = aidé (touches proposées si tu hésites), 2 = en autonomie
  const modeFor = (s, c) => Math.min(2, rec(s, c.k).seen);
  // Les exercices les plus courts d'abord : la 1re fois, on découvre la commande sous sa forme la plus simple.
  const drillFor = (s, c) => {
    const sorted = c.drills.slice().sort((x, y) => root.Vim.tokenize(x.keys).length - root.Vim.tokenize(y.keys).length);
    return sorted[rec(s, c.k).seen % sorted.length];
  };

  function pickNext(s, forcedId) {
    if (forcedId) return byId(forcedId);
    const partial = LIST.find(c => { const r = rec(s, c.k); return r.seen > 0 && r.seen < INTRO_REPS; });
    if (partial) return partial; // on termine l'apprentissage d'une commande avant d'en ouvrir une autre
    const due = LIST.filter(c => learned(s, c))
      .map(c => ({ c, over: s.counter - rec(s, c.k).last - INTERVAL[rec(s, c.k).box] }))
      .filter(x => x.over >= 0).sort((a, b) => b.over - a.over);
    const fresh = LIST.find(c => rec(s, c.k).seen === 0);
    // Une nouvelle commande tous les ~5 défis, les révisions comblent le reste.
    if (due.length && !(fresh && s.sinceNew >= 4)) return due[0].c;
    if (fresh) return fresh;
    if (due.length) return due[0].c;
    const pool = LIST.filter(c => learned(s, c)).sort((a, b) => rec(s, a.k).box - rec(s, b.k).box);
    return pool[Math.floor(Math.random() * Math.min(5, pool.length))];
  }

  // L'objectif est atteint quand le texte est identique (et le curseur, pour les exercices de déplacement), en mode normal.
  function isGoal(v, drill) {
    if (v.mode !== 'n' || v.pend) return false;
    if (JSON.stringify(v.lines) !== JSON.stringify(drill.after.lines)) return false;
    const cursorOnly = JSON.stringify(drill.lines) === JSON.stringify(drill.after.lines);
    return !cursorOnly || (v.row === drill.after.cur[0] && v.col === drill.after.cur[1]);
  }

  const stars = (keys, par) => (keys <= par ? 3 : keys <= Math.ceil(par * 1.6) ? 2 : 1);
  const levelOf = xp => 1 + Math.floor(Math.sqrt(xp / 40));
  const levelStart = lv => 40 * (lv - 1) * (lv - 1);

  // Enregistre un défi réussi. Retourne { xp, stars }.
  function record(s, cmd, { hinted, keys, par, mode }) {
    const r = rec(s, cmd.k), st = stars(keys, par);
    s.sinceNew = r.seen === 0 ? 0 : s.sinceNew + 1;
    r.seen++; s.counter++; s.done++; r.last = s.counter;
    if (mode === 0) r.box = Math.max(r.box, 1);
    else if (hinted) r.box = Math.max(0, r.box - 1);
    else if (st >= 2) r.box = Math.min(4, r.box + 1);
    s.streak = hinted ? 0 : s.streak + 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const xp = 10 + st * 5 + (hinted ? 0 : Math.min(10, s.streak * 2));
    s.xp += xp;
    return { xp, stars: st };
  }

  // La logique de la commande, expliquée APRÈS l'avoir faite : [[touche, sens], …]
  const M = {
    h: 'gauche', j: 'bas', k: 'haut', l: 'droite', w: 'word — mot suivant', b: 'back — mot précédent', e: 'end — fin du mot',
    '0': 'début de ligne', '^': '1er caractère visible', $: 'fin de ligne', f: 'find — jusqu’au caractère', t: 'till — juste avant le caractère',
    F: 'find en arrière', T: 'till en arrière', gg: 'haut du fichier', G: 'bas du fichier',
    d: 'delete — supprimer', c: 'change — supprimer puis écrire', y: 'yank — copier', p: 'paste — coller après', P: 'paste — coller avant',
    x: 'efface le caractère', X: 'efface le caractère avant', D: 'delete jusqu’à la fin de ligne', C: 'change jusqu’à la fin de ligne',
    r: 'replace — remplace 1 caractère', s: 'substitue 1 caractère', i: 'insert — écrire avant', a: 'append — écrire après',
    A: 'Append — écrire en fin de ligne', I: 'Insert — écrire en début de ligne', o: 'open — nouvelle ligne dessous', O: 'Open — nouvelle ligne dessus',
    u: 'undo — annuler', '~': 'inverse la casse', J: 'Join — joindre les lignes', v: 'visual — sélection', V: 'Visual — sélection de lignes'
  };
  const OBJ = { w: 'un mot', '"': 'des guillemets', '(': 'des parenthèses', ')': 'des parenthèses', '[': 'des crochets', '{': 'des accolades' };

  function explain(id) {
    const out = [];
    let i = 0, op = null, obj = null;
    while (i < id.length) {
      const ch = id[i];
      if (/\d/.test(ch)) { let n = ch; while (/\d/.test(id[i + 1] || '')) n += id[++i]; out.push([n, 'répète ' + n + ' fois']); i++; continue; }
      if (id.startsWith('gg', i)) { out.push(['gg', M.gg]); i += 2; continue; }
      if (id.startsWith('>>', i)) { out.push(['>>', 'indente la ligne']); i += 2; continue; }
      if (id.startsWith('<<', i)) { out.push(['<<', 'désindente la ligne']); i += 2; continue; }
      if (obj) { out.push([ch, OBJ[ch] || ch]); obj = null; i++; continue; }
      if (op && ch === op) { out.push([ch, 'même lettre : toute la ligne']); op = null; i++; continue; }
      if (op && (ch === 'i' || ch === 'a')) { out.push([ch, ch === 'i' ? 'inside — à l’intérieur de' : 'around — avec les délimiteurs de']); obj = true; i++; continue; }
      out.push([ch, M[ch] || '']);
      op = 'dcy'.includes(ch) ? ch : null;
      i++;
    }
    return out;
  }

  root.Learn = { LIST, GROUP_ORDER, INTERVAL, INTRO_REPS, newSave, rec, learned, modeFor, drillFor, pickNext, stars, levelOf, levelStart, record, explain, byId, isGoal };
  if (typeof module !== 'undefined') module.exports = root.Learn;
})(typeof window !== 'undefined' ? window : globalThis);
