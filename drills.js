// Catalogue des commandes enseignées. Un « exercice » = un tampon de départ (§ = curseur) + les touches à taper.
// Le résultat affiché est calculé par le mini-Vim (vimcore.js) : il ne peut donc pas être faux.
// Notation des touches : <Esc> = Échap, <CR> = Entrée ; tout le reste est tapé tel quel.
(function (root) {
  'use strict';

  // [tampon, touches, variantes équivalentes optionnelles]
  const GROUPS = [
    { title: 'Les touches de base', blurb: 'h j k l remplacent les flèches. Un nombre devant répète le mouvement.', cmds: [
      { k: 'l', d: 'Va à droite', ex: [['§abcdef', '3l'], ['let §a = 1;', '5l'], ['§return x;', 'l']] },
      { k: 'h', d: 'Va à gauche', ex: [['abcde§f', '3h'], ['let a = §1;', '4h'], ['re§turn', 'h']] },
      { k: 'j', d: 'Descends', ex: [['§a();\nb();\nc();', 'j'], ['§a();\nb();\nc();\nd();', '3j'], ['§if (x) {\n  run();\n}', '2j']] },
      { k: 'k', d: 'Monte', ex: [['a();\nb();\n§c();', 'k'], ['a();\nb();\nc();\n§d();', '3k'], ['if (x) {\n  run();\n§}', '2k']] }
    ] },
    { title: 'Mots et lignes', blurb: 'w b e sautent de mot en mot ; 0 ^ $ vont aux bords de la ligne.', cmds: [
      { k: 'w', d: 'Va au début du mot suivant', ex: [['§const total = 0;', 'w'], ['§const total = 0;', '2w'], ['§let name = value;', '3w']] },
      { k: 'b', d: 'Recule au début du mot', ex: [['const §total = 0;', 'b'], ['const total = §0;', '2b'], ['return §total + 1;', 'b']] },
      { k: 'e', d: 'Va à la fin du mot', ex: [['§const total = 0;', 'e'], ['§const total = 0;', '2e'], ['let §name = 1;', 'e']] },
      { k: '0', d: 'Va au tout début de la ligne', ex: [['  const a = §1;', '0'], ['let total = a §+ b;', '0']] },
      { k: '^', d: 'Va au premier caractère visible', ex: [['  const a = §1;', '^'], ['    return §x;', '^']] },
      { k: '$', d: 'Va à la fin de la ligne', ex: [['§const a = 1;', '$'], ['let §name = "Ada";', '$']] }
    ] },
    { title: 'Sauts précis', blurb: 'f et t sautent sur un caractère de la ligne ; gg et G vont en haut et en bas du fichier.', cmds: [
      { k: 'f', d: 'Saute sur un caractère', ex: [['§const a = (b);', 'f('], ['§const a = 1; // note', 'f/'], ['§name: "value"', 'f"']] },
      { k: 't', d: 'Saute juste avant un caractère', ex: [['§const a = 1;', 't;'], ['§call(x, y)', 't,'], ['§const a = (b);', 't)']] },
      { k: 'gg', d: 'Va tout en haut du fichier', ex: [['first();\nsecond();\n§third();', 'gg'], ['a;\nb;\nc;\n§d;', 'gg']] },
      { k: 'G', d: 'Va tout en bas du fichier', ex: [['§first();\nsecond();\nthird();', 'G'], ['§a;\nb;\nc;\nd;', 'G']] }
    ] },
    { title: 'Supprimer', blurb: 'Efface du texte sans quitter le mode normal.', cmds: [
      { k: 'x', d: 'Supprime le caractère sous le curseur', ex: [['if (§!ready) return;', 'x'], ['const nam§ee = 1;', 'x'], ['let total§s = 0;', 'x']] },
      { k: 'dw', d: 'Supprime un mot', ex: [['return §await fetch(url);', 'dw'], ['import §type { A } from "a";', 'dw'], ['// §TODO fix this', 'dw']] },
      { k: 'dd', d: 'Supprime la ligne entière', ex: [['let a = 1;\n§console.log(a);\nreturn a;', 'dd'], ['§debugger;\nrun();', 'dd'], ['if (x) {\n  §// old\n}', 'dd']] },
      { k: 'D', d: 'Supprime jusqu’à la fin de la ligne', ex: [['const a = 1; §// debug', 'D', ['d$']], ['run(§x, y, z);', 'D', ['d$']], ['let name = §"old value";', 'D', ['d$']]] }
    ] },
    { title: 'Insérer', blurb: 'Entre en mode insertion, écris ton texte, puis Échap pour revenir en mode normal.', cmds: [
      { k: 'i', d: 'Écris avant le curseur', ex: [['let §= 5;', 'ix <Esc>'], ['return §;', 'ix<Esc>'], ['f(§)', 'ia<Esc>']] },
      { k: 'a', d: 'Écris après le curseur', ex: [['pr§it("hi");', 'an<Esc>'], ['const §x;', 'a = 1<Esc>'], ['if (§a) {}', 'a!<Esc>']] },
      { k: 'A', d: 'Écris à la fin de la ligne', ex: [['co§nst x = 1', 'A;<Esc>'], ['return §value', 'A;<Esc>'], ['call(§a)', 'A;<Esc>']] },
      { k: 'I', d: 'Écris au début de la ligne', ex: [['  return §x;', 'I// <Esc>'], ['const §a = 1;', 'Iexport <Esc>']] },
      { k: 'o', d: 'Ouvre une ligne en dessous', ex: [['function f() {\n  §return 1;\n}', 'o// done<Esc>'], ['§const a = 1;\nconst c = 3;', 'oconst b = 2;<Esc>']] },
      { k: 'O', d: 'Ouvre une ligne au-dessus', ex: [['function f() {\n  §return 1;\n}', 'O// start<Esc>'], ['let a = 1;\n§let c = 3;', 'Olet b = 2;<Esc>']] }
    ] },
    { title: 'Changer', blurb: 'c efface puis te laisse écrire : c + mouvement. Échap termine.', cmds: [
      { k: 'cw', d: 'Change un mot', ex: [['const §old = 1;', 'cwnew<Esc>'], ['import §foo from "x";', 'cwbar<Esc>']] },
      { k: 'ciw', d: 'Change le mot entier', ex: [['const na§me = 1;', 'ciwid<Esc>'], ['return re§sult;', 'ciwok<Esc>']] },
      { k: 'C', d: 'Change jusqu’à la fin de la ligne', ex: [['let x = §1; // old', 'C2;<Esc>', ['c$2;<Esc>']], ['return §a + b;', 'Cc;<Esc>', ['c$c;<Esc>']]] },
      { k: 'r', d: 'Remplace un seul caractère', ex: [['a §- b', 'r+'], ['const n = 1§0;', 'r5'], ['flag = §True;', 'rt']] },
      { k: 'cc', d: 'Change la ligne entière', ex: [['function f() {\n  §old();\n}', 'ccnew();<Esc>', ['S' + 'new();<Esc>']], ['§x = 1;\ny = 2;', 'ccz = 0;<Esc>', ['Sz = 0;<Esc>']]] }
    ] },
    { title: 'Copier, coller, annuler', blurb: 'yy copie une ligne, p colle dessous, P dessus, u annule.', cmds: [
      { k: 'yyp', d: 'Duplique la ligne', ex: [['§const a = 1;\nreturn a;', 'yyp'], ['§<li>one</li>', 'yyp']] },
      { k: 'ddp', d: 'Descends la ligne', ex: [['§first();\nsecond();', 'ddp'], ['§b = 2;\na = 1;\nc = 3;', 'ddp']] },
      { k: 'ddkP', d: 'Monte la ligne', ex: [['a();\n§b();\nc();', 'ddkP'], ['first();\n§second();', 'ddkP']] },
      { k: 'xp', d: 'Inverse deux lettres', ex: [['fu§cntion f() {}', 'xp'], ['fo§mr = 1', 'xp']] },
      { k: 'u', d: 'Annule la dernière modification', ex: [['§hello', 'xxxu'], ['§const a = 1;', 'dwdwu']] },
      { k: '~', d: 'Inverse la casse', ex: [['§hello', '~'], ['const §a = 1;', '~']] },
      { k: 'J', d: 'Joint avec la ligne suivante', ex: [['§const a =\n  1;', 'J'], ['§let a\n= 1;', 'J']] }
    ] },
    { title: 'Aller puis agir', blurb: 'Combine d ou c avec f ou t : agis jusqu’à un caractère précis.', cmds: [
      { k: 'dt', d: 'Supprime jusqu’à un caractère (exclu)', ex: [['const sum = §a + b;', 'dt;'], ['call(§first, second);', 'dt,'], ['§const x = 1;', 'dt=']] },
      { k: 'df', d: 'Supprime jusqu’à un caractère (inclus)', ex: [['§const x = 1;', 'df '], ['call(§a, b)', 'df,'], ['§first.second()', 'df.']] },
      { k: 'ct', d: 'Change jusqu’à un caractère', ex: [['const sum = §a + b;', 'ct;x<Esc>'], ['call(§first, second)', 'ct,one<Esc>']] }
    ] },
    { title: 'Objets texte', blurb: 'i = à l’intérieur, a = avec les délimiteurs. Le curseur peut être n’importe où dedans.', cmds: [
      { k: 'diw', d: 'Supprime le mot sous le curseur', ex: [['const val§ue = 1;', 'diw'], ['return §total;', 'diw']] },
      { k: 'daw', d: 'Supprime le mot et son espace', ex: [['const §old thing = 1;', 'daw'], ['let a = b§ar + 1;', 'daw']] },
      { k: 'di(', d: 'Vide les parenthèses', ex: [['call(§a, b, c);', 'di(', ['dib', 'di)']], ['if (x §> 1) {}', 'di(', ['dib']]] },
      { k: 'ci(', d: 'Change l’intérieur des parenthèses', ex: [['f(§x, y)', 'ci(a<Esc>', ['cib' + 'a<Esc>']], ['run(a, §b)', 'ci(z<Esc>']] },
      { k: 'di"', d: 'Vide les guillemets', ex: [['say("§hello");', 'di"'], ['const s = "a§bc";', 'di"']] },
      { k: 'ci"', d: 'Change l’intérieur des guillemets', ex: [['const s = "§old";', 'ci"new<Esc>'], ['say("he§llo");', 'ci"bye<Esc>']] },
      { k: 'da"', d: 'Supprime le texte et ses guillemets', ex: [['const s = "§old";', 'da"'], ['say("§hi", x);', 'da"']] },
      { k: 'ci[', d: 'Change l’intérieur des crochets', ex: [['const a = [§1, 2];', 'ci[0<Esc>'], ['list[§i]', 'ci[0<Esc>']] },
      { k: 'di{', d: 'Vide les accolades', ex: [['const o = { §a: 1 };', 'di{'], ['if (x) { §run(); }', 'di{']] }
    ] },
    { title: 'Compteurs', blurb: 'Un nombre avant une commande la répète : 3x, 2dd, d2w…', cmds: [
      { k: '3x', d: 'Supprime plusieurs caractères', ex: [['§abcdef', '3x'], ['const §xxxa = 1;', '3x']] },
      { k: '2dd', d: 'Supprime plusieurs lignes', ex: [['a();\n§b();\nc();\nd();', '2dd'], ['§x\ny\nz', '2dd']] },
      { k: 'd2w', d: 'Supprime plusieurs mots', ex: [['§one two three four', 'd2w'], ['call(§a, b)', 'd3w']] },
      { k: 'c2w', d: 'Change plusieurs mots', ex: [['§one two three', 'c2wx<Esc>'], ['let §a b c = 1;', 'c2wz<Esc>']] }
    ] },
    { title: 'Visuel et indentation', blurb: 'v et V sélectionnent ; >> et << décalent les lignes.', cmds: [
      { k: 'ved', d: 'Sélectionne un mot puis supprime', ex: [['§const old = 1;', 'ved'], ['let §name = 1;', 'ved']] },
      { k: 'Vjd', d: 'Sélectionne deux lignes puis supprime', ex: [['§// a\n// b\nrun();', 'Vjd'], ['x();\n§y();\nz();\nw();', 'Vjd']] },
      { k: 'Vjyp', d: 'Sélectionne, copie et colle', ex: [['§a();\nb();', 'Vjyp'], ['§x = 1;\ny = 2;\nz = 3;', 'Vjyp']] },
      { k: 'vec', d: 'Sélectionne un mot puis change', ex: [['const §old = 1;', 'vecnew<Esc>'], ['§foo(bar)', 'vecbaz<Esc>']] },
      { k: '>>', d: 'Indente la ligne', ex: [['function f() {\n§return 1;\n}', '>>'], ['if (x) {\n  §run();\n}', '>>']] },
      { k: '<<', d: 'Désindente la ligne', ex: [['function f() {\n  §return 1;\n}', '<<'], ['if (x) {\n    §run();\n}', '<<']] }
    ] }
  ];

  const COMMANDS = [], DRILLS = [];
  GROUPS.forEach((g, gi) => g.cmds.forEach(c => {
    c.group = gi;
    c.drills = c.ex.map(([text, keys, alts]) => {
      const { lines, cur } = root.Vim.parseBuffer(text);
      const after = root.Vim.run(lines, cur, keys);
      const drill = { cmd: c.k, group: gi, lines, cur, keys, alts: alts || [], after: { lines: after.lines, cur: [after.row, after.col] } };
      DRILLS.push(drill);
      return drill;
    });
    COMMANDS.push(c);
  }));

  root.DRILLS_DATA = { GROUPS, COMMANDS, DRILLS };
  if (typeof module !== 'undefined') module.exports = root.DRILLS_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
