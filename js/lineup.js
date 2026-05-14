// Lineup functions: player rows, formation, pick dropdown, warnings
function setOutfield(n) {
  outfieldCount    = parseInt(n);
  document.getElementById('outfieldCount').textContent = n;
  currentFormation = null;
  oppFormation     = (FORMATIONS[outfieldCount] || [['4-3-3']])[0][0];
  document.getElementById('oppFormInput').value = oppFormation;
  document.getElementById('oppFormMsg').textContent = '';
  customPositions  = {};
  buildFormationButtons();
  buildPlayerList();
  render();
}

function setSubCount(n) {
  subCount = parseInt(n);
  document.getElementById('subCountLabel').textContent = n;
  buildSubList();
  render();
}

function setPitch(type, el) {
  pitchType = type;
  document.querySelectorAll('.pitch-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  render();
}

function syncOppName() { render(); }

function onOpponentToggle() {
  const on = document.getElementById('showOpponent').checked;
  document.getElementById('opponentSection').style.display = on ? '' : 'none';
  customPositions = {};
  render();
}

function buildFormationButtons() {
  const grid = document.getElementById('formationGrid');
  grid.innerHTML = '';
  const opts = FORMATIONS[outfieldCount] || [];
  opts.forEach(([key]) => {
    const btn = document.createElement('button');
    btn.className = 'formation-btn' + (currentFormation === key ? ' active' : '');
    btn.textContent = key;
    btn.onclick = () => selectFormation(key, btn);
    grid.appendChild(btn);
  });
  if (!currentFormation && opts.length) {
    currentFormation = opts[0][0];
    grid.firstChild && grid.firstChild.classList.add('active');
  }
}

function selectFormation(key, btn) {
  currentFormation = key;
  customPositions  = {};
  document.querySelectorAll('.formation-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('customFormInput').value = '';
  document.getElementById('formMsg').textContent = '';
  render();
}

function onCustomFormInput() {
  const val = document.getElementById('customFormInput').value.trim();
  const msg = document.getElementById('formMsg');
  if (!val) { msg.textContent = ''; return; }
  const r = validateFormation(val);
  msg.style.color = r.ok ? '#2ecc71' : '#e94560';
  msg.textContent = r.text;
}

function applyCustomFormation() {
  const val = document.getElementById('customFormInput').value.trim();
  const msg = document.getElementById('formMsg');
  if (!val) return;
  const r = validateFormation(val);
  msg.style.color = r.ok ? '#2ecc71' : '#e94560';
  msg.textContent = r.text;
  if (!r.ok) return;
  currentFormation = val;
  customPositions  = {};
  document.querySelectorAll('.formation-btn').forEach(b => b.classList.remove('active'));
  render();
}

function validateFormation(val) {
  if (!/^\d+(-\d+)+$/.test(val))
    return { ok: false, text: 'Format: numbers separated by dashes (e.g. 4-3-3)' };
  const parts = val.split('-').map(Number);
  if (parts.some(p => p < 1))
    return { ok: false, text: 'Each line must have at least 1 player' };
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum !== outfieldCount)
    return { ok: false, text: `Must sum to ${outfieldCount} outfield players (got ${sum})` };
  return { ok: true, text: `✓ Valid — ${val}` };
}

function validateAnyFormation(val, n) {
  if (!/^\d+(-\d+)+$/.test(val))
    return { ok: false, text: 'Format: numbers separated by dashes' };
  const parts = val.split('-').map(Number);
  if (parts.some(p => p < 1))
    return { ok: false, text: 'Each line must have at least 1 player' };
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum !== n)
    return { ok: false, text: `Must sum to ${n} (got ${sum})` };
  return { ok: true, text: `✓ Valid — ${val}` };
}

function onOppFormInput() {
  const val = document.getElementById('oppFormInput').value.trim();
  const msg = document.getElementById('oppFormMsg');
  if (!val) { msg.textContent = ''; return; }
  const r = validateAnyFormation(val, outfieldCount);
  msg.style.color = r.ok ? '#2ecc71' : '#e94560';
  msg.textContent = r.text;
}

