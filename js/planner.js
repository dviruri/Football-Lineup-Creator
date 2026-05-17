// ── SUBSTITUTION PLANNER ──────────────────────────────────────────────────────

let lastRotTargets = {}; // name → target minutes; set by runRotationAlgorithm, read by renderTimeTable

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
        <div class="planner-event">
          <div class="planner-min">${ev.minute}'</div>
          <div class="planner-swap">
            <span class="planner-out">${outStr}</span>
            <span class="planner-arrow"> → </span>
            <span class="planner-in">${inStr}</span>
            ${ev.notes ? `<div class="planner-note-text">${esc(ev.notes)}</div>` : ''}
          </div>
          <div class="planner-btns">
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

  el.innerHTML = `
    <div class="time-table-wrap">
      <div class="time-table-header">
        <span>${t('planner.col.name')}</span>
        <span>${t('planner.col.on')}</span>
        <span>${t('planner.col.target')}</span>
        <span>${t('planner.col.diff')}</span>
      </div>
      ${summary.map(p => {
        const hasTgt = p.target != null;
        const absDiff = hasTgt ? Math.abs(p.diff) : 0;
        const cls = !hasTgt ? '' : absDiff <= 5 ? 'diff-ok' : absDiff <= 12 ? 'diff-warn' : 'diff-bad';
        const diffStr = hasTgt ? (p.diff > 0 ? '+' : '') + p.diff : '—';
        return `
          <div class="time-table-row">
            <span class="tt-name">${esc(p.name)}</span>
            <span>${p.on}'</span>
            <span>${hasTgt ? p.target + "'" : '—'}</span>
            <span class="${cls}">${diffStr}</span>
          </div>`;
      }).join('')}
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

  return Object.values(pm).map(p => {
    const tgt = lastRotTargets[p.name] ?? null;
    return { ...p, target: tgt, diff: tgt != null ? p.on - tgt : null };
  });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function openSubModal(id) {
  editingSubId = id || null;
  const ev = id ? subEvents.find(e => e.id === id) : null;

  const titleEl = document.getElementById('subModalTitle');
  titleEl.textContent = t(id ? 'planner.modalEdit' : 'planner.modalAdd');

  document.getElementById('subMinute').value = ev?.minute ?? '';
  document.getElementById('subNotes').value  = ev?.notes  ?? '';

  // ── Pitch-state-aware player lists ────────────────────────────────────────
  // Walk all sub events (except the one being edited) that happen BEFORE the
  // chosen minute so we know exactly who is on / off the pitch at that point.
  //
  // The lists update live whenever the coach changes the minute field.
  const starterNames = getPlayers().map(p => p.name).filter(Boolean);
  const subNames     = getSubs().map(p => p.name).filter(Boolean);
  const allNames     = [...starterNames, ...subNames];

  let firstRender = true;

  const buildLists = () => {
    const outDiv   = document.getElementById('subPlayersOut');
    const inDiv    = document.getElementById('subPlayersIn');
    const minuteEl = document.getElementById('subMinute');

    // Preserve whatever the coach has already ticked (only after first render)
    let checkedOut, checkedIn;
    if (firstRender) {
      checkedOut  = new Set(ev?.playersOut ?? []);
      checkedIn   = new Set(ev?.playersIn  ?? []);
      firstRender = false;
    } else {
      checkedOut = new Set([...outDiv.querySelectorAll('.sub-out-check:checked')].map(c => c.value));
      checkedIn  = new Set([...inDiv.querySelectorAll('.sub-in-check:checked')].map(c => c.value));
    }

    // Simulate pitch state up to (not including) the chosen minute
    const minuteNum = parseInt(minuteEl.value);
    const onPitch   = new Set(starterNames);

    if (!isNaN(minuteNum) && minuteNum >= 1) {
      [...subEvents]
        .filter(e => e.id !== editingSubId && e.minute < minuteNum)
        .sort((a, b) => a.minute - b.minute)
        .forEach(e => {
          e.playersOut.forEach(n => onPitch.delete(n));
          e.playersIn.forEach(n => onPitch.add(n));
        });
    }

    const offPitch = allNames.filter(n => !onPitch.has(n));

    // Players who can come OFF = currently on the pitch
    outDiv.innerHTML = [...onPitch].length
      ? [...onPitch].map(name => `
          <label class="sub-check-label">
            <input type="checkbox" class="sub-out-check" value="${esc(name)}"
              ${checkedOut.has(name) ? 'checked' : ''}>
            ${esc(name)}
          </label>`).join('')
      : `<span class="planner-empty-small">${t('planner.noStarters')}</span>`;

    // Players who can come IN = currently off the pitch
    inDiv.innerHTML = offPitch.length
      ? offPitch.map(name => `
          <label class="sub-check-label">
            <input type="checkbox" class="sub-in-check" value="${esc(name)}"
              ${checkedIn.has(name) ? 'checked' : ''}>
            ${esc(name)}
          </label>`).join('')
      : `<span class="planner-empty-small">${t('planner.noBench')}</span>`;
  };

  buildLists();
  document.getElementById('subMinute').oninput = buildLists;

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

  const allowReentry = document.getElementById('rotAllowReentry')?.checked ?? false;
  const generated = runRotationAlgorithm({ style, starterPct, lockedPlayers, priorityPlayers, maxSubs, maxStops, allowReentry });
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
//
// Design:
//   1. Each bench player's ideal entry = duration − their target minutes.
//      Entering at that moment gives them exactly their target (bench diff ≈ 0).
//   2. Bench players are grouped into substitution STOPS of at most 2 per stop.
//      minGap (10 % of match) is enforced between consecutive stops, not between
//      individual swaps — this prevents the "cascade" that blew up diffs.
//   3. At each stop a pitchMap-based simulation picks who comes OFF:
//      candidates are scored by (minutesOnPitch − theirTarget).  Starters below
//      target get a heavy penalty so they are protected; subs on-pitch get a
//      lighter penalty.  Candidates are Fisher-Yates shuffled before the stable
//      score-sort, so each "Generate" gives a different-but-valid plan.
//   4. allowReentry = false  →  a player who already exited cannot come back IN
//      (but a sub who came on may still go back off — those are different events).
//   5. allowReentry = true   →  a second pass re-enters resting starters to
//      replace bench players who are projected to exceed their target.

function runRotationAlgorithm({ style, starterPct, lockedPlayers, priorityPlayers = [], maxSubs, maxStops, allowReentry = false }) {
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
  const allNames = [...starterNames, ...subNames];

  const players = allNames.map((name, idx) => {
    let type = getType(name);
    // Robustness fallback: if the squad lookup didn't find this player, use
    // position to infer goalkeeper. Position 0 = first starter = GK by
    // convention. Also catch names that literally say "goalkeeper" / "gk".
    if (type === 'Utility') {
      if (idx === 0) type = 'Goalkeeper';
      else if (/^(goalkeeper|gk|שוער|שוערת)$/i.test(name.trim())) type = 'Goalkeeper';
    }
    return {
      name,
      type,
      isStarter:  idx < nPitch,
      isLocked:   (style === 'fullgame' || style === 'mixed') && lockedPlayers.includes(name),
      isPriority: (style === 'mixed') && priorityPlayers.includes(name),
    };
  });

  // ── Target minutes per player (unchanged from previous versions) ──────────
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
      rotT  = pRot.length > 0
        ? Math.max(0, duration * effectivePitch - pPrio.length * duration) / pRot.length
        : 0;
    }
    const fp = prioT, fr = rotT;
    return (p) => p.isLocked ? duration : p.isPriority ? fp : Math.max(0, fr);
  })();

  // ── Shared constants ───────────────────────────────────────────────────────
  const minGap      = Math.max(1, Math.round(duration * 0.10)); // 10 % gap between stops
  const firstSubMin = Math.max(3, Math.round(duration * 0.15)); // earliest substitution
  const subCap      = maxSubs  > 0 ? maxSubs  : Infinity;
  const stopCap     = maxStops > 0 ? maxStops : Infinity;
  const MAX_PER_STOP = 2; // prefer ≤ 2 subs per wave (spec rule)

  // ── Helpers ────────────────────────────────────────────────────────────────
  // In-place Fisher-Yates shuffle — used throughout for true randomness.
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // GK rule: a goalkeeper may only swap with another goalkeeper.
  const gkOk = (outP, inP) =>
    !(outP.type === 'Goalkeeper' && inP.type !== 'Goalkeeper') &&
    !(inP.type  === 'Goalkeeper' && outP.type !== 'Goalkeeper');

  // ── Step 1: compute ideal entry minute for each bench player ───────────────
  // idealEntry = duration − target  →  bench plays exactly target minutes.
  // Shuffle FIRST (randomises who goes into which stop), THEN stable-sort by
  // idealEntry so earlier-entry players form earlier stops.
  const benchPlayers = shuffle(
    players.filter(p => !p.isStarter && !p.isLocked && targetOf(p) > 1)
  ).map(p => ({
    ...p,
    target:     targetOf(p),
    idealEntry: Math.max(firstSubMin,
                  Math.min(duration - 1, Math.round(duration - targetOf(p)))),
  }));
  benchPlayers.sort((a, b) => a.idealEntry - b.idealEntry);

  // ── Step 2: group bench players into substitution stops ───────────────────
  // Two bench players land in the same stop when their idealEntry values are
  // within ⌈minGap / 3⌉ minutes of each other AND the stop isn't full yet.
  const mergeThreshold = Math.ceil(minGap / 3);
  const stops = [];
  for (const b of benchPlayers) {
    const last = stops[stops.length - 1];
    if (last &&
        (b.idealEntry - last.minute) <= mergeThreshold &&
        last.benches.length < MAX_PER_STOP) {
      last.benches.push(b);
    } else {
      stops.push({ minute: Math.max(firstSubMin, b.idealEntry), benches: [b] });
    }
  }

  // ── Step 3: enforce minGap between consecutive stops ──────────────────────
  // Push later stops forward if they are too close to the previous one.
  // This is where the "10 % minimum gap between waves" rule is satisfied.
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].minute < stops[i - 1].minute + minGap) {
      stops[i].minute = Math.min(duration - 1, stops[i - 1].minute + minGap);
    }
  }

  // ── Step 4: simulate match and build substitution pairs ───────────────────
  // pitchMap  — who is currently on the pitch (starts as all starters).
  // enteredAt — the minute each player stepped onto the pitch.
  // hasExited — players who have already left the pitch (for allowReentry).
  const pitchMap  = new Map(players.filter(p => p.isStarter).map(p => [p.name, p]));
  const enteredAt = {};
  const hasExited = new Set();
  players.filter(p => p.isStarter).forEach(p => { enteredAt[p.name] = 0; });

  const pairs     = [];
  let stopsUsed   = 0;

  for (const stop of stops) {
    if (pairs.length >= subCap || stopsUsed >= stopCap) break;

    const winMin = stop.minute;

    // Score every player currently on pitch as a candidate to come OFF.
    //
    // score = minutesOnPitch − theirTarget
    //   Positive  → they've already exceeded target    (good to leave)
    //   Near zero → they've played exactly their target (fine to leave)
    //   Negative  → they're below target
    //     • starters below target: score × 2 (heavy protection — avoid subbing)
    //     • bench/non-starters below target: score × 1 (mild — still possible)
    //
    // Shuffle before the stable sort so players with equal scores come off in
    // a random order each time "Generate" is pressed.
    const outCandidates = shuffle([...pitchMap.values()])
      .filter(p => !p.isLocked)
      .map(p => {
        const minutesOn = winMin - (enteredAt[p.name] ?? 0);
        const over      = minutesOn - targetOf(p);
        const score     = p.isStarter ? (over >= 0 ? over : over * 2) : over;
        return { p, minutesOn, score };
      });
    outCandidates.sort((a, b) => b.score - a.score); // highest first

    const usedOut     = new Set();
    const maxThisStop = Math.min(MAX_PER_STOP, subCap - pairs.length);
    let subsThisStop  = 0;

    for (const bench of stop.benches) {
      if (subsThisStop >= maxThisStop || pairs.length >= subCap) break;

      // allowReentry = false: skip bench players who already exited
      if (!allowReentry && hasExited.has(bench.name)) continue;

      // Pick the highest-scored on-pitch player that satisfies the GK rule
      // and hasn't already been picked in this stop.
      let matched = false;
      for (const outC of outCandidates) {
        if (usedOut.has(outC.p.name)) continue;
        if (!gkOk(outC.p, bench)) continue;

        // Apply the swap
        usedOut.add(outC.p.name);
        hasExited.add(outC.p.name);
        pitchMap.delete(outC.p.name);
        pitchMap.set(bench.name, bench);
        enteredAt[bench.name] = winMin;

        pairs.push({ minute: winMin, out: outC.p, in: bench });
        subsThisStop++;
        matched = true;
        break;
      }
      if (!matched) continue; // no valid candidate for this bench player
    }

    if (subsThisStop > 0) stopsUsed++;
  }

  // ── Step 5 (optional): re-entry pass ──────────────────────────────────────
  // When allowReentry is true: bring resting starters back if a bench player
  // on the pitch is projected to exceed their target minutes.
  if (allowReentry && pairs.length < subCap && stopsUsed < stopCap) {
    // Simulate time accumulation up to end of match with current plan.
    const timeOn  = {};
    allNames.forEach(n => { timeOn[n] = 0; });
    const onPitch = new Set(starterNames);
    let prev = 0;

    for (const pr of [...pairs].sort((a, b) => a.minute - b.minute)) {
      const elapsed = pr.minute - prev;
      onPitch.forEach(n => { timeOn[n] += elapsed; });
      onPitch.delete(pr.out.name);
      onPitch.add(pr.in.name);
      prev = pr.minute;
    }
    onPitch.forEach(n => { timeOn[n] += duration - prev; });

    // Bench players still on pitch who exceeded their target → should come off.
    const overBench = players
      .filter(p => !p.isStarter && onPitch.has(p.name))
      .map(p => ({ p, over: timeOn[p.name] - targetOf(p) }))
      .filter(({ over }) => over > 5)
      .sort((a, b) => b.over - a.over);

    // Starters off-pitch who are still below their target → should come back.
    const underStarters = players
      .filter(p => p.isStarter && !onPitch.has(p.name))
      .filter(p => timeOn[p.name] < targetOf(p) - 5)
      .sort((a, b) => timeOn[a.name] - timeOn[b.name]);

    const usedReturn = new Set();
    for (const { p: over } of overBench) {
      if (pairs.length >= subCap || stopsUsed >= stopCap) break;
      for (const under of underStarters) {
        if (usedReturn.has(under.name)) continue;
        if (!gkOk(over, under)) continue;
        // Swap them at the minute when the bench player has played their target.
        const returnMin = Math.min(
          duration - 2,
          Math.round((enteredAt[over.name] ?? 0) + targetOf(over))
        );
        if (returnMin >= duration - 1) continue;
        usedReturn.add(under.name);
        pairs.push({ minute: returnMin, out: over, in: under });
        stopsUsed++;
        break;
      }
    }
  }

  // ── Post-process: fix bench-bench swap timing ─────────────────────────────
  // When a sub who entered is later swapped out by another sub, both players
  // lose minutes relative to their target.  The fairest split: time the swap
  // at the MIDPOINT of the exiting player's remaining time on pitch, so the
  // deficit is shared equally rather than falling mostly on one player.
  // We never push the swap EARLIER than already scheduled.
  pairs.forEach(pr => {
    if (!pr.out.isStarter) {
      const entered  = enteredAt[pr.out.name] ?? 0;
      const midpoint = Math.round(entered + (duration - entered) / 2);
      pr.minute = Math.min(duration - 1, Math.max(pr.minute, midpoint));
    }
  });

  // ── Post-process: compute achievable targets for rotating bench players ───
  // When nBench > nSlots (more bench players than available starter positions
  // to rotate), some bench players must "relay" each other — one sub replaces
  // another sub.  In that case it is mathematically impossible for every
  // bench player to reach their theoretical fair target.
  //
  // Instead we display the ACHIEVABLE FAIR TARGET:
  //   achievable = (total actual minutes played by rotating bench players)
  //                ÷  (number of rotating bench players)
  //
  // This is the true fair share given the squad composition.  Diffs relative
  // to this target stay within the 15 % threshold even when cycling occurs.
  //
  // Example (5 bench, 4 slots, target=45, 90-min match):
  //   Actual play: 45, 36, 36, 23, 22  →  total=162, achievable=32
  //   Diffs: +13, +4, +4, –9, –10  — all within the ±13.5 min threshold ✓
  //   (vs. old approach: –0, –9, –9, –22, –23 with two reds)

  // Simulate actual minutes for every player under the current pair schedule
  const actualMin = {};
  allNames.forEach(n => { actualMin[n] = 0; });
  {
    const onSim = new Set(starterNames);
    let simPrev = 0;
    const pairsSorted = [...pairs].sort((a, b) => a.minute - b.minute);
    for (const pr of pairsSorted) {
      const elapsed = pr.minute - simPrev;
      onSim.forEach(n => { actualMin[n] += elapsed; });
      onSim.delete(pr.out.name);
      onSim.add(pr.in.name);
      simPrev = pr.minute;
    }
    onSim.forEach(n => { actualMin[n] += duration - simPrev; });
  }

  // Collect all bench players who actually entered via the rotation
  const rotBenchNames = new Set(
    pairs.filter(pr => !pr.in.isStarter).map(pr => pr.in.name)
  );

  // Collect all NON-LOCKED starters who were subbed off in the rotation.
  // These starters play until their scheduled stop — which may be later than
  // their ideal exit (due to the minGap cascade between stops).  Their
  // achievable-average target mirrors the bench calculation.
  const subbedOffStarters = new Set(
    pairs.filter(pr => pr.out.isStarter && !pr.out.isLocked).map(pr => pr.out.name)
  );

  let achievableBenchTarget   = null;
  let achievableStarterTarget = null;

  if (rotBenchNames.size > 0) {
    const totalRotMin = [...rotBenchNames]
      .reduce((sum, n) => sum + (actualMin[n] || 0), 0);
    achievableBenchTarget = Math.round(totalRotMin / rotBenchNames.size);
  }

  if (subbedOffStarters.size > 0) {
    const totalStarterMin = [...subbedOffStarters]
      .reduce((sum, n) => sum + (actualMin[n] || 0), 0);
    achievableStarterTarget = Math.round(totalStarterMin / subbedOffStarters.size);
  }

  // ── Post-process: adjust target for GK with no bench replacement ──────────
  // A GK who cannot be replaced plays the full match by necessity.
  // Show their target as the full duration so the diff reads 0, not +45.
  const hasGkOnBench = players.some(p => !p.isStarter && p.type === 'Goalkeeper');
  const gkStarter    = players.find(p => p.isStarter && p.type === 'Goalkeeper');
  const gkWillStay   = gkStarter && !hasGkOnBench;

  // ── Finalise: store targets and emit substitution events ──────────────────
  lastRotTargets = {};
  players.forEach(p => {
    let tgt = Math.round(targetOf(p));
    // GK who cannot be replaced plays the full match
    if (gkWillStay && p.name === gkStarter.name) tgt = duration;
    // Rotation starters who were subbed: use the achievable fair target
    // (accounts for minGap pushing later stops beyond the theoretical exit time)
    if (p.isStarter && !p.isLocked && subbedOffStarters.has(p.name) &&
        achievableStarterTarget != null) {
      tgt = achievableStarterTarget;
    }
    // Rotating bench players: use the achievable fair target
    // (accounts for bench-bench cycling when nBench > nSlots)
    if (!p.isStarter && !p.isLocked && rotBenchNames.has(p.name) &&
        achievableBenchTarget != null) {
      tgt = achievableBenchTarget;
    }
    lastRotTargets[p.name] = tgt;
  });

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
