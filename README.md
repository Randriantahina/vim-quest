# Vim Quest — Arcade

Un jeu d'arcade en français pour apprendre Vim et Neovim. Des fragments de code tombent du ciel : chacun montre le code d'origine, une flèche ▼ et le résultat attendu. Tape la commande Vim qui fait la transformation avant qu'ils touchent ta base.

- **58 commandes en 11 thèmes** : h j k l, mots et lignes, f/t, suppression, insertion, changement, copier/coller/annuler, `dt`/`df`/`ct`, objets texte (`ci"`, `di(`…), compteurs, mode visuel, indentation.
- **Tu tapes pour de vrai**, touche par touche, sans Entrée. La carte visée affiche en direct le résultat de ce que tu tapes, mode insertion compris.
- **Progression guidée** : une nouvelle famille de commandes à chaque vague, avec une fiche d'exemples. Les touches sont affichées tant que tu ne maîtrises pas une commande, puis cachées ; celles que tu rates reviennent plus souvent.
- Combos, score, vies, record sauvegardé, mode entraînement par thème (sans vies), son optionnel.

## Jouer

Ouvre `index.html` dans ton navigateur (ou `python3 -m http.server`), puis **Entrée** pour jouer. **Échap** annule ta saisie en cours ; sans saisie, il met en pause.

La **campagne classique** (52 étages d'exercices sur un vrai buffer de code) reste disponible dans `campagne.html`.

## Tests

- `node tests/vim.test.js` vérifie le mini-Vim (`vimcore.js`) et chacun des 135 exercices de l'arcade.
- `node tests/run.js` rejoue les 47 étages d'édition de la campagne classique.

## Campagne classique (campagne.html)

Ouvre `index.html` dans ton navigateur. Le jeu se joue **directement au clavier, comme dans Neovim** : pas de champ à remplir, pas d'Entrée à presser. Chaque touche est prise en compte immédiatement, et la barre sous le jeu affiche le mode courant et les touches en attente (par exemple `d` ou `3`).

- **Mode normal** : tape `ciw`, `3j`, `dd`, `"ayy`… la commande s'exécute dès qu'elle est complète.
- **Mode insertion** (après `i`, `o`, `cw`…) : ce que tu tapes va dans le buffer ; Entrée, Retour arrière et Tab marchent ; Échap revient au mode normal.
- **Ligne de commande** : `:` ou `/` ouvre la ligne ; Entrée valide, Échap annule.
- **Ctrl-w** est réservé par le navigateur : utilise **Alt-w**. Les autres combinaisons (Ctrl-r, Ctrl-d, Ctrl-u, Ctrl-f, Ctrl-b, Ctrl-o, Ctrl-i/Tab) fonctionnent normalement.
- **Indice** (bouton ou `F1`) : un premier appui donne l'indice, un deuxième la solution, puis « ▶ La voir en action » la rejoue touche par touche.
- **Recommencer l'étage** remet l'exercice à zéro ; à la réussite, Entrée passe à l'étage suivant.

Le bouton « Étages » permet de reprendre ou choisir une salle, et « Effacer » remet la campagne à zéro. Les 5 premières salles sont des labyrinthes ; les 47 suivantes affichent un buffer de code à modifier.

## Tests de la campagne

`node tests/run.js` rejoue la solution de chacun des 47 étages d'édition touche par touche et vérifie qu'ils sont réussis.

La progression est stockée localement dans le navigateur. Le bouton « Recommencer » remet la campagne à zéro.
