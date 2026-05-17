// ── MATCH-DAY MODE ──────────────────────────────────────────────────────────
//
// A focused, touch-friendly view for use during the actual match.
// Manages a running clock, shows who is currently on/off the pitch
// (reflecting completed substitutions only), highlights the next planned
// substitution, and lets the coach tick subs as done.
//
// Timer state lives in memory only — navigating away and back keeps the
// elapsed time running without needing localStorage.

const MD_NOTE_KEY = 'flc_md_note';

let mdElapsedSec = 0;   // total seconds elapsed since last reset
let mdRunning    = false;
let mdInterval   = null;

// ── Navigation ───────────────────────────────────────────────────────────────

function goToMatchDay() {
  document.getElementById('page-match').classList.remove('active');
  document.getElementById('page-matchday').classList.add('active');

  // Sync match title in topbar
  const title = document.getElementById('matchTitle')?.value?.trim() || '';
  const titleEl = document.getElementById('mdMatchTitle');
  if (titleEl) titleEl.textContent = title;

  // Restore saved match note
  const noteEl = document.getElementById('mdNote');
  if (noteEl) noteEl.value = localStorage.getItem(MD_NOTE_KEY) || '';

  mdRenderAll();
}

function goToMatchFromDay() {
  document.getElementById('page-matchday').classList.remove('active');
  document.getElementById('page-match').classList.add('active');
}

// ── Timer ────────────────────────────────────────────────────────────────────

function mdToggleTimer() {
  mdRunning ? mdPauseTimer() : mdStartTimer();
}

function mdStartTimer() {
  if (mdRunning) return;
  mdRunning = true;

  const btn = document.getElementById('mdToggleBtn');
  if (btn) {
    btn.innerHTML = `⏸ <span>${t('matchday.pause')}</span>`;
    btn.classList.add('md-running');
  }

  mdInterval = setInterval(() => {
    mdElapsedSec++;
    mdUpdateClock();

    // Auto-pause at the half-time boundary for multi-period matches
    const dur  = parseInt(document.getElementById('matchDuration')?.value) || 90;
    const pds  = parseInt(document.getElementById('matchPeriods')?.value)  || 2;
    if (pds > 1 && mdElapsedSec === Math.round((dur / pds) * 60)) {
      mdPauseTimer();
      showToast(t('matchday.halfTimePause'));
    }
  }, 1000);
}

function mdPauseTimer() {
  mdRunning = false;
  clearInterval(mdInterval);

  const btn = document.getElementById('mdToggleBtn');
  if (btn) {
    btn.innerHTML = `▶ <span>${t('matchday.resume')}</span>`;
    btn.classList.remove('md-running');
  }
}

function mdResetTimer() {
  mdPauseTimer();
  mdElapsedSec = 0;

  const btn = document.getElementById('mdToggleBtn');
  if (btn) {
    btn.innerHTML = `▶ <span>${t('matchday.start')}</span>`;
  }
  mdUpdateClock();
}

function mdUpdateClock() {
  const dur  = parseInt(document.getElementById('matchDuration')?.value) || 90;
  const pds  = parseInt(document.getElementById('matchPeriods')?.value)  || 2;
  const halfMin = Math.round(dur / pds);          // minutes per period

  const mm = Math.floor(mdElapsedSec / 60);
  const ss = mdElapsedSec % 60;
  const timeStr = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');

  // ── Clock display ────────────────────────────────────────────────────────
  const clockEl = document.getElementById('mdClock');
  if (clockEl) {
    clockEl.textContent = timeStr;
    clockEl.className = 'md-clock';
    if      (mm >= dur)             clockEl.classList.add('md-overtime');
    else if (mdRunning)             clockEl.classList.add('md-running');
  }

  // ── Period badge ─────────────────────────────────────────────────────────
  const badgeEl = document.getElementById('mdPeriodBadge');
  if (badgeEl) {
    if      (mm >= dur)               badgeEl.textContent = t('matchday.fullTime');
    else if (pds > 1 && mm >= halfMin) badgeEl.textContent = t('matchday.period2');
    else                               badgeEl.textContent = pds > 1 ? t('matchday.period1') : t('matchday.period1only');
  }

  // ── Minute label ─────────────────────────────────────────────────────────
  const minEl = document.getElementById('mdMinuteLabel');
  if (minEl) minEl.textContent = t('matchday.minuteN', mm);

  // Refresh urgency state of next-sub card without full re-render
  mdUpdateNextSubCard();
}

