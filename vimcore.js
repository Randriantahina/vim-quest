// Mini-Vim : un vrai petit moteur d'édition (mode normal, insertion, visuel) sans aucune dépendance.
// Le jeu s'en sert pour calculer le résultat exact de chaque commande, donc rien n'est « scripté ».
(function (root) {
  'use strict';

  const isWord = c => /[\p{L}\p{N}_]/u.test(c);
  const kind = c => (c === undefined ? -1 : /\s/.test(c) ? 0 : isWord(c) ? 1 : 2);
  const OPEN = { '(': '(', ')': '(', b: '(', '[': '[', ']': '[', '{': '{', '}': '{', B: '{', '<': '<', '>': '<' };
  const CLOSER = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const indentOf = s => /^\s*/.exec(s)[0];

  function create(lines, cur) {
    return { lines: lines.slice(), row: cur ? cur[0] : 0, col: cur ? cur[1] : 0, mode: 'n', pend: '', reg: null, undo: [], vis: null, lastFind: null, sw: 2 };
  }
  function clamp(v) {
    v.row = Math.max(0, Math.min(v.row, v.lines.length - 1));
    const len = v.lines[v.row].length;
    v.col = Math.max(0, Math.min(v.col, v.mode === 'i' ? len : Math.max(0, len - 1)));
  }
  const snap = v => v.undo.push({ lines: v.lines.slice(), row: v.row, col: v.col });
  const firstNonBlank = line => Math.min(indentOf(line).length, Math.max(0, line.length - 1));

  // ---------- texte ----------
  function getRange(v, r1, c1, r2, c2) {
    if (r1 === r2) return v.lines[r1].slice(c1, c2);
    const out = [v.lines[r1].slice(c1)];
    for (let r = r1 + 1; r < r2; r++) out.push(v.lines[r]);
    out.push(v.lines[r2].slice(0, c2));
    return out.join('\n');
  }
  function delRange(v, r1, c1, r2, c2) {
    const head = v.lines[r1].slice(0, c1), tail = v.lines[r2].slice(c2);
    v.lines.splice(r1, r2 - r1 + 1, head + tail);
  }

  // ---------- mouvements ----------
  function nextWord(L, r, c) {
    let line = L[r];
    const k = kind(line[c]);
    if (k > 0) while (c < line.length && kind(line[c]) === k) c++;
    for (;;) {
      while (c < line.length && kind(line[c]) === 0) c++;
      if (c < line.length) return [r, c];
      if (r + 1 >= L.length) return [r, line.length];
      r++; line = L[r]; c = 0;
      if (line.length === 0) return [r, 0];
    }
  }
  function endWord(L, r, c) {
    let line = L[r];
    c++;
    for (;;) {
      while (c < line.length && kind(line[c]) === 0) c++;
      if (c < line.length) break;
      if (r + 1 >= L.length) return [r, Math.max(0, line.length - 1)];
      r++; line = L[r]; c = 0;
    }
    const k = kind(line[c]);
    while (c + 1 < line.length && kind(line[c + 1]) === k) c++;
    return [r, c];
  }
  function prevWord(L, r, c) {
    let line = L[r];
    c--;
    for (;;) {
      while (c >= 0 && kind(line[c]) === 0) c--;
      if (c >= 0) break;
      if (r === 0) return [0, 0];
      r--; line = L[r]; c = line.length - 1;
    }
    const k = kind(line[c]);
    while (c > 0 && kind(line[c - 1]) === k) c--;
    return [r, c];
  }
  function findChar(line, col, ch, how, n) {
    let pos = col;
    for (let i = 0; i < n; i++) {
      pos = how === 'f' || how === 't' ? line.indexOf(ch, pos + 1) : pos > 0 ? line.lastIndexOf(ch, pos - 1) : -1;
      if (pos < 0) return -1;
    }
    return how === 't' ? pos - 1 : how === 'T' ? pos + 1 : pos;
  }

  // m : « w », « $ », « fx »… ; cnt : nombre tapé ou null ; op : un opérateur attend ce mouvement
  function motion(v, m, cnt, op) {
    const L = v.lines, n = cnt || 1;
    let r = v.row, c = v.col;
    switch (m[0]) {
      case 'h': return { r, c: Math.max(0, c - n), type: 'excl' };
      case 'l': return { r, c: Math.min(op ? L[r].length : Math.max(0, L[r].length - 1), c + n), type: 'excl' };
      case 'j': return { r: Math.min(L.length - 1, r + n), c, type: 'line' };
      case 'k': return { r: Math.max(0, r - n), c, type: 'line' };
      case '0': return { r, c: 0, type: 'excl' };
      case '^': return { r, c: indentOf(L[r]).length, type: 'excl' };
      case '$': return { r, c: Math.max(0, L[r].length - 1), type: 'incl' };
      case 'G': return { r: cnt ? Math.min(cnt, L.length) - 1 : L.length - 1, c, type: 'line' };
      case 'g': if (m === 'gg') return { r: cnt ? Math.min(cnt, L.length) - 1 : 0, c, type: 'line' }; return null;
      case 'w': {
        for (let i = 0; i < n; i++) [r, c] = nextWord(L, r, c);
        if (op && r > v.row) { r = v.row; c = L[r].length; }
        return { r, c, type: 'excl' };
      }
      case 'e': for (let i = 0; i < n; i++) [r, c] = endWord(L, r, c); return { r, c, type: 'incl' };
      case 'b': for (let i = 0; i < n; i++) [r, c] = prevWord(L, r, c); return { r, c, type: 'excl' };
      case 'f': case 't': case 'F': case 'T': {
        if (m.length < 2) return null;
        const found = findChar(L[r], c, m[1], m[0], n);
        if (found < 0) return null;
        return { r, c: found, type: m[0] === 'f' || m[0] === 't' ? 'incl' : 'excl', find: [m[0], m[1]] };
      }
      case ';': case ',': {
        if (!v.lastFind) return null;
        let [how, ch] = v.lastFind;
        if (m === ',') how = { f: 'F', F: 'f', t: 'T', T: 't' }[how];
        const found = findChar(L[r], c, ch, how, n);
        return found < 0 ? null : { r, c: found, type: how === 'f' || how === 't' ? 'incl' : 'excl' };
      }
    }
    return null;
  }

  // ---------- objets texte (sur la ligne courante) ----------
  function textObject(v, around, ch) {
    const line = v.lines[v.row], col = v.col;
    if (ch === 'w') {
      let s = col, e = col;
      const k = kind(line[col]);
      if (k < 0) return null;
      while (s > 0 && kind(line[s - 1]) === k) s--;
      while (e + 1 < line.length && kind(line[e + 1]) === k) e++;
      e++;
      if (around) {
        if (k !== 0) {
          if (kind(line[e]) === 0) while (e < line.length && kind(line[e]) === 0) e++;
          else while (s > 0 && kind(line[s - 1]) === 0) s--;
        } else {
          const k2 = kind(line[e]);
          if (k2 > 0) while (e < line.length && kind(line[e]) === k2) e++;
        }
      }
      return [s, e];
    }
    if ('"\'`'.includes(ch)) {
      const idx = [];
      for (let i = 0; i < line.length; i++) if (line[i] === ch) idx.push(i);
      for (let i = 0; i + 1 < idx.length; i += 2) {
        if (col <= idx[i + 1]) {
          let s = idx[i], e = idx[i + 1] + 1;
          if (!around) return [s + 1, e - 1];
          if (line[e] === ' ') while (line[e] === ' ') e++;
          else while (s > 0 && line[s - 1] === ' ') s--;
          return [s, e];
        }
      }
      return null;
    }
    const open = OPEN[ch];
    if (!open) return null;
    const close = CLOSER[open];
    let s = -1, depth = 0;
    for (let i = col; i >= 0; i--) {
      if (line[i] === close && i !== col) depth++;
      else if (line[i] === open) { if (depth === 0) { s = i; break; } depth--; }
    }
    if (s < 0) return null;
    let e = -1;
    depth = 0;
    for (let i = s + 1; i < line.length; i++) {
      if (line[i] === open) depth++;
      else if (line[i] === close) { if (depth === 0) { e = i; break; } depth--; }
    }
    if (e < 0) return null;
    return around ? [s, e + 1] : [s + 1, e];
  }

  // ---------- opérateurs ----------
  function lineOp(v, op, a, b) {
    const L = v.lines;
    const text = L.slice(a, b + 1).join('\n');
    if (op === 'y') { v.reg = { text, line: true }; v.row = a; return; }
    snap(v);
    v.reg = { text, line: true };
    if (op === 'd') {
      L.splice(a, b - a + 1);
      if (!L.length) L.push('');
      v.row = Math.min(a, L.length - 1);
      v.col = firstNonBlank(L[v.row]);
    } else {
      const ind = indentOf(L[a]);
      L.splice(a, b - a + 1, ind);
      v.row = a; v.col = ind.length; v.mode = 'i';
    }
  }
  function charOp(v, op, r1, c1, r2, c2) {
    if (r2 < r1 || (r2 === r1 && c2 < c1)) [r1, c1, r2, c2] = [r2, c2, r1, c1];
    const text = getRange(v, r1, c1, r2, c2);
    if (op === 'y') { v.reg = { text, line: false }; v.row = r1; v.col = c1; return; }
    snap(v);
    v.reg = { text, line: false };
    delRange(v, r1, c1, r2, c2);
    v.row = r1; v.col = c1;
    if (op === 'c') v.mode = 'i'; else clamp(v);
  }
  function paste(v, before, n) {
    const reg = v.reg;
    if (!reg) return;
    snap(v);
    if (reg.line) {
      const lines = reg.text.split('\n'), rep = [];
      for (let i = 0; i < n; i++) rep.push(...lines);
      const at = before ? v.row : v.row + 1;
      v.lines.splice(at, 0, ...rep);
      v.row = at; v.col = firstNonBlank(v.lines[at]);
      return;
    }
    const t = reg.text.repeat(n), line = v.lines[v.row];
    const at = before || !line.length ? v.col : Math.min(line.length, v.col + 1);
    const parts = t.split('\n');
    if (parts.length === 1) { v.lines[v.row] = line.slice(0, at) + t + line.slice(at); v.col = at + t.length - 1; return; }
    const head = line.slice(0, at), tail = line.slice(at);
    v.lines.splice(v.row, 1, head + parts[0], ...parts.slice(1, -1), parts[parts.length - 1] + tail);
    v.col = at;
  }
  function join(v, count) {
    snap(v);
    for (let i = 0; i < Math.max(1, count - 1); i++) {
      if (v.row + 1 >= v.lines.length) break;
      const cur = v.lines[v.row], next = v.lines[v.row + 1].trimStart();
      const sep = next === '' || cur === '' || /\s$/.test(cur) ? '' : ' ';
      v.col = sep ? cur.length : Math.max(0, cur.length - 1);
      v.lines.splice(v.row, 2, cur + sep + next);
    }
  }
  function shift(v, a, b, dir) {
    snap(v);
    for (let r = a; r <= b; r++) {
      const line = v.lines[r];
      if (dir > 0) { if (line.length) v.lines[r] = ' '.repeat(v.sw) + line; }
      else v.lines[r] = line.replace(new RegExp('^ {1,' + v.sw + '}'), '');
    }
    v.row = a; v.col = firstNonBlank(v.lines[a]);
  }
  function toggleCase(s) { return [...s].map(ch => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join(''); }

  // ---------- mode normal ----------
  function applyMotion(v, mv) {
    v.row = mv.r; v.col = mv.c;
    if (mv.find) v.lastFind = mv.find;
    clamp(v);
  }

  // Retourne false tant que la commande est incomplète, true quand elle a été exécutée (ou ignorée).
  function exec(v) {
    const s = v.pend;
    const m = /^([1-9]\d*)?/.exec(s), cnt = m[1] ? +m[1] : null, n = cnt || 1, rest = s.slice(m[0].length);
    if (!rest) return false;
    const ch = rest[0], L = v.lines;

    if ('dcy'.includes(ch)) {
      const after = rest.slice(1), m2 = /^([1-9]\d*)?/.exec(after), cnt2 = m2[1] ? +m2[1] : null, mot = after.slice(m2[0].length);
      if (!mot) return false;
      const total = (cnt || 1) * (cnt2 || 1), explicit = cnt || cnt2 ? total : null;
      if (mot === ch) { lineOp(v, ch, v.row, Math.min(L.length - 1, v.row + total - 1)); return true; }
      if ('ia'.includes(mot[0])) {
        if (mot.length < 2) return false;
        const range = textObject(v, mot[0] === 'a', mot[1]);
        if (range) charOp(v, ch, v.row, range[0], v.row, range[1]);
        return true;
      }
      if ('fFtTg'.includes(mot[0]) && mot.length < 2) return false;
      const mv = motion(v, mot, explicit, true);
      if (!mv) return true;
      // cw agit comme dw, mais sans avaler les espaces qui suivent le dernier mot
      if (ch === 'c' && mot === 'w' && kind(L[v.row][v.col]) > 0) while (mv.c > v.col && kind(L[mv.r][mv.c - 1]) === 0) mv.c--;
      if (mv.find) v.lastFind = mv.find;
      if (mv.type === 'line') lineOp(v, ch, Math.min(v.row, mv.r), Math.max(v.row, mv.r));
      else charOp(v, ch, v.row, v.col, mv.r, mv.c + (mv.type === 'incl' ? 1 : 0));
      return true;
    }

    switch (ch) {
      case 'r': {
        if (rest.length < 2) return false;
        const line = L[v.row];
        if (v.col + n <= line.length) {
          snap(v);
          L[v.row] = line.slice(0, v.col) + rest[1].repeat(n) + line.slice(v.col + n);
          v.col += n - 1;
        }
        return true;
      }
      case 'f': case 't': case 'F': case 'T': {
        if (rest.length < 2) return false;
        const mv = motion(v, rest, cnt, false);
        if (mv) applyMotion(v, mv);
        return true;
      }
      case 'g': {
        if (rest.length < 2) return false;
        const mv = motion(v, rest, cnt, false);
        if (mv) applyMotion(v, mv);
        return true;
      }
      case '>': case '<': {
        if (rest.length < 2) return false;
        if (rest[1] === ch) shift(v, v.row, Math.min(L.length - 1, v.row + n - 1), ch === '>' ? 1 : -1);
        return true;
      }
      case 'x': charOp(v, 'd', v.row, v.col, v.row, Math.min(L[v.row].length, v.col + n)); return true;
      case 'X': charOp(v, 'd', v.row, Math.max(0, v.col - n), v.row, v.col); return true;
      case 'D': charOp(v, 'd', v.row, v.col, v.row, L[v.row].length); return true;
      case 'C': charOp(v, 'c', v.row, v.col, v.row, L[v.row].length); return true;
      case 's': charOp(v, 'c', v.row, v.col, v.row, Math.min(L[v.row].length, v.col + n)); return true;
      case 'S': lineOp(v, 'c', v.row, Math.min(L.length - 1, v.row + n - 1)); return true;
      case 'Y': lineOp(v, 'y', v.row, Math.min(L.length - 1, v.row + n - 1)); return true;
      case 'p': paste(v, false, n); return true;
      case 'P': paste(v, true, n); return true;
      case 'J': join(v, cnt || 2); return true;
      case 'u': {
        const prev = v.undo.pop();
        if (prev) { v.lines = prev.lines; v.row = prev.row; v.col = prev.col; clamp(v); }
        return true;
      }
      case '~': {
        const line = L[v.row];
        if (line.length) {
          snap(v);
          L[v.row] = line.slice(0, v.col) + toggleCase(line.slice(v.col, v.col + n)) + line.slice(v.col + n);
          v.col = Math.min(line.length - 1, v.col + n);
        }
        return true;
      }
      case 'i': snap(v); v.mode = 'i'; return true;
      case 'a': snap(v); if (L[v.row].length) v.col++; v.mode = 'i'; return true;
      case 'A': snap(v); v.col = L[v.row].length; v.mode = 'i'; return true;
      case 'I': snap(v); v.col = indentOf(L[v.row]).length; v.mode = 'i'; return true;
      case 'o': case 'O': {
        snap(v);
        const ind = indentOf(L[v.row]), at = ch === 'o' ? v.row + 1 : v.row;
        L.splice(at, 0, ind);
        v.row = at; v.col = ind.length; v.mode = 'i';
        return true;
      }
      case 'v': case 'V': v.vis = { r: v.row, c: v.col, line: ch === 'V' }; v.mode = 'v'; return true;
      default: {
        const mv = motion(v, rest, cnt, false);
        if (mv) applyMotion(v, mv);
        return true;
      }
    }
  }

  // ---------- mode visuel ----------
  function visualKey(v, k) {
    if (k === 'Escape') { v.mode = 'n'; v.vis = null; v.pend = ''; return; }
    v.pend += k;
    const m = /^([1-9]\d*)?/.exec(v.pend), cnt = m[1] ? +m[1] : null, rest = v.pend.slice(m[0].length);
    if (!rest) return;
    const ch = rest[0];
    const sel = () => {
      let [r1, c1, r2, c2] = [v.vis.r, v.vis.c, v.row, v.col];
      if (r2 < r1 || (r2 === r1 && c2 < c1)) [r1, c1, r2, c2] = [r2, c2, r1, c1];
      return [r1, c1, r2, c2];
    };
    const finish = fn => { const [r1, c1, r2, c2] = sel(), line = v.vis.line; v.mode = 'n'; v.vis = null; fn(r1, c1, r2, c2, line); v.pend = ''; };
    if ('dxyc s'.includes(ch) && ch !== ' ') {
      finish((r1, c1, r2, c2, line) => {
        const op = ch === 'y' ? 'y' : ch === 'c' || ch === 's' ? 'c' : 'd';
        if (line) lineOp(v, op, r1, r2); else charOp(v, op, r1, c1, r2, c2 + 1);
      });
      return;
    }
    if (ch === '>' || ch === '<') { finish((r1, c1, r2) => shift(v, r1, r2, ch === '>' ? 1 : -1)); return; }
    if (ch === '~') {
      finish((r1, c1, r2, c2, line) => {
        snap(v);
        for (let r = r1; r <= r2; r++) {
          const a = line || r > r1 ? 0 : c1, b = line || r < r2 ? v.lines[r].length : c2 + 1;
          v.lines[r] = v.lines[r].slice(0, a) + toggleCase(v.lines[r].slice(a, b)) + v.lines[r].slice(b);
        }
        v.row = r1; v.col = line ? 0 : c1;
      });
      return;
    }
    if (ch === 'v' || ch === 'V') { if ((ch === 'V') === v.vis.line) { v.mode = 'n'; v.vis = null; } else v.vis.line = ch === 'V'; v.pend = ''; return; }
    if (ch === 'o') { [v.vis.r, v.row] = [v.row, v.vis.r]; [v.vis.c, v.col] = [v.col, v.vis.c]; v.pend = ''; return; }
    if ('fFtTg'.includes(ch) && rest.length < 2) return;
    const mv = motion(v, rest, cnt, false);
    if (mv) applyMotion(v, mv);
    v.pend = '';
  }

  // ---------- mode insertion ----------
  function insertKey(v, k) {
    const L = v.lines, line = L[v.row];
    if (k === 'Escape') { v.mode = 'n'; if (v.col > 0) v.col--; clamp(v); return; }
    if (k === 'Enter') {
      const ind = indentOf(line);
      L.splice(v.row, 1, line.slice(0, v.col), ind + line.slice(v.col));
      v.row++; v.col = ind.length;
    } else if (k === 'Backspace') {
      if (v.col > 0) { L[v.row] = line.slice(0, v.col - 1) + line.slice(v.col); v.col--; }
      else if (v.row > 0) { const prev = L[v.row - 1]; L.splice(v.row - 1, 2, prev + line); v.row--; v.col = prev.length; }
    } else if (k.length === 1) {
      L[v.row] = line.slice(0, v.col) + k + line.slice(v.col);
      v.col++;
    }
  }

  // Une touche : 'Escape', 'Enter', 'Backspace' ou un caractère.
  function key(v, k) {
    if (v.mode === 'i') insertKey(v, k);
    else if (v.mode === 'v') visualKey(v, k);
    else if (k === 'Escape') v.pend = '';
    else if (k.length === 1) { v.pend += k; if (exec(v)) v.pend = ''; }
    clamp(v);
    return v;
  }

  // « cwnew<Esc> » → ['c','w','n','e','w','Escape']
  function tokenize(seq) {
    return (seq.match(/<(?:Esc|CR|BS)>|[\s\S]/gu) || []).map(t => ({ '<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace' }[t] || t));
  }
  function feed(v, seq) { for (const k of tokenize(seq)) key(v, k); return v; }
  function run(lines, cur, seq) { return feed(create(lines, cur), seq); }

  // Écrit un tampon avec § devant le caractère sous le curseur : « const §x = 1; » (lignes séparées par \n).
  function parseBuffer(text) {
    const lines = text.split('\n');
    for (let r = 0; r < lines.length; r++) {
      const c = lines[r].indexOf('§');
      if (c >= 0) { lines[r] = lines[r].replace('§', ''); return { lines, cur: [r, c] }; }
    }
    return { lines, cur: [0, 0] };
  }

  root.Vim = { create, key, feed, run, tokenize, parseBuffer };
  if (typeof module !== 'undefined') module.exports = root.Vim;
})(typeof window !== 'undefined' ? window : globalThis);
