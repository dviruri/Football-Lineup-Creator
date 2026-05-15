// Persistence, startup, navigation, and event listeners

// ── NAVIGATION ────────────────────────────────────────────────────────────
function goToClub() {
  document.getElementById('page-match').classList.remove('active');
  document.getElementById('page-club').classList.add('active');
  renderMatchCard();
}

function goToMatch() {
  document.getElementById('page-club').classList.remove('active');
  document.getElementById('page-match').classList.add('active');
  updateMatchPageTitle();
  render();
}

function updateMatchPageTitle() {
  const title = document.getElementById('matchTitle')?.value?.trim();
  const el    = document.getElementById('matchPageTitle');
  if (el) el.textContent = title || '';
}

function newMatch() {
  // Clear persisted match state
  localStorage.removeItem(STATE_KEY);
  // Reset match meta fields
  ['matchTitle','matchVenue','matchNotes','matchOpponent'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  sv('matchDate',     '');
  sv('matchFormat',   '');
  sv('matchDuration', '90');
  sv('matchPeriods',  '2');
  document.getElementById('showOpponent').checked        = false;
  document.getElementById('opponentSection').style.display = 'none';
  // Reset lineup state
  outfieldCount    = 10;
  currentFormation = null;
  customPositions  = {};
  oppFormation     = '4-3-3';
  subCount         = 5;
  pitchType        = 'grass';
  sv('outfieldSlider', '10');
  document.getElementById('outfieldCount').textContent = '10';
  sv('subSlider', '5');
  document.getElementById('subCountLabel').textContent = '5';
  sv('oppFormInput', '4-3-3');
  // Reset pitch surface buttons
  document.querySelectorAll('.pitch-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  // Reset home/away buttons
  document.querySelectorAll('.ha-btn').forEach(b => b.classList.toggle('active', b.dataset.ha === 'home'));
  buildFormationButtons();
  buildPlayerList();
  buildSubList();
  saveMatch();
  goToMatch();
}

function openMatch() {
  goToMatch();
}

function renderMatchCard() {
  const list = document.getElementById('matchesList');
  if (!list) return;

  const title = document.getElementById('matchTitle')?.value?.trim() || '';
  const date  = document.getElementById('matchDate')?.value  || '';
  const fmt   = document.getElementById('matchFormat')?.value || '';
  const opp   = document.getElementById('matchOpponent')?.value?.trim() || '';
  const hasState = !!localStorage.getItem(STATE_KEY) || !!localStorage.getItem(MATCH_KEY);
  const hasMatch = !!(title || hasState);

  const newBtn = document.getElementById('newMatchBtn');

  if (!hasMatch) {
    list.innerHTML = `
      <div class="no-matches">
        <div class="no-matches-icon">🏟️</div>
        <div>${esc(t('matches.empty'))}</div>
      </div>`;
    if (newBtn) newBtn.disabled = false;
    return;
  }

  const displayTitle = title || t('matches.untitled');
  const metaParts = [];
  if (date) metaParts.push(`📅 ${date}`);
  if (fmt)  metaParts.push(`⚽ ${fmt}`);
  if (opp)  metaParts.push(`🆚 ${esc(opp)}`);

  list.innerHTML = `
    <div class="match-card" onclick="openMatch()">
      <div class="match-card-info">
        <div class="match-card-title">${esc(displayTitle)}</div>
        ${metaParts.length ? `<div class="match-card-meta">${metaParts.map(p=>`<span>${p}</span>`).join('')}</div>` : ''}
      </div>
      <button class="match-card-open" onclick="event.stopPropagation();openMatch()">${t('matches.open')}</button>
    </div>`;

  if (newBtn) newBtn.disabled = true; // prototype: 1 match max
}

// ── STATE PERSISTENCE ─────────────────────────────────────────────────────
function applyState(s) {
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  sv('teamName', s.t); sv('jerseyColor', s.jc); sv('numberColor', s.nc);
  sv('shortsColor', s.sc); sv('gkColor', s.gk);
  sv('gkNumberColor', s.gkn); sv('gkShortsColor', s.gks);
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
    const key = h3.dataset.i18n || h3.textContent.trim();
    if (saved[key]) sec.classList.add('collapsed');
    h3.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      const state = {};
      document.querySelectorAll('.section').forEach(s => {
        const h = s.querySelector('h3');
        const k = h ? (h.dataset.i18n || h.textContent.trim()) : null;
        if (k) state[k] = s.classList.contains('collapsed');
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
loadLanguage();
loadMatch();
loadSquad();
loadState();
buildFormationButtons();
buildPlayerList();
buildSubList();
loadFromHash();
render();
renderMatchCard();
initCollapsible();

[
  'jerseyColor','numberColor','shortsColor','gkColor','gkNumberColor','gkShortsColor',
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
