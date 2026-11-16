// Vim Quest Arcade : des fragments de code tombent, tape la commande Vim qui les transforme.
(() => {
  'use strict';
  const { GROUPS, COMMANDS } = window.DRILLS_DATA;
  const $ = s => document.querySelector(s);
  const arena = $('#arena'), layer = $('#enemies'), fx = $('#fx'), screen = $('#screen');
  const typedEl = $('#typed'), bar = $('#inputbar'), badge = $('#mode-badge'), msg = $('#msg');
  const BASE = 34, MAX_LIVES = 5, STORE = 'vim-arcade-v1';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- sauvegarde ----------
  let save = { best: 0, bestWave: 0, stats: {}, mute: false };
  try { save = { ...save, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { /* stockage indisponible */ }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch { /* ignoré */ } };
  const stat = id => save.stats[id] || (save.stats[id] = { ok: 0, miss: 0 });

  // ---------- état ----------
  const S = { screen: 'menu', practice: null, wave: 0, score: 0, combo: 0, maxCombo: 0, lives: MAX_LIVES, enemies: [], typed: [],
    spawned: 0, total: 0, spawnT: 0, kills: 0, keys: 0, bad: 0, runMiss: {}, unlocked: 0, shown: -1, last: null, nextId: 1, waveKills: 0 };
  let W = 0, H = 0, lanes = 3, lastTime = 0;

  // ---------- son ----------
  let actx = null;
  function beep(freq, dur = 0.09, type = 'square', gain = 0.04, slide = 0) {
    if (save.mute) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.linearRampToValueAtTime(freq + slide, actx.currentTime + dur);
      g.gain.setValueAtTime(gain, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch { /* pas d'audio */ }
  }
  const sfx = {
    ok: () => { beep(660, 0.07, 'triangle', 0.06); setTimeout(() => beep(990, 0.1, 'triangle', 0.06), 60); },
    key: () => beep(420, 0.03, 'square', 0.015),
    err: () => beep(150, 0.14, 'sawtooth', 0.05, -60),
    miss: () => beep(110, 0.35, 'sawtooth', 0.07, -70),
    wave: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.06), i * 90))
  };

  // ---------- rendu des tampons ----------
  const KEY_LABEL = { Escape: 'Échap', ' ': '␣', Enter: '⏎', Backspace: '⌫' };
  const label = t => KEY_LABEL[t] || t;
  function bufHTML(lines, cur) {
    return lines.map((l, r) => {
      const body = r === cur[0] ? esc(l.slice(0, cur[1])) + '<i class="cur">' + esc(l[cur[1]] || ' ') + '</i>' + esc(l.slice(cur[1] + 1)) : esc(l);
      return '<div class="ln">' + (body || ' ') + '</div>';
    }).join('');
  }
  const keysHTML = (tokens, done = 0) => tokens.map((t, i) => '<span class="kbd' + (i < done ? ' ok' : '') + '">' + esc(label(t)) + '</span>').join('');

  // ---------- sélection des exercices ----------
  const seqsOf = d => [d.keys, ...d.alts].map(Vim.tokenize);
  const isStrictPrefix = (a, b) => a.length < b.length && a.every((t, i) => t === b[i]);
  const conflicts = (A, B) => A.some(a => B.some(b => isStrictPrefix(a, b) || isStrictPrefix(b, a)));
  const pool = () => COMMANDS.filter(c => (S.practice !== null ? c.group === S.practice : c.group <= S.unlocked));

  function pickDrill() {
    const cmds = pool(), newest = S.practice !== null ? S.practice : S.unlocked;
    const weight = c => {
      const st = stat(c.k), tries = st.ok + st.miss;
      let w = 1 + 3 * (tries ? st.miss / tries : 0);
      if (st.ok < 3) w += 1.5;
      if (c.group === newest) w *= 2.5;
      if (S.last === c.k) w *= 0.15;
      return w;
    };
    for (let attempt = 0; attempt < 14; attempt++) {
      let r = Math.random() * cmds.reduce((a, c) => a + weight(c), 0), cmd = cmds[0];
      for (const c of cmds) { r -= weight(c); if (r <= 0) { cmd = c; break; } }
      const drill = cmd.drills[Math.floor(Math.random() * cmd.drills.length)];
      const seqs = seqsOf(drill);
      if (S.enemies.every(e => !conflicts(seqs, e.seqs))) return { cmd, drill, seqs };
    }
    return null;
  }

  // ---------- ennemis ----------
  const speedFor = w => 15 + 2.3 * Math.min(w, 14);
  const intervalFor = w => Math.max(1.3, 3.0 - 0.17 * w);
  const sizeFor = w => (S.practice !== null ? 10 : Math.min(22, 5 + w));

  function spawn() {
    const pick = pickDrill();
    if (!pick) return false;
    const { cmd, drill, seqs } = pick;
    const el = document.createElement('div');
    el.className = 'enemy';
    el.style.width = Math.floor(W / lanes - 16) + 'px';
    el.innerHTML = '<div class="e-head"><span>' + esc(cmd.d) + '</span><span class="e-mode" hidden></span></div>' +
      '<div class="e-before"></div><div class="e-arrow">▼</div><div class="e-after">' + bufHTML(drill.after.lines, drill.after.cur) + '</div><div class="e-keys"></div>';
    layer.appendChild(el);
    const h = el.offsetHeight;
    const free = [];
    for (let l = 0; l < lanes; l++) if (S.enemies.every(e => e.lane !== l || e.y > 8)) free.push(l);
    if (!free.length) { el.remove(); return false; }
    const e = { id: S.nextId++, el, cmd, drill, seqs, tokens: seqs[0], lane: free[Math.floor(Math.random() * free.length)], y: -h - 6, h, showKeys: false, dead: false };
    e.x = e.lane * (W / lanes) + 8;
    e.el.querySelector('.e-before').innerHTML = bufHTML(drill.lines, drill.cur);
    S.enemies.push(e);
    S.last = cmd.k;
    S.spawned++;
    place(e);
    return true;
  }
  const place = e => { e.el.style.transform = 'translate3d(' + e.x + 'px,' + e.y + 'px,0)'; };

  function renderKeys(e, done) {
    const box = e.el.querySelector('.e-keys');
    box.innerHTML = e.showKeys ? keysHTML(e.tokens, done) : '<span class="dots">· · ·</span>';
  }

  // ---------- saisie ----------
  const matching = seq => {
    const out = [];
    for (const e of S.enemies) {
      if (e.dead) continue;
      const hit = e.seqs.find(s => seq.length <= s.length && seq.every((t, i) => t === s[i]));
      if (hit) out.push({ e, full: hit.length === seq.length, seq: hit });
    }
    return out.sort((a, b) => b.e.y - a.e.y);
  };

  function press(tok) {
    S.keys++;
    let seq = [...S.typed, tok], cands = matching(seq);
    if (!cands.length && S.typed.length) { seq = [tok]; cands = matching(seq); }
    if (!cands.length) {
      S.bad++; S.combo = 0; S.typed = [];
      flash('err'); sfx.err(); say('Aucune cible ne commence par cette touche');
      refresh();
      return;
    }
    S.typed = seq;
    const done = cands.find(c => c.full);
    if (done) { kill(done.e); return; }
    sfx.key();
    refresh();
  }

  function kill(e) {
    S.typed = [];
    e.dead = true;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.kills++; S.waveKills++;
    const mult = Math.min(5, 1 + Math.floor(S.combo / 4));
    const pts = (10 + 5 * e.tokens.length) * mult;
    S.score += pts;
    stat(e.cmd.k).ok++;
    popup('+' + pts, e.x + 10, e.y);
    e.el.classList.add('dead', 'win');
    setTimeout(() => e.el.remove(), 380);
    S.enemies = S.enemies.filter(x => x !== e);
    sfx.ok(); flash('ok');
    refresh();
  }

  function lose(e) {
    e.dead = true;
    S.lives--; S.combo = 0; S.typed = [];
    stat(e.cmd.k).miss++;
    S.runMiss[e.cmd.k] = (S.runMiss[e.cmd.k] || 0) + 1;
    e.el.classList.add('dead', 'lose');
    setTimeout(() => e.el.remove(), 380);
    S.enemies = S.enemies.filter(x => x !== e);
    arena.classList.remove('hit'); void arena.offsetWidth; arena.classList.add('hit');
    const a = document.createElement('div');
    a.className = 'pop'; a.style.color = '#ff9a9a'; a.style.left = Math.max(8, e.x) + 'px'; a.style.bottom = BASE + 6 + 'px';
    a.style.fontSize = '13px';
    a.textContent = 'Il fallait : ' + e.drill.keys.replace(/<Esc>/g, 'Échap ');
    fx.appendChild(a); setTimeout(() => a.remove(), 1300);
    sfx.miss();
    refresh();
    if (S.lives <= 0) gameOver();
  }

  function popup(text, x, y) {
    const p = document.createElement('div');
    p.className = 'pop'; p.textContent = text; p.style.left = x + 'px'; p.style.top = Math.max(4, y) + 'px';
    fx.appendChild(p); setTimeout(() => p.remove(), 900);
  }
  function flash(cls) { bar.classList.remove('err', 'ok'); void bar.offsetWidth; bar.classList.add(cls); setTimeout(() => bar.classList.remove(cls), 220); }
  let msgTimer;
  function say(t) { msg.textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => (msg.textContent = ''), 1800); }

  // ---------- affichage ----------
  function refresh() {
    $('#h-score').textContent = S.score;
    $('#h-wave').textContent = S.wave ? (S.practice !== null ? '∞ ' + S.wave : S.wave) : '–';
    const mult = Math.min(5, 1 + Math.floor(S.combo / 4));
    const combo = $('#h-combo');
    combo.textContent = '×' + mult + (S.combo ? ' · ' + S.combo : '');
    combo.classList.toggle('hot', mult > 1);
    $('#h-lives').textContent = S.practice !== null ? '∞' : '♥'.repeat(Math.max(0, S.lives)) + '♡'.repeat(Math.max(0, MAX_LIVES - S.lives));

    const cands = S.typed.length ? matching(S.typed) : [];
    const target = cands[0] && cands[0].e;
    for (const e of S.enemies) {
      const isT = e === target;
      e.el.classList.toggle('target', isT);
      if (isT) e.tokens = cands[0].seq;
      renderKeys(e, isT ? S.typed.length : 0);
      const modeEl = e.el.querySelector('.e-mode');
      let live = e.drill.lines, cur = e.drill.cur, mode = 'n';
      if (isT) {
        const v = Vim.feed(Vim.create(e.drill.lines, e.drill.cur), '');
        S.typed.forEach(t => Vim.key(v, t));
        live = v.lines; cur = [v.row, v.col]; mode = v.mode;
      }
      e.el.querySelector('.e-before').innerHTML = bufHTML(live, cur);
      modeEl.hidden = !isT || mode === 'n';
      modeEl.textContent = mode === 'i' ? 'INSERTION' : mode === 'v' ? 'VISUEL' : '';
      modeEl.classList.toggle('ins', mode === 'i');
    }
    let mode = 'n';
    if (target && S.typed.length) {
      const v = Vim.create(target.drill.lines, target.drill.cur);
      S.typed.forEach(t => Vim.key(v, t));
      mode = v.mode;
    }
    badge.textContent = mode === 'i' ? 'INSERTION' : mode === 'v' ? 'VISUEL' : 'NORMAL';
    badge.classList.toggle('ins', mode === 'i');
    typedEl.innerHTML = S.typed.length ? keysHTML(S.typed) : '<span class="placeholder">Tape directement les touches Vim — Échap annule ta saisie</span>';
  }

  function measure() {
    W = arena.clientWidth; H = arena.clientHeight;
    lanes = W < 600 ? 2 : 3;
  }

  // ---------- écrans ----------
  function show(html) { screen.innerHTML = html; screen.classList.add('show'); }
  function hide() { screen.classList.remove('show'); screen.innerHTML = ''; }
  const btn = (id, text, hint, ghost) => '<button class="btn' + (ghost ? ' ghost' : '') + '" id="' + id + '">' + text + (hint ? ' <span class="kbd">' + hint + '</span>' : '') + '</button>';

  function menu() {
    S.screen = 'menu'; S.enemies.forEach(e => e.el.remove()); S.enemies = []; S.typed = []; S.wave = 0; S.practice = null;
    refresh();
    show('<div class="card"><div class="tag">APPRENDS VIM EN JOUANT</div><h1>VIM QUEST ARCADE</h1>' +
      '<p>Des morceaux de code tombent. Tape la commande Vim qui les transforme comme le montre la flèche ▼, avant qu’ils touchent ta base.</p>' +
      '<div class="how"><div><b>1.</b> Lis la carte : le code du haut devient celui du bas.</div>' +
      '<div><b>2.</b> Tape les touches directement, comme dans Neovim. Pas d’Entrée.</div>' +
      '<div><b>3.</b> Le premier exemple de chaque commande affiche les touches ; ensuite, à toi de jouer. <kbd>Échap</kbd> annule ta saisie.</div></div>' +
      '<div class="row">' + btn('go', 'JOUER', 'Entrée') + '</div>' +
      '<div class="tag" style="margin-top:20px">OU ENTRAÎNE-TOI SUR UN THÈME (SANS VIES)</div>' +
      '<div class="chips">' + GROUPS.map((g, i) => '<button class="chip" data-g="' + i + '">' + (i + 1) + '. ' + esc(g.title) + '</button>').join('') + '</div>' +
      '<div class="best">RECORD ' + save.best + ' · VAGUE ' + save.bestWave + '</div>' +
      '<p class="link"><a href="index.html" style="color:inherit">← Retour à l’entraînement</a> · <a href="campagne.html" style="color:inherit">Campagne classique</a></p></div>');
  }

  function intro(gi, then) {
    S.screen = 'intro';
    const g = GROUPS[gi];
    const rows = g.cmds.map(c => {
      const d = c.drills[0];
      return '<div class="skill"><div class="k">' + keysHTML(Vim.tokenize(d.keys)) + '</div><div class="d">' + esc(c.d) + '</div>' +
        '<div class="mini"><pre>' + esc(d.lines.join('\n')) + '</pre><span>▶</span><pre class="after">' + esc(d.after.lines.join('\n')) + '</pre></div></div>';
    }).join('');
    show('<div class="card"><div class="tag">NOUVELLE COMPÉTENCE · ' + (gi + 1) + '/' + GROUPS.length + '</div><h2>' + esc(g.title) + '</h2><p>' + esc(g.blurb) + '</p>' +
      '<div class="skills">' + rows + '</div><div class="row">' + btn('start', 'COMMENCER', 'Entrée') + '</div></div>');
    intro.then = then;
  }

  function pause() {
    if (S.screen !== 'play') return;
    S.screen = 'pause';
    show('<div class="card"><div class="tag">EN PAUSE</div><h2>Reprends ton souffle</h2><div class="row">' + btn('resume', 'REPRENDRE', 'Entrée') + btn('quit', 'MENU', 'M', true) + '</div></div>');
  }
  function resume() { if (S.screen !== 'pause') return; hide(); S.screen = 'play'; lastTime = 0; }

  function waveClear() {
    S.screen = 'clear';
    sfx.wave();
    const bonus = 50 * S.wave;
    S.score += bonus;
    if (S.practice === null && S.lives < MAX_LIVES) S.lives++;
    refresh();
    const next = S.wave + 1, newGroup = S.practice === null && next - 1 > S.unlocked && next - 1 < GROUPS.length;
    show('<div class="card"><div class="tag">VAGUE ' + S.wave + ' TERMINÉE</div><h2>Bien joué !</h2>' +
      '<p>Bonus de vague <b class="new">+' + bonus + '</b>' + (S.practice === null ? ' · une vie regagnée' : '') + '.</p>' +
      (newGroup ? '<p>Prochaine vague : <b>' + esc(GROUPS[next - 1].title) + '</b></p>' : '') +
      '<div class="row">' + btn('next', 'VAGUE SUIVANTE', 'Entrée') + '</div></div>');
  }

  function gameOver() {
    S.screen = 'over';
    const record = S.practice === null && S.score > save.best;
    if (S.practice === null) { if (record) save.best = S.score; save.bestWave = Math.max(save.bestWave, S.wave); }
    persist();
    const acc = S.keys ? Math.round(100 * (S.keys - S.bad) / S.keys) : 100;
    const review = Object.entries(S.runMiss).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => {
      const c = COMMANDS.find(x => x.k === id);
      return '<div>' + keysHTML(Vim.tokenize(c.drills[0].keys)) + '<span>' + esc(c.d) + '</span></div>';
    }).join('');
    show('<div class="card"><div class="tag">PARTIE TERMINÉE</div><h1>Ta base est tombée</h1>' + (record ? '<p class="new">★ Nouveau record !</p>' : '') +
      '<div class="results"><div><span>SCORE</span><b>' + S.score + '</b></div><div><span>VAGUE</span><b>' + S.wave + '</b></div><div><span>PRÉCISION</span><b>' + acc + '%</b></div>' +
      '<div><span>CODES RÉUSSIS</span><b>' + S.kills + '</b></div><div><span>MEILLEUR COMBO</span><b>' + S.maxCombo + '</b></div><div><span>RECORD</span><b>' + save.best + '</b></div></div>' +
      (review ? '<div class="tag">À RÉVISER</div><div class="review">' + review + '</div>' : '') +
      '<div class="row">' + btn('again', 'REJOUER', 'Entrée') + btn('quit', 'MENU', 'M', true) + '</div></div>');
  }

  // ---------- déroulement ----------
  function newGame(practice) {
    S.enemies.forEach(e => e.el.remove()); S.enemies = []; S.typed = [];
    Object.assign(S, { practice, wave: 0, score: 0, combo: 0, maxCombo: 0, lives: MAX_LIVES, kills: 0, keys: 0, bad: 0, runMiss: {}, unlocked: practice !== null ? practice : 0, shown: -1, last: null });
    startWave(1);
  }

  function startWave(n) {
    measure();
    S.wave = n; S.spawned = 0; S.waveKills = 0; S.total = sizeFor(n); S.spawnT = 0.6;
    if (S.practice === null) S.unlocked = Math.min(n - 1, GROUPS.length - 1);
    const gi = S.practice !== null ? S.practice : S.unlocked;
    const begin = () => { hide(); S.screen = 'play'; lastTime = 0; refresh(); };
    if (S.shown !== gi && (S.practice !== null || n - 1 < GROUPS.length)) { S.shown = gi; refresh(); intro(gi, begin); }
    else begin();
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (S.screen !== 'play') { lastTime = 0; return; }
    if (!lastTime) lastTime = t;
    const dt = Math.min(0.05, (t - lastTime) / 1000);
    lastTime = t;
    const speed = speedFor(S.practice !== null ? Math.floor((S.wave - 1) / 1) + 1 : S.wave);
    for (const e of S.enemies.slice()) {
      e.y += speed * dt;
      if (!e.showKeys && (stat(e.cmd.k).ok < 3 || e.y + e.h > H * 0.5)) { e.showKeys = true; renderKeys(e, 0); }
      place(e);
      if (e.y + e.h >= H - BASE) { lose(e); if (S.screen !== 'play') return; }
    }
    if (S.spawned < S.total) {
      S.spawnT -= dt;
      if (S.spawnT <= 0 && spawn()) S.spawnT = intervalFor(S.wave) * (0.8 + Math.random() * 0.4);
      else if (S.spawnT <= 0) S.spawnT = 0.25;
    } else if (!S.enemies.length) {
      if (S.practice !== null) { const n = S.wave + 1; S.wave = n; S.spawned = 0; S.total = sizeFor(n); S.spawnT = 0.8; refresh(); }
      else { persist(); waveClear(); }
    }
  }

  // ---------- clavier ----------
  window.addEventListener('keydown', ev => {
    if (ev.metaKey || ev.isComposing || ev.key === 'Dead') return;
    const altGr = ev.getModifierState && ev.getModifierState('AltGraph');
    if (!altGr && (ev.ctrlKey || ev.altKey)) return;
    const key = ev.key;
    const go = fn => { ev.preventDefault(); fn(); };
    switch (S.screen) {
      case 'menu': if (key === 'Enter') go(() => newGame(null)); return;
      case 'intro': if (key === 'Enter') go(() => intro.then()); return;
      case 'clear': if (key === 'Enter') go(() => startWave(S.wave + 1)); return;
      case 'over': if (key === 'Enter') go(() => newGame(S.practice)); else if (key.toLowerCase() === 'm') go(menu); return;
      case 'pause': if (key === 'Enter' || key === 'Escape') go(resume); else if (key.toLowerCase() === 'm') go(menu); return;
      case 'play': {
        if (key === 'Escape') { go(() => { if (S.typed.length) { S.typed = []; refresh(); } else pause(); }); return; }
        if (key === 'Backspace') { go(() => { S.typed.pop(); refresh(); }); return; }
        const tok = key.length === 1 ? key : null;
        if (tok) go(() => press(tok));
      }
    }
  });

  screen.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.g) return newGame(Number(b.dataset.g));
    const act = { go: () => newGame(null), start: () => intro.then(), next: () => startWave(S.wave + 1), again: () => newGame(S.practice), resume, quit: menu }[b.id];
    if (act) act();
  });
  $('#b-pause').addEventListener('click', () => (S.screen === 'pause' ? resume() : pause()));
  const soundBtn = $('#b-sound');
  const showSound = () => (soundBtn.textContent = save.mute ? '🔇' : '🔊');
  soundBtn.addEventListener('click', () => { save.mute = !save.mute; persist(); showSound(); soundBtn.blur(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  window.addEventListener('resize', measure);

  window.__arcade = { S, press, matching, startWave, newGame };
  measure(); showSound(); refresh(); menu();
  requestAnimationFrame(tick);
})();
