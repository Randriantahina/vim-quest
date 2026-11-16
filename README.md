# Vim Quest — Le donjon du code

Un jeu solo en français pour apprendre Vim et Neovim. La campagne contient 52 étages : déplacements, insertion, suppressions, changements, copier/coller et registres, annulation/répétition, recherche, sélection visuelle, objets texte, macros, substitutions, fichiers, buffers, marques, fenêtres et options. Les étages avancés affichent un buffer de code et vérifient son résultat.

## Jouer

Ouvre `index.html` dans ton navigateur. Le jeu se joue **directement au clavier, comme dans Neovim** : pas de champ à remplir, pas d'Entrée à presser. Chaque touche est prise en compte immédiatement, et la barre sous le jeu affiche le mode courant et les touches en attente (par exemple `d` ou `3`).

- **Mode normal** : tape `ciw`, `3j`, `dd`, `"ayy`… la commande s'exécute dès qu'elle est complète.
- **Mode insertion** (après `i`, `o`, `cw`…) : ce que tu tapes va dans le buffer ; Entrée, Retour arrière et Tab marchent ; Échap revient au mode normal.
- **Ligne de commande** : `:` ou `/` ouvre la ligne ; Entrée valide, Échap annule.
- **Ctrl-w** est réservé par le navigateur : utilise **Alt-w**. Les autres combinaisons (Ctrl-r, Ctrl-d, Ctrl-u, Ctrl-f, Ctrl-b, Ctrl-o, Ctrl-i/Tab) fonctionnent normalement.
- **Indice** (bouton ou `F1`) : un premier appui donne l'indice, un deuxième la solution, puis « ▶ La voir en action » la rejoue touche par touche.
- **Recommencer l'étage** remet l'exercice à zéro ; à la réussite, Entrée passe à l'étage suivant.

Le bouton « Étages » permet de reprendre ou choisir une salle, et « Effacer » remet la campagne à zéro. Les 5 premières salles sont des labyrinthes ; les 47 suivantes affichent un buffer de code à modifier.

## Tests

`node tests/run.js` rejoue la solution de chacun des 47 étages d'édition touche par touche et vérifie qu'ils sont réussis.

La progression est stockée localement dans le navigateur. Le bouton « Recommencer » remet la campagne à zéro.