// ── Live pitch state (completed subs only) ────────────────────────────────────
// Returns { onPitch, offPitch } arrays of { name, number, isGK }.

function mdLivePitchState() {
  const on  = new Map(); // name → { name, number, isGK }
  const off = new Map();

  getPlayers().forEach((p, i) => {
    if (!p.name) return;
    on.set(p.name, { name: p.name, number: String(p.number || ''), isGK: i === 0 });
  });
  getSubs().forEach(p => {
    if (!p.name) return;
    off.set(p.name, { name: p.name, number: String(p.number || ''), isGK: false });
  });

  // Walk only COMPLETED events in time order
  [...subEvents]
    .filter(ev => ev.completed)
    .sort((a, b) => a.minute - b.minute)
    .forEach(ev => {
      ev.playersOut.forEach(n => {
        const p = on.get(n);
        if (p) { on.delete(n); off.set(n, p); }
      });
      ev.playersIn.forEach(n => {
        const p = off.get(n);
        if (p) { off.delete(n); on.set(n, { ...p }); }
      });
    });

  return { onPitch: [...on.values()], offPitch: [...off.values()] };
}

// ── Next pending substitution ─────────────────────────────────────────────────

function mdNextPendingSub() {
  return [...subEvents]
    .filter(ev => !ev.completed)
    .sort((a, b) => a.minute - b.minute)[0] || null;
}

function mdMarkNextSubDone() {
  const ev = mdNextPendingSub();
  if (!ev) return;
  ev.completed = true;
  savePlanner();
  renderPlanner();   // keep the match-editor plan in sync
  mdRenderAll();
  showToast(t('matchday.subDone'));
}

function mdToggleSubDone(id) {
  const ev = subEvents.find(e => e.id === id);
  if (!ev) return;
  ev.completed = !ev.completed;
  savePlanner();
  renderPlanner();
  mdRenderAll();
}

// ── Formation slots ───────────────────────────────────────────────────────────
// Computes which player is currently occupying each starter slot,
// accounting for all completed substitution events.

function mdGetFormationRows(outfieldCount) {
  const formStr = document.getElementById('customFormInput')?.value?.trim() || '';
  const parsed  = formStr.split('-').map(Number).filter(x => !isNaN(x) && x > 0);
  if (parsed.length && parsed.reduce((a, b) => a + b, 0) === outfieldCount) return parsed;
  // Fallback: evenly distributed rows
  if (outfieldCount <= 4) return [outfieldCount];
  if (outfieldCount <= 7) { const h = Math.floor(outfieldCount / 2); return [h, outfieldCount - h]; }
  const a = Math.floor(outfieldCount / 3), b = Math.floor(outfieldCount / 3);
  return [a, b, outfieldCount - a - b];
}

function mdGetFormationSlots() {
  const allPlayers = [...getPlayers(), ...getSubs()];
  const numOf = name => String(allPlayers.find(p => p.name === name)?.number || '');

  const slots = getPlayers()
    .filter(p => p.name)
    .map((p, i) => ({ isGK: i === 0, current: p.name, number: String(p.number || '') }));

  [...subEvents]
    .filter(ev => ev.completed)
    .sort((a, b) => a.minute - b.minute)
    .forEach(ev => {
      ev.playersOut.forEach((outName, i) => {
        const inName = ev.playersIn[i];
        if (!inName) return;
        const slot = slots.find(s => s.current === outName);
        if (slot) { slot.current = inName; slot.number = numOf(inName); }
      });
    });

  return slots;
}

// ── Live pitch visual (reuses the full match canvas renderer) ─────────────────