function applyOppFormation() {
  const val = document.getElementById('oppFormInput').value.trim();
  const msg = document.getElementById('oppFormMsg');
  if (!val) return;
  const r = validateAnyFormation(val, outfieldCount);
  msg.style.color = r.ok ? '#2ecc71' : '#e94560';
  msg.textContent = r.text;
  if (!r.ok) return;
  oppFormation = val;
  render();
}

function buildPlayerList() {
  const list  = document.getElementById('playerList');
  const saved = readRows('#playerList');
  list.innerHTML = '';
  for (let i = 0; i <= outfieldCount; i++) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.squadId = saved[i]?.squadId || '';
    row.innerHTML = `
      <span class="num">${i === 0 ? 'GK' : i}</span>
      <input type="text"   value="${esc(saved[i]?.name || (i===0?'Goalkeeper':'Player '+i))}">
      <button class="pick-btn" title="Pick from squad" onclick="onPickBtn(event,this,${i},'starter')">👤</button>
      <input type="number" min="1" max="99" value="${saved[i]?.num || (i+1)}">`;
    list.appendChild(row);
    if (saved[i]?.squadId) lockRow(row);
  }
  attachLiveRender('#playerList');
}

function buildSubList() {
  const list  = document.getElementById('subList');
  const saved = readRows('#subList');
  list.innerHTML = '';
  for (let i = 0; i < subCount; i++) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.squadId = saved[i]?.squadId || '';
    row.innerHTML = `
      <span class="num" style="color:#f39c12;">${i+1}</span>
      <input type="text"   value="${esc(saved[i]?.name || 'Sub '+(i+1))}">
      <button class="pick-btn" title="Pick from squad" onclick="onPickBtn(event,this,${i},'sub')">👤</button>
      <input type="number" min="1" max="99" value="${saved[i]?.num || (outfieldCount+2+i)}">`;
    list.appendChild(row);
    if (saved[i]?.squadId) lockRow(row);
  }
  attachLiveRender('#subList');
}

function readRows(sel) {
  return [...document.querySelectorAll(sel + ' .player-row')].map(r => ({
    name:    r.querySelector('input[type=text]').value,
    num:     r.querySelector('input[type=number]').value,
    squadId: r.dataset.squadId || '',
  }));
}

function attachLiveRender(sel) {
  document.querySelectorAll(sel + ' input').forEach(i => i.addEventListener('input', render));
}

function getPlayers() {
  return [...document.querySelectorAll('#playerList .player-row')].map((row, i) => ({
    isGK:   i === 0,
    name:   row.querySelector('input[type=text]').value   || (i===0?'GK':'P'+i),
    number: row.querySelector('input[type=number]').value || (i+1),
  }));
}

function getSubs() {
  return [...document.querySelectorAll('#subList .player-row')].map((row, i) => ({
    name:   row.querySelector('input[type=text]').value   || 'Sub'+(i+1),
    number: row.querySelector('input[type=number]').value || (outfieldCount+2+i),
  }));
}

function lockRow(row) {
  row.classList.add('locked');
  row.querySelector('input[type=text]').readOnly   = true;
  row.querySelector('input[type=number]').readOnly = true;
  const btn = row.querySelector('.pick-btn');
  btn.textContent = '✕';
  btn.title = 'Remove player';
}

function unlockRow(row) {
  row.classList.remove('locked');
  row.querySelector('input[type=text]').readOnly   = false;
  row.querySelector('input[type=number]').readOnly = false;
  const btn = row.querySelector('.pick-btn');
  btn.textContent = '👤';
  btn.title = 'Pick from squad';
}

function clearPick(row) {
  row.dataset.squadId = '';
  row.querySelector('input[type=text]').value  = '';
  row.querySelector('input[type=number]').value = '';
  unlockRow(row);
  render();
}

// Unified button handler — picks if empty, clears if filled
function onPickBtn(event, btn, rowIdx, slotType) {
  event.stopPropagation();
  const sel = slotType === 'starter' ? '#playerList' : '#subList';
  const row = document.querySelectorAll(sel + ' .player-row')[rowIdx];
  if (row.dataset.squadId) {
    clearPick(row);
  } else {
    openPickDropdown(event, btn, rowIdx, slotType);
  }
}

