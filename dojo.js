// Entraînement Vim : on pratique dans un vrai éditeur, on apprend en faisant, les explications arrivent après l'action.
(() => {
  'use strict';
  const { GROUPS } = window.DRILLS_DATA;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STORE = 'vim-dojo-v1', SESSION = 10;

  let save = Learn.newSave();
  try { save = { ...save, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { /* stockage indisponible */ }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch { /* ignoré */ } };

  const S = { view: 'none', overlay: null, cmd: null, drill: null, mode: 0, v: null, tokens: [], idx: 0, keys: 0, hinted: false, reveal: false, lastKey: 0, fbAt: 0,
    session: { n: 0, xp: 0, start: 0 } };

  // ---------- son ----------
  let actx = null;
  function beep(freq, dur = 0.1, type = 'triangle', gain = 0.05) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(gain, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
    } catch { /* pas d'audio */ }
  }
  const win = () => { beep(660, 0.08); setTimeout(() => beep(990, 0.14), 80); };

  // ---------- rendu du code ----------
  const KEY = { Escape: 'Échap', ' ': '␣', Enter: '⏎', Backspace: '⌫' };
  const cap = (t, cls = '') => '<span class="cap ' + cls + '">' + esc(KEY[t] || t) + '</span>';

  function selection(v, r) {
    if (v.mode !== 'v' || !v.vis) return null;
    let [r1, c1, r2, c2] = [v.vis.r, v.vis.c, v.row, v.col];
    if (r2 < r1 || (r2 === r1 && c2 < c1)) [r1, c1, r2, c2] = [r2, c2, r1, c1];
    if (r < r1 || r > r2) return null;
    if (v.vis.line) return [0, Infinity];
    return [r === r1 ? c1 : 0, r === r2 ? c2 + 1 : Infinity];
  }
  function codeHTML(lines, cur, { mode = 'n', v = null, changed = null, showCursor = true } = {}) {
    return lines.map((line, r) => {
      let inner = '';
      const sel = v ? selection(v, r) : null;
      for (let i = 0; i <= line.length; i++) {
        const isCur = showCursor && r === cur[0] && i === cur[1];
        if (i === line.length && !isCur) break;
        const ch = i < line.length ? line[i] : ' ';
        const inSel = sel && i >= sel[0] && i < sel[1];
        const cls = (isCur ? 'cur' + (mode === 'i' ? ' ins' : '') : '') + (inSel ? ' sel' : '');
        inner += cls ? '<span class="' + cls.trim() + '">' + esc(ch) + '</span>' : esc(ch);
      }
      const chg = changed && changed(line) ? ' chg' : '';
      return '<div class="ln' + chg + '"><span class="n">' + (r + 1) + '</span><span class="t">' + (inner || ' ') + '</span></div>';
    }).join('');
  }

  function renderEditor() {
    const v = S.v;
    $('#ed').innerHTML = codeHTML(v.lines, [v.row, v.col], { mode: v.mode, v });
    const m = $('#st-mode');
    m.textContent = v.mode === 'i' ? 'INSERTION' : v.mode === 'v' ? (v.vis && v.vis.line ? 'VISUEL LIGNE' : 'VISUEL') : 'NORMAL';
    m.className = 'st-mode' + (v.mode === 'i' ? ' ins' : v.mode === 'v' ? ' vis' : '');
    $('#st-cmd').textContent = v.pend;
    $('#st-pos').textContent = (v.row + 1) + ':' + (v.col + 1);
  }

  function renderGoal() {
    const d = S.drill, cursorOnly = JSON.stringify(d.lines) === JSON.stringify(d.after.lines);
    const before = new Set(d.lines);
    $('#goal').innerHTML = codeHTML(d.after.lines, d.after.cur, { showCursor: cursorOnly, changed: cursorOnly ? null : l => !before.has(l) });
    $('#goal-note').textContent = cursorOnly ? 'Amène ton curseur sur le bloc vert.' : 'Les lignes surlignées sont celles qui ont changé.';
  }

  function renderCoach() {
    const box = $('#coach');
    if (S.reveal) {
      const label = S.mode === 0 ? 'APPUIE SUR' : 'UNE FAÇON DE FAIRE';
      box.innerHTML = '<span class="lab">' + label + '</span>' + S.tokens.map((t, i) => cap(t, S.mode === 0 ? (i < S.idx ? 'done' : i === S.idx ? 'next' : '') : '')).join('');
    } else if (S.mode === 1) {
      box.innerHTML = '<span class="idle">Essaie de t’en souvenir. Si tu hésites, les touches apparaîtront.</span>';
    } else {
      box.innerHTML = '<span class="idle">Cette fois, sans aide. Tu peux le faire.</span>';
    }
  }

  function renderHud() {
    const lv = Learn.levelOf(save.xp), a = Learn.levelStart(lv), b = Learn.levelStart(lv + 1);
    $('#lv').textContent = 'NIV. ' + lv;
    $('#xp-fill').style.width = Math.round(100 * (save.xp - a) / (b - a)) + '%';
    $('#xp-txt').textContent = save.xp + ' XP';
    $('#streak').textContent = save.streak;
    $('.streak').classList.toggle('hot', save.streak >= 3);
    $('#dots').innerHTML = Array.from({ length: SESSION }, (_, i) => '<i class="' + (i < S.session.n ? 'done' : i === S.session.n ? 'now' : '') + '"></i>').join('');
  }

  // ---------- déroulement ----------
  function startChallenge(forcedId) {
    const cmd = Learn.pickNext(save, forcedId);
    S.cmd = cmd; S.mode = Learn.modeFor(save, cmd); S.drill = Learn.drillFor(save, cmd);
    S.tokens = Vim.tokenize(S.drill.keys);
    S.view = 'challenge'; S.overlay = null;
    $('#overlay').classList.remove('show');
    $('#feedback').hidden = true; $('#coach').hidden = false;
    resetBuffer();
    const seen = Learn.rec(save, cmd.k).seen;
    $('#t-tag').textContent = ['NOUVELLE COMMANDE', 'ON RÉPÈTE — AVEC MOINS D’AIDE', 'À TOI — EN AUTONOMIE'][seen] || 'RÉVISION';
    $('#t-title').textContent = cmd.d;
    $('#b-hint').hidden = S.mode === 0;
    renderGoal(); renderHud();
  }

  function resetBuffer() {
    S.v = Vim.create(S.drill.lines, S.drill.cur);
    S.idx = 0; S.keys = 0; S.reveal = S.mode === 0; S.lastKey = Date.now();
    renderEditor(); renderCoach();
  }

  function press(tok) {
    if (S.view !== 'challenge') return;
    if (S.v.mode === 'n' && (tok === 'Enter' || tok === 'Backspace')) return;
    if (S.mode === 0) {
      if (tok !== S.tokens[S.idx]) { const ed = $('.editor'); ed.classList.remove('shake'); void ed.offsetWidth; ed.classList.add('shake'); return; }
      S.idx++;
    }
    S.keys++; S.lastKey = Date.now();
    Vim.key(S.v, tok);
    renderEditor(); renderCoach();
    if (Learn.isGoal(S.v, S.drill)) success();
  }

  function giveHint() {
    if (S.view !== 'challenge' || S.reveal) return;
    S.reveal = true; S.hinted = true; renderCoach();
  }

  function success() {
    S.view = 'feedback'; S.fbAt = Date.now();
    const par = S.tokens.length;
    const before = Learn.levelOf(save.xp);
    const res = Learn.record(save, S.cmd, { hinted: S.hinted, keys: S.keys, par, mode: S.mode });
    persist();
    S.session.n++; S.session.xp += res.xp;
    win();
    const why = Learn.explain(S.cmd.k).map(([k, t]) => '<div>' + cap(k) + '<small>' + esc(t) + '</small></div>').join('');
    let tip = '';
    if (S.mode === 0) tip = '<p class="tip"><b>Nouvelle commande débloquée.</b> Tu la reverras avec moins d’aide, puis elle reviendra régulièrement pour s’ancrer.</p>';
    else if (res.stars < 3) tip = '<p class="tip">Tu as utilisé <b>' + S.keys + ' touches</b>. Version experte en <b>' + par + '</b> : ' + S.tokens.map(t => '<kbd>' + esc(KEY[t] || t) + '</kbd>').join(' ') + '</p>';
    else if (S.hinted) tip = '<p class="tip">Réussi avec de l’aide : cette commande reviendra bientôt pour que tu la fasses seul.</p>';
    const up = Learn.levelOf(save.xp) > before ? ' · <b style="color:var(--gold)">NIVEAU ' + Learn.levelOf(save.xp) + ' !</b>' : '';
    const fb = $('#feedback');
    fb.innerHTML = '<div class="fb-top"><b>✓ Bien joué</b><span class="stars">' + '★'.repeat(res.stars) + '<span style="opacity:.25">' + '★'.repeat(3 - res.stars) + '</span></span><span class="xp">+' + res.xp + ' XP' + up + '</span></div>' +
      '<div class="why">' + why + '</div>' + tip +
      '<div class="go"><button class="btn" id="b-next">' + (S.session.n >= SESSION ? 'VOIR MON BILAN' : 'SUIVANT') + ' <kbd>Entrée</kbd></button></div>';
    fb.hidden = false; $('#coach').hidden = true;
    renderHud();
  }

  function next() {
    if (S.session.n >= SESSION) return summary();
    startChallenge();
  }

  // ---------- écrans ----------
  const overlay = $('#overlay');
  const showOverlay = (name, html) => { S.overlay = name; overlay.innerHTML = '<div class="card">' + html + '</div>'; overlay.classList.add('show'); };
  const closeOverlay = () => { S.overlay = null; overlay.classList.remove('show'); };
  const mastered = () => Learn.LIST.filter(c => Learn.rec(save, c.k).box >= 2 && Learn.learned(save, c)).length;

  function welcome() {
    showOverlay('welcome', '<div class="tag" style="color:var(--green);font:500 10px var(--mono);letter-spacing:.2em">APPRENDS VIM EN LE PRATIQUANT</div><h2>Zéro manuel.</h2>' +
      '<p>À chaque défi, regarde l’<b>objectif</b> à droite et fais-le dans l’éditeur à gauche.<br>La première fois, les touches s’allument une par une. Ensuite, les aides disparaissent et tu fais tout seul.</p>' +
      '<p>L’explication de chaque commande arrive <b>après</b> que tu l’as faite.</p>' +
      '<div class="row"><button class="btn" id="o-start">COMMENCER <kbd class="kbd">Entrée</kbd></button></div>');
  }

  function summary() {
    S.view = 'summary';
    const learnedN = Learn.LIST.filter(c => Learn.learned(save, c)).length;
    showOverlay('summary', '<div class="tag" style="color:var(--green);font:500 10px var(--mono);letter-spacing:.2em">SESSION TERMINÉE</div><h2>' + SESSION + ' défis réussis</h2>' +
      '<div class="results"><div><span>XP GAGNÉS</span><b>+' + S.session.xp + '</b></div><div><span>COMMANDES APPRISES</span><b>' + learnedN + '/' + Learn.LIST.length + '</b></div><div><span>MAÎTRISÉES</span><b>' + mastered() + '</b></div></div>' +
      '<p>Série en cours : <b>' + save.streak + '</b> · meilleure série : <b>' + save.bestStreak + '</b></p>' +
      '<div class="row"><button class="btn" id="o-again">NOUVELLE SESSION <kbd class="kbd">Entrée</kbd></button><button class="btn ghost" id="o-map">CARTE</button></div>');
  }

  function openMap() {
    const rec = c => Learn.rec(save, c.k);
    const state = c => (rec(c).seen === 0 ? '' : rec(c).box >= 4 ? 'master' : rec(c).box >= 2 && Learn.learned(save, c) ? 'good' : 'learning');
    const groups = Learn.GROUP_ORDER.map(g => '<div><h3>' + esc(GROUPS[g].title) + '</h3><div class="tiles">' +
      Learn.LIST.filter(c => c.group === g).map(c => '<button class="tile ' + state(c) + '" data-c="' + esc(c.k) + '">' + esc(c.k) + '<small>' + esc(c.d) + '</small></button>').join('') + '</div></div>').join('');
    showOverlay('map', '<h2>Carte des commandes</h2><p>Clique une commande pour la pratiquer tout de suite.</p><div class="map">' + groups + '</div>' +
      '<div class="legend"><span>⬜ à découvrir</span><span style="color:#d9a24c">■ en apprentissage</span><span style="color:#6fbf86">■ acquise</span><span style="color:var(--gold)">■ maîtrisée</span></div>' +
      '<div class="row"><button class="btn ghost" id="o-close">FERMER <kbd class="kbd">Échap</kbd></button><button class="btn ghost" id="o-reset">Effacer ma progression</button></div>');
  }

  overlay.addEventListener('click', ev => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.dataset.c) { closeOverlay(); S.session.n = Math.min(S.session.n, SESSION - 1); return startChallenge(t.dataset.c); }
    ({ 'o-start': () => startChallenge(), 'o-again': () => { S.session = { n: 0, xp: 0, start: 0 }; startChallenge(); }, 'o-map': openMap,
      'o-close': () => { closeOverlay(); if (S.view === 'summary') summary(); },
      'o-reset': () => { if (confirm('Effacer toute ta progression ?')) { save = Learn.newSave(); persist(); S.session = { n: 0, xp: 0, start: 0 }; startChallenge(); } } }[t.id] || (() => {}))();
  });
  $('#b-map').addEventListener('click', openMap);
  $('#b-reset').addEventListener('click', () => { if (S.view === 'challenge') resetBuffer(); document.activeElement.blur(); });
  $('#b-hint').addEventListener('click', () => { giveHint(); document.activeElement.blur(); });
  $('#feedback').addEventListener('click', ev => { if (ev.target.closest('#b-next')) next(); });

  // ---------- clavier ----------
  window.addEventListener('keydown', ev => {
    if (ev.metaKey || ev.isComposing || ev.key === 'Dead') return;
    const altGr = ev.getModifierState && ev.getModifierState('AltGraph');
    if (!altGr && (ev.ctrlKey || ev.altKey)) return;
    const key = ev.key;
    if (S.overlay) {
      if (key === 'Enter') {
        ev.preventDefault();
        const primary = { welcome: 'o-start', summary: 'o-again' }[S.overlay];
        if (primary) overlay.querySelector('#' + primary).click();
      } else if (key === 'Escape' && S.overlay === 'map') { ev.preventDefault(); overlay.querySelector('#o-close').click(); }
      return;
    }
    if (S.view === 'feedback') {
      if ((key === 'Enter' || key === ' ') && Date.now() - S.fbAt > 350) { ev.preventDefault(); next(); }
      return;
    }
    if (S.view !== 'challenge') return;
    if (key === 'Tab') { ev.preventDefault(); resetBuffer(); return; }
    const tok = key.length === 1 ? key : key === 'Escape' || key === 'Enter' || key === 'Backspace' ? key : null;
    if (!tok) return;
    ev.preventDefault();
    press(tok);
  });

  // Aide douce : si tu hésites longtemps, on te propose (ou on affiche) les touches.
  setInterval(() => {
    if (S.view !== 'challenge' || S.reveal || S.overlay) return;
    const idle = Date.now() - S.lastKey;
    if (S.mode === 1 && idle > 6000) giveHint();
    else if (S.mode === 2 && idle > 10000) $('#coach').innerHTML = '<span class="idle ask">Bloqué ? Clique sur « 💡 Je suis bloqué » en haut à droite.</span>';
  }, 500);

  window.__dojo = { S, save: () => save, press, startChallenge };
  renderHud();
  if (save.done === 0) { startChallenge(); welcome(); } else startChallenge();
})();