function mdRenderPitch() {
  const mdCanvas = document.getElementById('mdPitchCanvas');
  if (!mdCanvas || typeof renderToCanvas !== 'function') return;
  renderToCanvas(mdCanvas, mdGetFormationSlots());
}

// ── Note persistence ──────────────────────────────────────────────────────────

function mdSaveNote() {
  const val = document.getElementById('mdNote')?.value || '';
  try { localStorage.setItem(MD_NOTE_KEY, val); } catch(e) {}
}

// ── Render ────────────────────────────────────────────────────────────────────

function mdRenderAll() {
  mdRenderLineup();
  mdRenderPitch();
  mdUpdateNextSubCard();
  mdRenderSubsList();
  mdUpdateClock();
}

function mdRenderLineup() {
  const { onPitch, offPitch } = mdLivePitchState();

  const chip = (p, gkClass) => `
    <div class="md-chip${gkClass ? ' md-chip-gk' : ''}">
      <span class="md-chip-num">${esc(p.number)}</span>
      <span>${esc(p.name)}</span>
    </div>`;
  const empty = `<div class="md-empty-note">${t('matchday.noPlayers')}</div>`;

  // On-pitch chips (only if the old-layout element still exists)
  const onEl = document.getElementById('mdOnPitch');
  if (onEl) onEl.innerHTML = onPitch.length ? onPitch.map(p => chip(p, p.isGK)).join('') : empty;

  // Bench chips (always present)
  const offEl = document.getElementById('mdBench');
  if (offEl) offEl.innerHTML = offPitch.length ? offPitch.map(p => chip(p, false)).join('') : empty;
}

function mdUpdateNextSubCard() {
  const card = document.getElementById('mdNextSubCard');
  if (!card) return;

  const next = mdNextPendingSub();
  if (!next) { card.style.display = 'none'; return; }
  card.style.display = '';

  const currentMin = Math.floor(mdElapsedSec / 60);
  const minsLeft   = next.minute - currentMin;
  const isUrgent   = minsLeft >= 0 && minsLeft <= 2;
  const isPast     = minsLeft < 0;

  card.className = 'md-next-card' + (isPast ? ' md-past' : isUrgent ? ' md-urgent' : '');

  const minEl = document.getElementById('mdNextSubMin');
  if (minEl) minEl.textContent = `${next.minute}'`;

  const outHtml = next.playersOut.map(n => `<span class="planner-out">${esc(n)}</span>`).join(', ');
  const inHtml  = next.playersIn.map(n => `<span class="planner-in">${esc(n)}</span>`).join(', ');

  const swapEl = document.getElementById('mdNextSubSwap');
  if (swapEl) {
    swapEl.innerHTML = `${outHtml} → ${inHtml}` +
      (next.notes ? `<div class="md-next-note">${esc(next.notes)}</div>` : '');
  }
}

function mdRenderSubsList() {
  const el = document.getElementById('mdSubsList');
  if (!el) return;

  const sorted = [...subEvents].sort((a, b) => a.minute - b.minute);
  if (!sorted.length) {
    el.innerHTML = `<div class="md-empty-note">${t('planner.empty')}</div>`;
    return;
  }

  const next = mdNextPendingSub();

  el.innerHTML = sorted.map(ev => {
    const isNext = !ev.completed && next?.id === ev.id;
    const out = ev.playersOut.join(', ') || '—';
    const inp = ev.playersIn.join(', ')  || '—';
    return `
      <div class="md-sub-row${ev.completed ? ' md-done' : ''}${isNext ? ' md-is-next' : ''}">
        <span class="md-sub-badge">${ev.minute}'</span>
        <div class="md-sub-swap-text">
          <span class="planner-out">${esc(out)}</span> → <span class="planner-in">${esc(inp)}</span>
          ${ev.notes ? `<div class="md-sub-note">${esc(ev.notes)}</div>` : ''}
        </div>
        <button class="md-tick-btn" onclick="mdToggleSubDone('${ev.id}')">
          ${ev.completed ? '↩' : '✓'}
        </button>
      </div>`;
  }).join('');
}