// ── PICK FROM SQUAD ───────────────────────────────────────────────────────
function openPickDropdown(e, btn, rowIdx, slotType) {
  e.stopPropagation();
  const dd = document.getElementById('pickDropdown');
  dd.style.display = 'none';
  const activeSquad = squad.filter(p => p.active);
  if (!activeSquad.length) { showToast('No active squad players. Add players in Squad Management.'); return; }
  // (available filtering happens after pickTarget is set, below)

  const sel  = slotType === 'starter' ? '#playerList' : '#subList';
  pickTarget = document.querySelectorAll(sel + ' .player-row')[rowIdx];

  // Collect squad IDs already used in other slots (not the current target slot)
  const usedIds = new Set(
    [...document.querySelectorAll('#playerList .player-row, #subList .player-row')]
      .filter(r => r !== pickTarget && r.dataset.squadId)
      .map(r => r.dataset.squadId)
  );

  const available = activeSquad.filter(p => !usedIds.has(p.id));

  const list = document.getElementById('pickList');
  list.innerHTML = '';

  if (!available.length) {
    list.innerHTML = '<div style="padding:10px 12px;font-size:0.78rem;color:#888;">All squad players are already in the lineup.</div>';
    // still show dropdown so user sees the message
  } else {
    available.forEach(p => {
      const tc = TYPE_COLOR[p.playerType] || '#888';
      const ta = TYPE_ABBR[p.playerType]  || '';
      const item = document.createElement('div');
      item.className = 'pick-item';
      item.innerHTML = `<span class="pick-num">#${esc(p.shirtNumber||'—')}</span><span style="flex:1">${esc(p.displayName)}</span><span class="pick-type" style="color:${tc}">${ta}</span>`;
      item.onclick = (ev) => { ev.stopPropagation(); applyPick(p); };
      list.appendChild(item);
    });
  }

  // Position within viewport — fixed element uses viewport coords (no scrollY)
  const r   = btn.getBoundingClientRect();
  const ddH = Math.min(activeSquad.length * 38 + 8, 220);
  const top = (r.bottom + 4 + ddH > window.innerHeight)
    ? Math.max(4, r.top - ddH - 4)   // flip upward if not enough room below
    : r.bottom + 4;
  const left = Math.max(4, Math.min(r.left, window.innerWidth - 220));
  dd.style.top  = top  + 'px';
  dd.style.left = left + 'px';
  dd.style.display = 'block';
}
function applyPick(p) {
  if (!pickTarget) return;
  pickTarget.querySelector('input[type=text]').value   = p.displayName;
  pickTarget.querySelector('input[type=number]').value = p.shirtNumber || '';
  pickTarget.dataset.squadId = p.id;
  lockRow(pickTarget);
  document.getElementById('pickDropdown').style.display = 'none';
  pickTarget = null;
  render();
}

// ── LINEUP WARNINGS ───────────────────────────────────────────────────────
function checkWarnings() {
  const issues    = [];
  const shirtSeen = {};
  const sqSeen    = {};

  const check = (rows, label) => {
    rows.forEach(row => {
      const name  = row.querySelector('input[type=text]').value.trim();
      const num   = row.querySelector('input[type=number]').value.trim();
      const sqId  = row.dataset.squadId || '';
      if (num) {
        if (shirtSeen[num]) issues.push({ sev:'warn', msg:`Duplicate shirt #${num}` });
        else shirtSeen[num] = true;
      }
      if (sqId) {
        if (sqSeen[sqId]) issues.push({ sev:'error', msg:`${name || 'A player'} appears more than once` });
        else sqSeen[sqId] = true;
        const sp = getById(sqId);
        if (sp && !sp.active) issues.push({ sev:'warn', msg:`${name} is marked inactive` });
      }
    });
  };

  check(document.querySelectorAll('#playerList .player-row'), 'starter');
  check(document.querySelectorAll('#subList .player-row'),    'sub');

  const container = document.getElementById('lineupWarnings');
  if (!container) return;
  container.innerHTML = '';
  issues.forEach(iss => {
    const d = document.createElement('div');
    d.className = `w-item ${iss.sev}`;
    d.innerHTML = `<span>${iss.sev === 'error' ? '🔴' : '⚠️'}</span>${esc(iss.msg)}`;
    container.appendChild(d);
  });
}
