// Constants: storage keys, formations, positions, and type mappings
const SQUAD_KEY    = 'flc_squad';
const MATCH_KEY    = 'flc_match';
const STATE_KEY    = 'flc_state';
const COLLAPSE_KEY = 'flc_collapsed';
const PLANNER_KEY  = 'flc_planner';

const FORMATIONS = {
  4:  [['1-2-1'],['1-1-2'],['2-1-1']],                              // 5v5
  5:  [['1-2-2'],['1-2-1-1'],['1-1-2-1'],['1-3-1']],               // 6v6
  6:  [['1-2-3'],['1-3-2'],['1-2-1-2']],                           // 7v7
  7:  [['1-3-3'],['1-2-3-1'],['1-3-2-1']],                         // 8v8
  8:  [['1-3-2-3'],['1-3-3-2'],['1-4-3-1']],                       // 9v9
  9:  [['4-4-1'],['3-5-1'],['4-3-2']],                             // 10v10
  10: [['4-3-3'],['4-4-2'],['3-5-2'],['4-2-3-1'],['3-4-3']],      // 11v11
};
const FORMAT_OUTFIELD = { '5v5':4, '6v6':5, '7v7':6, '8v8':7, '9v9':8, '11v11':10 };

const POSITIONS   = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'];
const TYPE_ABBR   = { Goalkeeper:'GK', Defender:'DEF', Midfielder:'MID', Attacker:'ATT', Utility:'UTL' };
const TYPE_COLOR  = { Goalkeeper:'#e8a020', Defender:'#5b9bd5', Midfielder:'#2ecc71', Attacker:'#e94560', Utility:'#9b59b6' };
