# Vim Quest — Entraînement

Apprendre Vim et Neovim **en pratiquant, sans lire de manuel**. Chaque défi te place devant un vrai éditeur : l'objectif est affiché à droite, tu le réalises à gauche, touche par touche.

- **On apprend en faisant** : la 1re fois, les touches s'allument une par une ; la 2e, elles n'apparaissent que si tu hésites ; la 3e, tu fais tout seul.
- **L'explication vient après l'action** : une fois la commande réussie, tu vois pourquoi elle s'écrit ainsi (`d` = delete, `w` = word…).
- **Toutes les techniques sont acceptées** : seul le résultat compte. Si tu as pris le chemin long, le jeu te montre la version experte et te donne 1 à 3 étoiles.
- **Révision espacée** : une commande réussie sans aide revient de plus en plus tard ; une commande ratée ou aidée revient vite.
- Une commande à la fois (58 au total, ordonnées du plus utile au plus fin), sessions de 10 défis, XP, niveaux, série de réussites, carte de progression.
- `Tab` recommence le défi, `Échap` quitte l'insertion, « Je suis bloqué » montre les touches (sans pénalité cachée : la commande reviendra juste plus tôt).

## Jouer

Ouvre `index.html` dans ton navigateur (ou `python3 -m http.server`). La progression est sauvegardée dans le navigateur.

Autres modes : `arcade.html` (cartes de code qui tombent, à réserver à la révision) et `campagne.html` (campagne classique de 52 étages).

## Architecture

- `vimcore.js` : mini-Vim (normal, insertion, visuel) qui calcule le résultat réel de chaque commande.
- `drills.js` : 58 commandes, 135 exercices (tampon de départ + touches ; le résultat est calculé).
- `learn.js` : pédagogie (ordre, révision espacée, étoiles, explications).
- `dojo.js` / `dojo.css` : interface de l'entraînement.

## Tests

- `node tests/vim.test.js` : le mini-Vim et chacun des 135 exercices.
- `node tests/learn.test.js` : l'ordre d'apprentissage, les révisions, les explications.
- `node tests/run.js` : les 47 étages d'édition de la campagne classique.

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
