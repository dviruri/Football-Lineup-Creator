// ── SUBSTITUTION PLANNER ──────────────────────────────────────────────────────

// ── PERSISTENCE ───────────────────────────────────────────────────────────────

function savePlanner() {
  try { localStorage.setItem(PLANNER_KEY, JSON.stringify(subEvents)); } catch(e) {}
}

function loadPlanner() {
  try {
    const raw = localStorage.getItem(PLANNER_KEY);
    subEvents = raw ? JSON.parse(raw) : [];
  } catch(e) { subEvents = []; }
  renderPlanner();
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderPlanner() {
  const listEl = document.getElementById('plannerList');
  const tblEl  = document.getElementById('plannerTimeTable');
  if (!listEl) return;

  const sorted = [...subEvents].sort((a, b) => a.minute - b.minute);

  if (sorted.length === 0) {
    listEl.innerHTML = `<div class="planner-empty">${t('planner.empty')}</div>`;
  } else {
    listEl.innerHTML = sorted.map(ev => {
      const outStr = ev.playersOut.length ? ev.playersOut.map(esc).join(', ') : '—';
      const inStr  = ev.playersIn.length  ? ev.playersIn.map(esc).join(', ')  : '—';
      return `
        <div class="planner-event${ev.completed ? ' planner-done' : ''}">
          <div class="planner-min">${ev.minute}'</div>
          <div class="planner-swap">
            <span class="planner-out">${outStr}</span>
            <span class="planner-arrow"> → </span>
            <span class="planner-in">${inStr}</span>
            ${ev.notes ? `<div class="planner-note-text">${esc(ev.notes)}</div>` : ''}
          </div>
          <div class="planner-btns">
            <button class="pl-btn${ev.completed ? ' pl-undo' : ' pl-done'}"
                    onclick="toggleSubDone('${ev.id}')"
                    title="${ev.completed ? t('planner.markPending') : t('planner.markDone')}">
              ${ev.completed ? '↩' : '✓'}
            </button>
            <button class="pl-btn pl-edit" onclick="openSubModal('${ev.id}')" title="Edit">✎</button>
            <button class="pl-btn pl-del"  onclick="deleteSubEvent('${ev.id}')" title="Delete">✕</button>
          </div>
        </div>`;
    }).join('');
  }

  renderTimeTable(tblEl);
}

function renderTimeTable(el) {
  if (!el) return;
  const summary = computeTimeSummary();
  if (summary.length === 0) { el.innerHTML = ''; return; }

  const fair = summary[0]?.fair ?? 0;
  el.innerHTML = `
    <div class="time-table-wrap">
      <div class="time-table-header">
        <span>${t('planner.col.name')}</span>
        <span>${t('planner.col.on')}</span>
        <span>${t('planner.col.off')}</span>
        <span>${t('planner.col.subs')}</span>
      </div>
      ${summary.map(p => `
        <div class="time-table-row${p.on < fair - 10 ? ' time-low' : p.on > fair + 10 ? ' time-high' : ''}">
          <span class="tt-name">${esc(p.name)}</span>
          <span>${p.on}'</span>
          <span>${p.off}'</span>
          <span>${p.subs}</span>
        </div>`).join('')}
      <div class="time-fair">${t('planner.fair', fair)}</div>
    </div>`;
}

// ── TIME SUMMARY ──────────────────────────────────────────────────────────────

function computeTimeSummary() {
  const duration     = parseInt(document.getElementById('matchDuration')?.value) || 90;
  const starterNames = getPlayers().map(p => p.name).filter(n => n && n.trim() !== '');
  const subNames     = getSubs().map(p => p.name).filter(n => n && n.trim() !== '');

  if (starterNames.length === 0 && subNames.length === 0) return [];

  // Build player map: name → { on, off, subs, onPitch, lastChange }
  const pm = {};
  const init = (name, onPitch) => {
    if (!name || pm[name]) return;
    pm[name] = { name, onPitch, on: 0, off: 0, subs: 0, lastChange: 0 };
  };
  starterNames.forEach(n => init(n, true));
  subNames.forEach(n => init(n, false));

  // Simulate events
  const sorted = [...subEvents].sort((a, b) => a.minute - b.minute);
  sorted.forEach(ev => {
    const min = Math.min(ev.minute, duration);
    Object.values(pm).forEach(p => {
      const elapsed = min - p.lastChange;
      if (p.onPitch) p.on += elapsed; else p.off += elapsed;
      p.lastChange = min;
    });
    ev.playersOut.forEach(n => { if (pm[n]) { pm[n].onPitch = false; pm[n].subs++; } });
    ev.playersIn.forEach(n =>  { if (pm[n]) { pm[n].onPitch = true;  pm[n].subs++; } });
  });

  // Final interval
  Object.values(pm).forEach(p => {
    const elapsed = duration - p.lastChange;
    if (p.onPitch) p.on += elapsed; else p.off += elapsed;
  });

  const nPitch = starterNames.length;
  const nTotal = Object.keys(pm).length;
  const fair   = nTotal > 0 ? Math.round((duration * nPitch) / nTotal) : duration;

  return Object.values(pm).map(p => ({ ...p, diff: p.on - fair, fair }));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function openSubModal(id) {
  editingSubId = id || null;
  const ev = id ? subEvents.find(e => e.id === id) : null;

  const titleEl = document.getElementById('subModalTitle');
  titleEl.textContent = t(id ? 'planner.modalEdit' : 'planner.modalAdd');

  document.getElementById('subMinute').value = ev?.minute ?? '';
  document.getElementById('subNotes').value  = ev?.notes  ?? '';

  // Players Off — from starters
  const outDiv = document.getElementById('subPlayersOut');
  const starters = getPlayers().map(p => p.name).filter(Boolean);
  outDiv.innerHTML = starters.length
    ? starters.map(name => `
        <label class="sub-check-label">
          <input type="checkbox" class="sub-out-check" value="${esc(name)}"
            ${(ev?.playersOut ?? []).includes(name) ? 'checked' : ''}>
          ${esc(name)}
        </label>`).join('')
    : `<span class="planner-empty-small">${t('planner.noStarters')}</span>`;

  // Players In — from bench
  const inDiv = document.getElementById('subPlayersIn');
  const bench = getSubs().map(p => p.name).filter(Boolean);
  inDiv.innerHTML = bench.length
    ? bench.map(name => `
        <label class="sub-check-label">
          <input type="checkbox" class="sub-in-check" value="${esc(name)}"
            ${(ev?.playersIn ?? []).includes(name) ? 'checked' : ''}>
          ${esc(name)}
        </label>`).join('')
    : `<span class="planner-empty-small">${t('planner.noBench')}</span>`;

  document.getElementById('subModal').style.display = 'flex';
}

function closeSubModal() {
  document.getElementById('subModal').style.display = 'none';
  editingSubId = null;
}

function saveSubModal() {
  const minute = parseInt(document.getElementById('subMinute').value);
  if (isNaN(minute) || minute < 1) {
    document.getElementById('subMinute').focus();
    return;
  }

  const playersOut = [...document.querySelectorAll('.sub-out-check:checked')].map(c => c.value);
  const playersIn  = [...document.querySelectorAll('.sub-in-check:checked')].map(c => c.value);
  if (playersOut.length === 0 && playersIn.length === 0) return;

  const notes = document.getElementById('subNotes').value.trim();

  if (editingSubId) {
    const ev = subEvents.find(e => e.id === editingSubId);
    if (ev) Object.assign(ev, { minute, playersOut, playersIn, notes });
  } else {
    subEvents.push({ id: genId(), minute, playersOut, playersIn, notes, completed: false });
  }

  savePlanner();
  renderPlanner();
  closeSubModal();
}

function deleteSubEvent(id) {
  subEvents = subEvents.filter(e => e.id !== id);
  savePlanner();
  renderPlanner();
}

function toggleSubDone(id) {
  const ev = subEvents.find(e => e.id === id);
  if (ev) ev.completed = !ev.completed;
  savePlanner();
  renderPlanner();
}

// ── ROTATION MODAL ────────────────────────────────────────────────────────────

function openRotationModal() {
  const starterNames = getPlayers().map(p => p.name).filter(n => n && n.trim() !== '');
  const subNames     = getSubs().map(p => p.name).filter(n => n && n.trim() !== '');

  if (starterNames.length === 0) { showToast(t('planner.noStarters')); return; }
  if (subNames.length === 0)     { showToast(t('planner.noBench'));    return; }

  const allNames = [...starterNames, ...subNames];

  // Populate full-game player list
  const fgDiv = document.getElementById('fullGamePlayers');
  fgDiv.innerHTML = allNames.map(name => `
    <label class="sub-check-label">
      <input type="checkbox" class="fg-check" value="${esc(name)}">
      ${esc(name)}
    </label>`).join('');

  // Populate mixed per-player role list
  const mlDiv = document.getElementById('mixedPlayersList');
  mlDiv.innerHTML = allNames.map((name, idx) => `
    <div class="mixed-player-row">
      <span class="mixed-name">${esc(name)}</span>
      <label class="mixed-role full" title="${t('planner.rotModal.fullgame')}">
        <input type="radio" name="mrole_${idx}" value="full"> 🔒
      </label>
      <label class="mixed-role prio" title="${t('planner.rotModal.priority')}">
        <input type="radio" name="mrole_${idx}" value="priority"> ⭐
      </label>
      <label class="mixed-role rot" title="${t('planner.rotModal.roleRotation')}">
        <input type="radio" name="mrole_${idx}" value="rotation" checked> 🔄
      </label>
    </div>`).join('');

  // Reset form
  const fairRadio = document.querySelector('input[name=rotStyle][value=fair]');
  if (fairRadio) fairRadio.checked = true;
  document.getElementById('starterPct').value        = 65;
  document.getElementById('starterPctLabel').textContent = 65;
  document.getElementById('mixedPct').value          = 65;
  document.getElementById('mixedPctLabel').textContent   = 65;
  document.getElementById('rotMaxSubs').value        = '';
  document.getElementById('rotMaxStops').value       = '';
  updateRotStyleUI();

  document.getElementById('rotationModal').style.display = 'flex';
}

function closeRotationModal() {
  document.getElementById('rotationModal').style.display = 'none';
}

function updateRotStyleUI() {
  const style = document.querySelector('input[name=rotStyle]:checked')?.value || 'fair';
  document.getElementById('priorityOpts').style.display = style === 'priority' ? '' : 'none';
  document.getElementById('fullGameOpts').style.display = style === 'fullgame' ? '' : 'none';
  document.getElementById('mixedOpts').style.display    = style === 'mixed'    ? '' : 'none';
}

function confirmGenerateRotation() {
  const style    = document.querySelector('input[name=rotStyle]:checked')?.value || 'fair';
  const maxSubs  = parseInt(document.getElementById('rotMaxSubs').value)  || 0;
  const maxStops = parseInt(document.getElementById('rotMaxStops').value) || 0;

  let starterPct    = 65;
  let lockedPlayers = [];
  let priorityPlayers = [];

  if (style === 'priority') {
    starterPct = parseInt(document.getElementById('starterPct').value) || 65;
  } else if (style === 'fullgame') {
    lockedPlayers = [...document.querySelectorAll('.fg-check:checked')].map(c => c.value);
  } else if (style === 'mixed') {
    starterPct = parseInt(document.getElementById('mixedPct').value) || 65;
    const allNames = [...getPlayers().map(p => p.name), ...getSubs().map(p => p.name)].filter(n => n && n.trim() !== '');
    allNames.forEach((name, idx) => {
      const role = document.querySelector(`input[name="mrole_${idx}"]:checked`)?.value || 'rotation';
      if (role === 'full')     lockedPlayers.push(name);
      else if (role === 'priority') priorityPlayers.push(name);
    });
  }

  const generated = runRotationAlgorithm({ style, starterPct, lockedPlayers, priorityPlayers, maxSubs, maxStops });
  if (!generated || generated.length === 0) {
    showToast(t('planner.noRotation'));
    return;
  }

  const hasPending = subEvents.some(e => !e.completed);
  if (hasPending && !confirm(t('planner.confirmReplace'))) return;

  subEvents = [...subEvents.filter(e => e.completed), ...generated];
  savePlanner();
  renderPlanner();
  closeRotationModal();
  showToast(t('planner.generated'));
}

// ── ROTATION ALGORITHM ────────────────────────────────────────────────────────
// Strategy: for each bench player compute their OPTIMAL ENTRY MINUTE
//   (duration − target), then pair them with the starter who should exit earliest.
// This guarantees that priority bench players come on later (small target → late entry)
// while fair bench players come on earlier (larger target → earlier entry).
// Fixed windows or a maxStops snap are applied afterwards if requested.

function runRotationAlgorithm({ style, starterPct, lockedPlayers, priorityPlayers = [], maxSubs, maxStops }) {
  const duration     = parseInt(document.getElementById('matchDuration')?.value) || 90;
  const starterNames = getPlayers().map(p => p.name).filter(n => n && n.trim() !== '');
  const subNames     = getSubs().map(p => p.name).filter(n => n && n.trim() !== '');

  if (!starterNames.length || !subNames.length) return [];

  const getType = (name) => {
    const p = squad.find(s =>
      s.displayName === name ||
      `${s.firstName} ${s.lastName}`.trim() === name
    );
    return p?.playerType ?? 'Utility';
  };

  const nPitch = starterNames.length;
  const nBench = subNames.length;
  const nTotal = nPitch + nBench;

  const players = [...starterNames, ...subNames].map(name => ({
    name,
    type:       getType(name),
    isStarter:  starterNames.includes(name),
    isLocked:   (style === 'fullgame' || style === 'mixed') && lockedPlayers.includes(name),
    isPriority: (style === 'mixed') && priorityPlayers.includes(name),
  }));

  // ── Target computation (factor-based for priority/mixed) ──────────────────
  // slider 50 → factor 1.0 (equal/fair)
  // slider 70 → factor 2.5 (priority plays 2.5× rotation)
  // slider 90 → factor 4.0 (priority plays 4× rotation)
  const sliderFactor = (pct) => 1 + (pct - 50) * 3 / 40;

  const targetOf = (() => {
    if (style === 'fair') {
      const fair = nTotal > 0 ? (duration * nPitch) / nTotal : duration;
      return () => fair;
    }
    if (style === 'priority') {
      const factor = sliderFactor(starterPct);
      const denom  = nPitch * factor + nBench;
      const sT = denom > 0 ? Math.min(duration, duration * nPitch * factor / denom) : duration;
      const bT = nBench > 0 ? Math.max(0, (duration * nPitch - nPitch * sT) / nBench) : 0;
      return (p) => p.isStarter ? sT : bT;
    }
    if (style === 'fullgame') {
      const nLocked        = players.filter(p => p.isLocked).length;
      const effectivePitch = Math.max(0, nPitch - nLocked);
      const effectivePool  = nTotal - nLocked;
      const fair           = effectivePool > 0 ? (duration * effectivePitch) / effectivePool : 0;
      return (p) => p.isLocked ? duration : fair;
    }
    // mixed
    const nLockedOnPitch = players.filter(p => p.isLocked && p.isStarter).length;
    const effectivePitch = nPitch - nLockedOnPitch;
    const pPrio          = players.filter(p => p.isPriority && !p.isLocked);
    const pRot           = players.filter(p => !p.isLocked && !p.isPriority);
    const factor         = sliderFactor(starterPct);
    const denom          = pPrio.length * factor + pRot.length;
    let rotT  = denom > 0 ? (duration * effectivePitch) / denom : 0;
    let prioT = factor * rotT;
    if (prioT > duration) {
      prioT = duration;
      rotT  = pRot.length > 0 ? Math.max(0, duration * effectivePitch - pPrio.length * duration) / pRot.length : 0;
    }
    const fp = prioT, fr = rotT;
    return (p) => p.isLocked ? duration : p.isPriority ? fp : Math.max(0, fr);
  })();

  // ── Build swap pairs ───────────────────────────────────────────────────────
  // Bench: highest target first (they enter earliest, play most)
  const benchSorted = players
    .filter(p => !p.isStarter && targetOf(p) > 1)
    .sort((a, b) => targetOf(b) - targetOf(a));

  // Swappable starters: lowest target first (they exit earliest)
  const swappable = players
    .filter(p => p.isStarter && !p.isLocked)
    .sort((a, b) => targetOf(a) - targetOf(b));

  const usedOut = new Set();
  const pairs   = []; // { minute, out, in }
  const cap     = maxSubs > 0 ? maxSubs : Infinity;

  for (const incoming of benchSorted) {
    if (pairs.length >= cap) break;

    // Find the first compatible swappable starter
    for (let i = 0; i < swappable.length; i++) {
      if (usedOut.has(i)) continue;
      const candidate = swappable[i];

      // GK ↔ GK only
      if (candidate.type === 'Goalkeeper' && incoming.type !== 'Goalkeeper') continue;
      if (incoming.type  === 'Goalkeeper' && candidate.type !== 'Goalkeeper') continue;

      // Keep ≥1 defender on pitch
      if (candidate.type === 'Defender') {
        const defsLeft = swappable.filter((p, j) => !usedOut.has(j) && p !== candidate && p.type === 'Defender').length
          + players.filter(p => p.isLocked && p.isStarter && p.type === 'Defender').length;
        if (defsLeft < 1) continue;
      }
      // Keep ≥1 attacker on pitch
      if (candidate.type === 'Attacker') {
        const attsLeft = swappable.filter((p, j) => !usedOut.has(j) && p !== candidate && p.type === 'Attacker').length
          + players.filter(p => p.isLocked && p.isStarter && p.type === 'Attacker').length;
        if (attsLeft < 1) continue;
      }

      usedOut.add(i);
      // Optimal minute: bring on bench player when exactly their target time remains
      const optMinute = Math.max(1, Math.min(duration - 1, Math.round(duration - targetOf(incoming))));
      pairs.push({ minute: optMinute, out: candidate, in: incoming });
      break;
    }
  }

  // ── Distribute pairs across windows (≤2 per window by default) ──────────
  pairs.sort((a, b) => a.minute - b.minute);

  const subsPerStop = 2;
  const nGroups     = maxStops > 0 ? maxStops : Math.ceil(pairs.length / subsPerStop);
  const groups      = Array.from({ length: nGroups }, () => []);

  if (maxStops > 0) {
    // Use ALL stoppage windows — spread pairs as evenly as possible
    pairs.forEach((pair, i) => {
      groups[Math.min(nGroups - 1, Math.floor(i * nGroups / pairs.length))].push(pair);
    });
  } else {
    // No stoppage limit — cap at 2 per window
    pairs.forEach((pair, i) => groups[Math.floor(i / subsPerStop)].push(pair));
  }

  // Choose a minute for each group.
  // Without maxStops: work BACKWARDS from the last group's optimal minute so that
  // each earlier group is at least 10 min before the next, creating natural spread.
  const minWindow  = Math.max(10, Math.round(duration * 0.1));
  const windowMins = new Array(nGroups);

  if (maxStops > 0) {
    // Fixed evenly-spaced windows (user controls the timing)
    for (let i = 0; i < nGroups; i++) {
      windowMins[i] = Math.round(duration * (i + 1) / (nGroups + 1));
    }
  } else {
    // Each group's anchor = the latest optimal minute among its pairs
    for (let i = nGroups - 1; i >= 0; i--) {
      const anchor = groups[i].length > 0
        ? Math.max(...groups[i].map(p => p.minute))
        : Math.round(duration * 0.65);
      windowMins[i] = i === nGroups - 1
        ? Math.min(duration - 1, anchor)
        : Math.min(windowMins[i + 1] - 10, anchor);
      windowMins[i] = Math.max(minWindow, windowMins[i]);
    }
    // Guarantee strictly ascending order after min-window clamping
    for (let i = 1; i < nGroups; i++) {
      if (windowMins[i] <= windowMins[i - 1]) windowMins[i] = windowMins[i - 1] + 10;
      windowMins[i] = Math.min(windowMins[i], duration - 1);
    }
  }

  groups.forEach((group, i) => group.forEach(p => { p.minute = windowMins[i]; }));

  // ── Group by minute and emit events ───────────────────────────────────────
  const byMinute = {};
  pairs.forEach(({ minute, out, in: inn }) => {
    if (!byMinute[minute]) byMinute[minute] = { out: [], in: [] };
    byMinute[minute].out.push(out.name);
    byMinute[minute].in.push(inn.name);
  });

  return Object.entries(byMinute)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([minute, { out, in: ins }]) => ({
      id:         genId(),
      minute:     parseInt(minute),
      playersOut: out,
      playersIn:  ins,
      notes:      t('planner.autoNote'),
      completed:  false,
    }));
}
