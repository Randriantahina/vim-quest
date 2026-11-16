// Solution de référence de chaque étage d'édition (dans l'ordre de la campagne, à partir de l'étage 6).
// Notation : <Esc> <CR> <BS> <C-x> (Ctrl) ; tout le reste est tapé tel quel.
// Elles servent à la démonstration « Voir la solution » et au test automatique (tests/run.js).
const SOLUTIONS = [
  'O// TODO<Esc>', 'A;<Esc>', 'x', 'dd', 'ciwgreen<Esc>', 'D', 'cwaccount<Esc>', 'r:',
  'yyp', 'yiwjf;hp', 'p', 'ddu<C-r>u', '/return<CR>n', 'Vjd', 'ci"new<Esc>', 'f;',
  '%', 'J', '>>', '3j', 'dww.', ':wq<CR>', 'qar0qj@a', ':bn<CR>',
  'C"goodbye";<Esc>', ':s/blue/green/g<CR>', ':%s/blue/green/g<CR>', ':noh<CR>', '<C-d>', ':help<CR>', 'e', 'o  // validate<Esc>',
  '"ayyj"ap', ':set number<CR>', '<C-o>', ':e utils.js<CR>', 'iis<Esc>', 'I// TODO <Esc>', 'X', 'sp<Esc>',
  'P', 'di(', '<<', ':bp<CR>', 'maj`a', ':vsplit<CR><C-w>h', '<C-i>'
];
levels.forEach((l, i) => { if (l.editor) l.solution = SOLUTIONS[i - 5]; });
