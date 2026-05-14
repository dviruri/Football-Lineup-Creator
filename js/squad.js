// Squad management and player modal functions
function saveSquad() { localStorage.setItem(SQUAD_KEY, JSON.stringify(squad)); }
function loadSquad() {
  try { const s = localStorage.getItem(SQUAD_KEY); if (s) squad = JSON.parse(s); } catch(e) { squad = []; }
  renderSquadList();
}

function getById(id) { return squad.find(p => p.id === id) || null; }

function renderSquadList() {
  const q   = squadSearch.toLowerCase();
  const fil = squad.filter(p => !q || p.displayName.toLowerCase().includes(q) || String(p.shirtNumber||'').includes(q));
  const cnt = document.getElementById('squadCount');
  const active = squad.filter(p=>p.active).length;
  cnt.textContent = squad.length ? t('squad.count', squad.length, active) : t('squad.noPlayers');

  const list = document.getElementById('squadList');
  if (!fil.length) {
    list.innerHTML = `<div class="squad-empty">${squad.length ? t('squad.noMatches') : t('squad.empty')}</div>`;
    return;
  }
  list.innerHTML = '';
  fil.forEach(p => {
    const tc = TYPE_COLOR[p.playerType] || '#888';
    const ta = TYPE_ABBR[p.playerType]  || '—';
    const d  = document.createElement('div');
    d.className = 'squad-item' + (p.active ? '' : ' squad-item-inactive');
    d.innerHTML = `
      <span class="squad-item-num">#${esc(p.shirtNumber||'—')}</span>
      <span class="squad-item-name" title="${esc(p.displayName)}">${esc(p.displayName)}</span>
      <span class="squad-item-type" style="color:${tc}">${ta}</span>
      <button class="sq-btn" title="${p.active ? t('squad.markInactive') : t('squad.markActive')}" onclick="toggleActive('${p.id}')">${p.active?'🟢':'⚫'}</button>
      <button class="sq-btn" title="${t('squad.edit')}" onclick="openPlayerModal('${p.id}')">✏️</button>
      <button class="sq-btn" title="${t('squad.duplicate')}" onclick="dupPlayer('${p.id}')">⧉</button>
      <button class="sq-btn del" title="${t('squad.delete')}" onclick="delPlayer('${p.id}')">✕</button>`;
    list.appendChild(d);
  });
}

function toggleActive(id) {
  const p = getById(id); if (!p) return;
  p.active = !p.active; saveSquad(); renderSquadList(); checkWarnings();
}
function delPlayer(id) {
  if (!confirm(t('squad.confirmDel'))) return;
  squad = squad.filter(p => p.id !== id); saveSquad(); renderSquadList(); checkWarnings();
}
function dupPlayer(id) {
  const p = getById(id); if (!p) return;
  squad.push({ ...p, id: genId(), displayName: p.displayName + ' (copy)' });
  saveSquad(); renderSquadList();
}

// ── PLAYER MODAL ──────────────────────────────────────────────────────────
function openPlayerModal(id) {
  editingId = id || null;
  const p   = id ? getById(id) : null;
  document.getElementById('modalTitle').textContent = p ? t('modal.editPlayer') : t('modal.addPlayer');
  document.getElementById('mFirst').value   = p?.firstName   || '';
  document.getElementById('mLast').value    = p?.lastName    || '';
  const dn = document.getElementById('mDisplay');
  dn.value = p?.displayName || ''; dn.dataset.m = p ? '1' : '';
  document.getElementById('mShirt').value   = p?.shirtNumber || '';
  document.getElementById('mType').value    = p?.playerType  || 'Midfielder';
  document.getElementById('mFoot').value    = p?.strongFoot  || 'Right';
  document.getElementById('mNotes').value   = p?.notes       || '';
  document.getElementById('mActive').checked = p ? p.active  : true;
  renderChips('mPref', p?.preferredPositions  || []);
  renderChips('mSec',  p?.secondaryPositions  || []);
  document.getElementById('playerModal').style.display = 'flex';
}
function closePlayerModal() {
  document.getElementById('playerModal').style.display = 'none'; editingId = null;
}
function renderChips(containerId, selected) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  POSITIONS.forEach(pos => {
    const c = document.createElement('div');
    c.className = 'pos-chip' + (selected.includes(pos) ? ' sel' : '');
    c.textContent = pos;
    c.onclick = () => c.classList.toggle('sel');
    el.appendChild(c);
  });
}
function getChips(id) { return [...document.querySelectorAll(`#${id} .pos-chip.sel`)].map(c=>c.textContent); }
function autoFillDisplay() {
  const fn = document.getElementById('mFirst').value.trim();
  const ln = document.getElementById('mLast').value.trim();
  const dn = document.getElementById('mDisplay');
  if (!dn.dataset.m) dn.value = [fn, ln].filter(Boolean).join(' ');
}
function savePlayerModal() {
  const displayName = document.getElementById('mDisplay').value.trim() ||
    [document.getElementById('mFirst').value.trim(), document.getElementById('mLast').value.trim()].filter(Boolean).join(' ') || 'Player';
  const data = {
    firstName: document.getElementById('mFirst').value.trim(),
    lastName:  document.getElementById('mLast').value.trim(),
    displayName,
    shirtNumber:         document.getElementById('mShirt').value.trim(),
    playerType:          document.getElementById('mType').value,
    strongFoot:          document.getElementById('mFoot').value,
    notes:               document.getElementById('mNotes').value.trim(),
    active:              document.getElementById('mActive').checked,
    preferredPositions:  getChips('mPref'),
    secondaryPositions:  getChips('mSec'),
  };
  if (editingId) { const p = getById(editingId); if (p) Object.assign(p, data); }
  else           { squad.push({ id: genId(), ...data }); }
  saveSquad(); renderSquadList(); closePlayerModal(); checkWarnings();
}
