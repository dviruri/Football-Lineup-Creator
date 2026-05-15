// Match setup functions: saveMatch, loadMatch, updateMatchMeta, onMatchFormatChange, setHA
function saveMatch() {
  matchData.title    = document.getElementById('matchTitle').value;
  matchData.date     = document.getElementById('matchDate').value;
  matchData.opponent = document.getElementById('matchOpponent').value;
  matchData.venue    = document.getElementById('matchVenue').value;
  matchData.format   = document.getElementById('matchFormat').value;
  matchData.duration = document.getElementById('matchDuration').value;
  matchData.periods  = document.getElementById('matchPeriods').value;
  matchData.notes    = document.getElementById('matchNotes').value;
  localStorage.setItem(MATCH_KEY, JSON.stringify(matchData));
  updateMatchMeta();
  if (typeof updateMatchPageTitle === 'function') updateMatchPageTitle();
}

function loadMatch() {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (raw) Object.assign(matchData, JSON.parse(raw));
  } catch(e) {}
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
  sv('matchTitle',    matchData.title);
  sv('matchDate',     matchData.date);
  sv('matchOpponent', matchData.opponent);
  sv('matchVenue',    matchData.venue);
  sv('matchFormat',   matchData.format);
  sv('matchDuration', matchData.duration);
  sv('matchPeriods',  matchData.periods);
  sv('matchNotes',    matchData.notes);
  // Home/Away buttons
  document.querySelectorAll('.ha-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.ha === (matchData.homeAway || 'home'))
  );
  // Apply format → outfield count if a format is saved
  if (matchData.format && FORMAT_OUTFIELD[matchData.format] !== undefined) {
    outfieldCount = FORMAT_OUTFIELD[matchData.format];
    document.getElementById('outfieldSlider').value = outfieldCount;
    document.getElementById('outfieldCount').textContent = outfieldCount;
  }
  updateMatchMeta();
}

function updateMatchMeta() {
  const el = document.getElementById('matchMeta');
  if (!el) return;
  const parts = [];
  if (matchData.opponent) parts.push('vs <span>' + esc(matchData.opponent) + '</span>');
  if (matchData.date)     parts.push('<span>' + matchData.date + '</span>');
  if (matchData.venue)    parts.push('@ <span>' + esc(matchData.venue) + '</span>');
  if (parts.length) { el.innerHTML = parts.join(' · '); el.style.display = ''; }
  else              { el.style.display = 'none'; }
}

function onMatchFormatChange() {
  const fmt = document.getElementById('matchFormat').value;
  matchData.format = fmt;
  saveMatch();
  if (fmt && FORMAT_OUTFIELD[fmt] !== undefined) {
    const n = FORMAT_OUTFIELD[fmt];
    outfieldCount    = n;
    currentFormation = null;
    customPositions  = {};
    document.getElementById('outfieldSlider').value        = n;
    document.getElementById('outfieldCount').textContent   = n;
    document.getElementById('oppFormInput').value          = (FORMATIONS[n] || [['4-3-3']])[0][0];
    oppFormation = document.getElementById('oppFormInput').value;
    document.getElementById('oppFormMsg').textContent = '';
    buildFormationButtons();
    buildPlayerList();
    render();
  }
}

function setHA(val, btn) {
  matchData.homeAway = val;
  document.querySelectorAll('.ha-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  saveMatch();
}
