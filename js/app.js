// Persistence, startup, and event listeners
function applyState(s) {
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  sv('teamName', s.t); sv('jerseyColor', s.jc); sv('numberColor', s.nc);
  sv('shortsColor', s.sc); sv('gkColor', s.gk);
  sv('kitPattern', s.kp); sv('patternColor', s.pc);
  if (s.pt) {
    pitchType = s.pt;
    document.querySelectorAll('.pitch-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.trim().toLowerCase().includes(s.pt));
    });
  }
  if (s.oc) {
    outfieldCount = parseInt(s.oc);
    document.getElementById('outfieldSlider').value = s.oc;
    document.getElementById('outfieldCount').textContent = s.oc;
  }
  if (s.sn) {
    subCount = parseInt(s.sn);
    document.getElementById('subSlider').value = s.sn;
    document.getElementById('subCountLabel').textContent = s.sn;
  }
  buildFormationButtons();
  if (s.fm) {
    currentFormation = s.fm;
    document.querySelectorAll('.formation-btn').forEach(b => b.classList.toggle('active', b.textContent.trim() === s.fm));
  }
  buildPlayerList();
  buildSubList();
  if (s.pl) {
    const rows = document.querySelectorAll('#playerList .player-row');
    s.pl.forEach((p, i) => {
      if (!rows[i]) return;
      rows[i].querySelector('input[type=text]').value   = p.name || '';
      rows[i].querySelector('input[type=number]').value = p.num  || '';
      if (p.squadId) { rows[i].dataset.squadId = p.squadId; lockRow(rows[i]); }
    });
  }
  if (s.sb) {
    const rows = document.querySelectorAll('#subList .player-row');
    s.sb.forEach((p, i) => {
      if (!rows[i]) return;
      rows[i].querySelector('input[type=text]').value   = p.name || '';
      rows[i].querySelector('input[type=number]').value = p.num  || '';
      if (p.squadId) { rows[i].dataset.squadId = p.squadId; lockRow(rows[i]); }
    });
  }
  sv('coachName', s.cn); sv('coachColor', s.cc); sv('coachInitials', s.ci);
  sv('asstCoachName', s.an); sv('asstColor', s.ac); sv('asstInitials', s.ai);
  if (s.opp) {
    document.getElementById('showOpponent').checked = true;
    document.getElementById('opponentSection').style.display = '';
  }
  sv('matchOpponent', s.on); sv('oppJerseyColor', s.oj); sv('oppNumberColor', s.onu); sv('oppShortsColor', s.os);
  if (s.of) { oppFormation = s.of; sv('oppFormInput', s.of); }
  if (s.cp) customPositions = s.cp;
}

function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(getShareState())); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return false;
    applyState(JSON.parse(raw));
    return true;
  } catch(e) { return false; }
}

function loadFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  try { applyState(JSON.parse(decodeURIComponent(escape(atob(hash))))); }
  catch(e) { /* invalid hash */ }
}

// ── COLLAPSIBLE SECTIONS ──────────────────────────────────────────────────
function initCollapsible() {
  const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
  document.querySelectorAll('.section').forEach(sec => {
    const h3 = sec.querySelector('h3');
    if (!h3) return;
    const key = h3.textContent.trim();
    if (saved[key]) sec.classList.add('collapsed');
    h3.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      const state = {};
      document.querySelectorAll('.section').forEach(s => {
        const t = s.querySelector('h3')?.textContent?.trim();
        if (t) state[t] = s.classList.contains('collapsed');
      });
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
    });
  });
}

document.addEventListener('click', () => {
  const dd = document.getElementById('pickDropdown');
  if (dd) dd.style.display = 'none';
});

// ── STARTUP ───────────────────────────────────────────────────────────────
loadMatch();
loadSquad();
loadState();          // restore full app state from localStorage
buildFormationButtons(); // safe re-call — uses current outfieldCount
buildPlayerList();
buildSubList();
loadFromHash();       // hash overrides saved state (share links)
render();
initCollapsible();

[
  'jerseyColor','numberColor','shortsColor','gkColor',
  'teamName',
  'coachName','coachColor','coachInitials',
  'asstCoachName','asstColor','asstInitials',
  'oppJerseyColor','oppNumberColor','oppShortsColor',
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', render);
});
document.getElementById('outfieldSlider').addEventListener('input', e => setOutfield(e.target.value));
document.getElementById('subSlider').addEventListener('input', e => setSubCount(e.target.value));
