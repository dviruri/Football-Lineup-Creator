// Mutable state variables for the application
let pitchType        = 'grass';
let outfieldCount    = 10;
let currentFormation = null;
let oppFormation     = '4-3-3';
let subCount         = 5;
let badgeImg         = null;
let customPositions  = {};   // { playerIndex: {x, y} }
let dragState        = null; // { idx, offX, offY }
let lastPositions    = [];   // cached for hit-test

let squad       = [];
let squadSearch = '';
let editingId   = null;
let pickTarget  = null;
let matchData   = { title:'', date:'', opponent:'', venue:'', homeAway:'home', format:'', duration:90, periods:2, notes:'' }; // { rowEl }
