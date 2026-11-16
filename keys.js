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
    run(cmd);
    if (challenge && index === at && !before && unlocked) showSuccess();
    refreshBar();
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

  function showHint() {
    hintBox.hidden = !hintBox.hidden && hintBox.dataset.level === String(index);
    if (hintBox.hidden) return;
    hintBox.dataset.level = String(index);
    hintBox.innerHTML = '💡 <b>Indice</b> : ' + escapeHtml(level().tip) + (level().hint ? ' → <kbd>' + escapeHtml(level().hint) + '</kbd>' : '');
  }

  function onLevelStart() {
    pending = '';
    cmdline = null;
    finished = false;
    success.hidden = true;
    hintBox.hidden = true;
    input.blur();
    refreshBar();
  }

  // game.js appelle startLevel() depuis advance(), le menu des étages, etc. : on se branche dessus.
  const baseStartLevel = startLevel;
  startLevel = function () { baseStartLevel(); onLevelStart(); };

  window.addEventListener('keydown', ev => {
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
      const ctrl = { r: 'Ctrl-r', d: 'Ctrl-d', u: 'Ctrl-u', f: 'Ctrl-f', b: 'Ctrl-b', o: 'Ctrl-o' };
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
  });

  $('#hint-button').addEventListener('click', showHint);
  $('#retry-button').addEventListener('click', () => { startLevel(); toast('Étage remis à zéro'); });
  $('#next-button').addEventListener('click', () => { if (finished) goNext(); });
  document.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (button && !button.closest('.level-picker')) setTimeout(() => button.blur());
  });

  onLevelStart();
})();
