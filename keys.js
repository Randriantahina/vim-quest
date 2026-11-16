// Saisie « Vim réel » : chaque touche est captée directement, sans champ de texte ni Entrée.
// Ce fichier ne contient que l'interprétation du clavier ; les règles du jeu restent dans game.js.
(() => {
  const bar = document.querySelector('.command-bar');
  const label = $('#bar-label');
  const success = $('#success');
  const hintBox = $('#hint-box');
  let pending = '';      // touches du mode normal en attente (ex : « d », « 3 », « ci »)
  let cmdline = null;    // contenu de la ligne de commande « : » ou « / » (null = fermée)
  let finished = false;  // l'écran « Étage réussi » est affiché
  let demo = false;      // une démonstration de la solution est en cours
  let hintStage = 0;     // 0 = rien, 1 = indice, 2 = solution

  const level = () => levels[index];
  const editorCtx = () => Boolean(editorState && level().challenge && !unlocked);
  const lineCtx = () => Boolean(level().challenge && !editorState && !unlocked);
  const textMode = () => editorCtx() && ['INSERT', 'REPLACE'].includes(editorState.mode);

  // Une commande du mode normal est-elle complète ? (sinon on attend la touche suivante)
  function isComplete(p) {
    const rest = p.replace(/^[1-9]\d*/, '');
    if (!rest) return false;
    const c = rest[0];
    const visual = editorState && /VISUAL/.test(editorState.mode);
    if ('fFtTrm`\'@g'.includes(c)) return rest.length >= 2;
    if (c === 'q') return editorState && editorState.recording ? true : rest.length >= 2;
    if (c === '"') {
      if (rest.length < 3) return false;
      const op = rest.slice(2);
      return 'ydc'.includes(op[0]) ? op.length >= 2 : true;
    }
    if ('dcy<>'.includes(c) && !visual) {
      if (rest.length < 2) return false;
      if (rest[1] === c) return true;
      if ('ia'.includes(rest[1]) && 'dcy'.includes(c)) return rest.length >= 3;
      return true;
    }
    return true;
  }

  function refreshBar() {
    let text = 'MODE NORMAL', value = pending, cls = '';
    if (cmdline !== null) {
      text = 'LIGNE DE COMMANDE · Entrée valide · Échap annule';
      value = cmdline + '▏';
      cls = ' cmdline';
    } else if (textMode()) {
      text = (editorState.mode === 'INSERT' ? 'MODE INSERTION' : 'MODE REMPLACEMENT') + ' · écris ton texte · Échap pour finir';
      value = '';
      cls = ' insert';
    } else {
      const mode = editorCtx() ? editorState.mode : 'NORMAL';
      text = 'MODE ' + mode + (pending ? ' · touches en attente' : '');
      if (pending) cls = ' pending';
    }
    label.textContent = text;
    input.value = value;
    bar.className = 'command-bar card' + cls;
  }

  function dispatch(cmd) {
    if (finished) return;
    const before = unlocked, at = index, challenge = level().challenge;
    runWithCount(cmd);
    if (challenge && index === at && !before && unlocked) showSuccess();
    refreshBar();
  }

  // Compteurs que le moteur ne gère pas lui-même : 3dd, 2x, 4w, 5G…
  const repeatable = new Set(['w', 'b', 'e', 'x', 'X', 'dd', 'dw', 'de', 'diw', 'daw', 'J', '>>', '<<', 'p', 'P', 'u', '.', 'n', 'N', ';', ',', 'Ctrl-r']);
  function runWithCount(cmd) {
    const m = editorCtx() && /^([1-9]\d*)(.+)$/.exec(cmd);
    if (m && !/^[hjkl]$/.test(m[2])) {
      const n = Math.min(Number(m[1]), 99), base = m[2];
      if (base === 'G' || base === 'gg') {
        run(base);
        editorState.row = Math.min(n, editorState.lines.length) - 1; clampCursor(); renderEditor(); evaluateEditor();
        return;
      }
      if (repeatable.has(base)) { for (let i = 0; i < n; i++) run(base); return; }
    }
    run(cmd);
  }

  function showSuccess() {
    finished = true;
    pending = '';
    cmdline = null;
    $('#success-text').textContent = index + 1 >= levels.length ? 'Tu as terminé tout le donjon !' : 'Technique maîtrisée. Prêt pour la suivante ?';
    success.hidden = false;
    refreshBar();
  }

  function goNext() {
    finished = false;
    success.hidden = true;
    advance();
    refreshBar();
  }

  // Notation <Esc>, <CR>, <C-x> → liste de touches
  function tokenize(seq) {
    return (seq.match(/<[A-Za-z]+(?:-.)?>|[\s\S]/g) || []).map(t => {
      const named = { '<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace' }[t];
      if (named) return { key: named };
      const ctrl = /^<C-(.)>$/.exec(t);
      if (ctrl) return { key: ctrl[1], ctrlKey: true };
      return { key: t };
    });
  }
  const pretty = seq => escapeHtml(seq).replace(/&lt;CR&gt;/g, '⏎').replace(/&lt;Esc&gt;/g, 'Échap').replace(/&lt;C-(.)&gt;/g, 'Ctrl-$1').replace(/&lt;BS&gt;/g, '⌫');

  // 1er appui : indice. 2e appui : solution complète. 3e : on referme.
  function showHint() {
    if (demo) return;
    const l = level();
    if (hintStage >= (l.solution ? 2 : 1)) { hintStage = 0; hintBox.hidden = true; return; }
    hintStage++;
    hintBox.hidden = false;
    hintBox.innerHTML = hintStage === 1
      ? '💡 <b>Indice</b> : ' + escapeHtml(l.tip) + (l.solution ? ' <small>(clique encore pour voir la solution)</small>' : '')
      : '🔑 <b>Solution</b> : <kbd>' + pretty(l.solution) + '</kbd> <button class="mini-button" id="demo-button">▶ LA VOIR EN ACTION</button>';
    const demoButton = $('#demo-button');
    if (demoButton) demoButton.addEventListener('click', playSolution);
  }

  // Rejoue la solution touche par touche, pour voir exactement quoi taper.
  function playSolution() {
    const l = level();
    if (demo || !l.solution || !l.editor) return;
    startLevel();
    demo = true;
    hintBox.hidden = false;
    hintBox.innerHTML = '▶ Démonstration : <kbd>' + pretty(l.solution) + '</kbd>';
    const keys = tokenize(l.solution);
    let i = 0;
    const step = () => {
      if (index !== keys.demoIndex) { demo = false; return; }
      if (i >= keys.length) { demo = false; return; }
      const k = keys[i++];
      // Ctrl-w : le navigateur le réserve, le jeu accepte Alt-w à la place
      const ctrlW = k.ctrlKey && k.key === 'w';
      onKey({ demo: true, key: k.key, ctrlKey: ctrlW ? false : Boolean(k.ctrlKey), altKey: ctrlW, getModifierState: () => false, preventDefault() {} });
      setTimeout(step, 450);
    };
    keys.demoIndex = index;
    setTimeout(step, 600);
  }

  function onLevelStart() {
    pending = '';
    cmdline = null;
    finished = false;
    success.hidden = true;
    hintBox.hidden = true;
    hintStage = 0;
    demo = false;
    input.blur();
    refreshBar();
  }

  // game.js appelle startLevel() depuis advance(), le menu des étages, etc. : on se branche dessus.
  const baseStartLevel = startLevel;
  startLevel = function () { baseStartLevel(); onLevelStart(); };

  function onKey(ev) {
    if (demo && !ev.demo) return;
    if (ev.metaKey || ev.isComposing || ev.key === 'Dead' || ev.key === 'Process') return;
    const key = ev.key;

    if (!$('#level-menu').hidden) {
      if (key === 'Escape') { $('#level-menu').hidden = true; $('#levels-button').setAttribute('aria-expanded', 'false'); }
      return;
    }
    const tag = document.activeElement && document.activeElement.tagName;
    if ((key === 'Enter' || key === ' ') && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return;

    if (finished) {
      if (key === 'Enter') { ev.preventDefault(); goNext(); }
      return;
    }
    if (key === 'F1') { ev.preventDefault(); showHint(); return; }

    // Ctrl-… (AltGr des claviers AZERTY n'est pas un Ctrl : il sert à taper { [ ] ` | …)
    const altGr = ev.getModifierState && ev.getModifierState('AltGraph');
    if (!altGr && (ev.ctrlKey || ev.altKey)) {
      const k = key.toLowerCase();
      if (!editorCtx() || textMode() || cmdline !== null) return;
      const ctrl = { r: 'Ctrl-r', d: 'Ctrl-d', u: 'Ctrl-u', f: 'Ctrl-f', b: 'Ctrl-b', o: 'Ctrl-o', i: 'Ctrl-i' };
      if (k === 'w') {            // Ctrl-w est réservé par le navigateur : Alt-w fonctionne aussi
        ev.preventDefault(); pending = 'Ctrl-w'; refreshBar();
      } else if (ev.ctrlKey && !ev.altKey && ctrl[k]) {
        ev.preventDefault(); pending = ''; dispatch(ctrl[k]);
      }
      return;
    }

    // Mode insertion / remplacement : tout ce qu'on tape est du texte
    if (textMode()) {
      ev.preventDefault();
      if (key === 'Escape') dispatch('<Esc>');
      else if (key === 'Backspace') dispatch('BACKSPACE');
      else if (key === 'Enter') { if (editorState.mode === 'INSERT') dispatch('\n'); }
      else if (key === 'Tab') { if (editorState.mode === 'INSERT') dispatch('  '); }
      else if (key.length === 1) dispatch(key);
      return;
    }

    // Ligne de commande « : » ou « / »
    if (cmdline !== null) {
      ev.preventDefault();
      if (key === 'Escape') cmdline = null;
      else if (key === 'Enter') { const c = cmdline; cmdline = null; dispatch(c); return; }
      else if (key === 'Backspace') cmdline = cmdline.length > 1 ? cmdline.slice(0, -1) : null;
      else if (key.length === 1) cmdline += key;
      refreshBar();
      return;
    }

    // Défi à réponse libre (rare) : on tape la commande puis Entrée
    if (lineCtx()) {
      if (key === 'Enter') { ev.preventDefault(); const c = pending; pending = ''; dispatch(c); }
      else if (key === 'Backspace') { pending = pending.slice(0, -1); refreshBar(); }
      else if (key.length === 1) { ev.preventDefault(); pending += key; refreshBar(); }
      return;
    }

    // Mode normal
    if (key === 'Escape') {
      ev.preventDefault();
      pending = '';
      if (editorCtx() && editorState.mode !== 'NORMAL') dispatch('<Esc>'); else refreshBar();
      return;
    }
    if (key === 'Backspace') { ev.preventDefault(); pending = pending.slice(0, -1); refreshBar(); return; }
    if (key === 'Tab' && editorCtx() && !pending) { ev.preventDefault(); dispatch('Ctrl-i'); return; }
    if (key.length !== 1) return;
    ev.preventDefault();

    if (editorCtx() && !pending && (key === ':' || key === '/' || key === '?')) { cmdline = key; refreshBar(); return; }
    if (!editorCtx() && key === '?') { showHint(); return; }

    if (pending === 'Ctrl-w') { pending = ''; dispatch('Ctrl-w ' + key); return; }
    pending += key;
    if (isComplete(pending)) { const cmd = pending; pending = ''; dispatch(cmd); }
    else refreshBar();
  }
  window.addEventListener('keydown', onKey);

  $('#hint-button').addEventListener('click', showHint);
  $('#retry-button').addEventListener('click', () => { startLevel(); toast('Étage remis à zéro'); });
  $('#next-button').addEventListener('click', () => { if (finished) goNext(); });
  document.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (button && !button.closest('.level-picker')) setTimeout(() => button.blur());
  });

  onLevelStart();
})();
