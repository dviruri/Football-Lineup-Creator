// ── MATCH-DAY MODE ──────────────────────────────────────────────────────────
//
// A focused, touch-friendly view for use during the actual match.
// Manages a running clock, shows who is currently on/off the pitch
// (reflecting completed substitutions only), highlights the next planned
// substitution, and lets the coach tick subs as done.
//
// Timer state lives in memory only — navigating away and back keeps the
// elapsed time running without needing localStorage.

const MD_NOTE_KEY  = 'flc_md_note';
const MD_GOALS_KEY = 'flc_md_goals';

let mdElapsedSec = 0;   // total seconds elapsed since last reset
let mdRunning    = false;
let mdInterval   = null;
let mdGoals          = [];  // { id, minute, team:'us'|'them', scorer, assister }
let mdSelectedScorer = '';
let mdSelectedAssist = '';

// ── Navigation ───────────────────────────────────────────────────────────────

function goToMatchDay() {
  document.getElementById('page-match').classList.remove('active');
  document.getElementById('page-matchday').classList.add('active');

  // ── Fresh start every time ──────────────────────────────────────────────
  // Reset timer
  mdPauseTimer();
  mdElapsedSec = 0;
  const toggleBtn = document.getElementById('mdToggleBtn');
  if (toggleBtn) toggleBtn.innerHTML = `▶ <span>${t('matchday.start')}</span>`;

  // Reset goals
  mdGoals = [];
  try { localStorage.removeItem(MD_GOALS_KEY); } catch(e) {}

  // Reset substitutions — remove manual subs, mark planned ones as pending
  subEvents = subEvents.filter(ev => !ev.id.startsWith('md_'));
  subEvents.forEach(ev => { ev.completed = false; });
  savePlanner();
  renderPlanner();

  // Reset match note
  const noteEl = document.getElementById('mdNote');
  if (noteEl) { noteEl.value = ''; localStorage.removeItem(MD_NOTE_KEY); }
  // ────────────────────────────────────────────────────────────────────────

  // Sync match title in topbar
  const title = document.getElementById('matchTitle')?.value?.trim() || '';
  const titleEl = document.getElementById('mdMatchTitle');
  if (titleEl) titleEl.textContent = title;

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

function mdOpenJump() {
  const panel = document.getElementById('mdJumpPanel');
  if (!panel) return;
  panel.style.display = 'flex';
  const inp = document.getElementById('mdJumpMin');
  if (inp) { inp.value = Math.floor(mdElapsedSec / 60); inp.select(); }
}

function mdCloseJump() {
  const panel = document.getElementById('mdJumpPanel');
  if (panel) panel.style.display = 'none';
}

function mdConfirmJump() {
  const inp = document.getElementById('mdJumpMin');
  const min = Math.max(0, parseInt(inp?.value) || 0);
  mdElapsedSec = min * 60;
  mdUpdateClock();
  mdCloseJump();
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

// ── Manual substitution ───────────────────────────────────────────────────────

function mdOpenManualSub() {
  const { onPitch, offPitch } = mdLivePitchState();

  const chip = (p, cls) =>
    `<label class="sub-check-label">
       <input type="checkbox" class="${cls}" value="${esc(p.name)}">
       <span style="color:#888;min-width:20px;display:inline-block;font-size:0.8rem;">${esc(p.number)}</span>
       ${esc(p.name)}
     </label>`;
  const empty = `<span class="planner-empty-small">${t('matchday.noPlayers')}</span>`;

  const outDiv = document.getElementById('mdSubOut');
  const inDiv  = document.getElementById('mdSubIn');
  if (!outDiv || !inDiv) return;

  outDiv.innerHTML = onPitch.length  ? onPitch.map(p  => chip(p, 'md-sub-out-check')).join('') : empty;
  inDiv.innerHTML  = offPitch.length ? offPitch.map(p => chip(p, 'md-sub-in-check')).join('')  : empty;

  document.getElementById('mdSubMinute').value = Math.floor(mdElapsedSec / 60);
  document.getElementById('mdSubModal').style.display = 'flex';
}

function mdConfirmManualSub() {
  const outDiv = document.getElementById('mdSubOut');
  const inDiv  = document.getElementById('mdSubIn');
  const minute = Math.max(0, parseInt(document.getElementById('mdSubMinute')?.value) || Math.floor(mdElapsedSec / 60));

  const playersOut = [...outDiv.querySelectorAll('.md-sub-out-check:checked')].map(c => c.value);
  const playersIn  = [...inDiv.querySelectorAll('.md-sub-in-check:checked')].map(c => c.value);

  if (!playersOut.length || !playersIn.length) {
    showToast(t('matchday.selectWarning'));
    return;
  }

  subEvents.push({
    id:        'md_' + Date.now(),
    minute,
    playersOut,
    playersIn,
    notes:     t('matchday.manualSub'),
    completed: true,
  });

  savePlanner();
  renderPlanner();
  document.getElementById('mdSubModal').style.display = 'none';
  mdRenderAll();
  showToast(t('matchday.subDone'));
}

// ── Goal tracking ─────────────────────────────────────────────────────────────

function mdOurScore()   { return mdGoals.filter(g => g.team === 'us').length; }
function mdTheirScore() { return mdGoals.filter(g => g.team === 'them').length; }

function mdLoadGoals() {
  try { mdGoals = JSON.parse(localStorage.getItem(MD_GOALS_KEY) || '[]'); } catch(e) { mdGoals = []; }
}

function mdSaveGoals() {
  try { localStorage.setItem(MD_GOALS_KEY, JSON.stringify(mdGoals)); } catch(e) {}
}

function mdOpenGoalModal(team) {
  const isUs   = team === 'us';
  const minute = Math.floor(mdElapsedSec / 60);

  mdSelectedScorer = '';
  mdSelectedAssist = '';

  document.getElementById('mdGoalTeam').value   = team;
  document.getElementById('mdGoalMinute').value  = minute;

  const titleEl = document.getElementById('mdGoalModalTitle');
  if (titleEl) {
    const teamName = document.getElementById('teamName')?.value?.trim()      || t('matchday.us');
    const oppName  = document.getElementById('matchOpponent')?.value?.trim() || t('matchday.them');
    titleEl.textContent = isUs ? `${teamName} ⚽` : `${oppName} ⚽`;
  }

  const badgeEl = document.getElementById('mdGoalMinuteBadge');
  if (badgeEl) badgeEl.textContent = minute + "'";

  // Show / hide scorer + assister rows
  const scorerRow = document.getElementById('mdGoalScorerRow');
  const assistRow = document.getElementById('mdGoalAssistRow');
  if (scorerRow) scorerRow.style.display = isUs ? '' : 'none';
  if (assistRow) assistRow.style.display = isUs ? '' : 'none';

  if (isUs) {
    const { onPitch } = mdLivePitchState();
    const mkChip = (p, clickFn) =>
      `<div class="md-goal-chip" data-player="${esc(p.name)}" onclick="${clickFn}('${esc(p.name)}')">
         ${p.number ? `<span class="md-goal-chip-num">${esc(p.number)}</span>` : ''}
         <span>${esc(p.name)}</span>
       </div>`;

    const scorerEl = document.getElementById('mdGoalScorerChips');
    const assistEl = document.getElementById('mdGoalAssistChips');
    if (scorerEl) scorerEl.innerHTML = onPitch.map(p => mkChip(p, 'mdSelectScorer')).join('');
    if (assistEl) assistEl.innerHTML = onPitch.map(p => mkChip(p, 'mdSelectAssist')).join('');
  }

  document.getElementById('mdGoalModal').style.display = 'flex';
}

function mdSelectScorer(name) {
  mdSelectedScorer = name;
  if (mdSelectedAssist === name) { mdSelectedAssist = ''; mdRefreshAssistChips(); }
  mdRefreshScorerChips();
}

function mdSelectAssist(name) {
  if (name === mdSelectedScorer) return;       // scorer can't also assist
  mdSelectedAssist = (mdSelectedAssist === name) ? '' : name;  // toggle
  mdRefreshAssistChips();
}

function mdRefreshScorerChips() {
  document.getElementById('mdGoalScorerChips')?.querySelectorAll('.md-goal-chip').forEach(c => {
    c.classList.toggle('selected-scorer', c.dataset.player === mdSelectedScorer);
  });
}

function mdRefreshAssistChips() {
  document.getElementById('mdGoalAssistChips')?.querySelectorAll('.md-goal-chip').forEach(c => {
    c.classList.toggle('selected-assist',   c.dataset.player === mdSelectedAssist);
    c.classList.toggle('md-chip-disabled',  c.dataset.player === mdSelectedScorer);
  });
}

function mdConfirmGoal() {
  const team   = document.getElementById('mdGoalTeam').value;
  const minute = parseInt(document.getElementById('mdGoalMinute').value) || 0;
  const isUs   = team === 'us';

  if (isUs && !mdSelectedScorer) { showToast(t('matchday.selectScorer')); return; }

  mdGoals.push({
    id: 'g_' + Date.now(),
    minute,
    team,
    scorer:   isUs ? mdSelectedScorer : '',
    assister: isUs ? mdSelectedAssist : '',
  });

  mdSaveGoals();
  document.getElementById('mdGoalModal').style.display = 'none';
  mdRenderScore();
  mdRenderPitch();
  mdRenderTimeline();
  showToast(isUs ? t('matchday.goalUs') : t('matchday.goalThem'));
}

function mdRemoveGoal(id) {
  mdGoals = mdGoals.filter(g => g.id !== id);
  mdSaveGoals();
  mdRenderScore();
  mdRenderPitch();
  mdRenderTimeline();
}

function mdRenderScore() {
  // Scoreline numbers
  const usEl   = document.getElementById('mdScoreUs');
  const themEl = document.getElementById('mdScoreThem');
  if (usEl)   usEl.textContent   = mdOurScore();
  if (themEl) themEl.textContent = mdTheirScore();

  // Team names pulled from match setup
  const teamName = document.getElementById('teamName')?.value?.trim()       || '';
  const oppName  = document.getElementById('matchOpponent')?.value?.trim()  || '';

  const teamNameEl = document.getElementById('mdScoreTeamUs');
  const oppEl      = document.getElementById('mdScoreTeamThem');
  if (teamNameEl) teamNameEl.textContent = teamName || t('matchday.us');
  if (oppEl)      oppEl.textContent      = oppName  || t('matchday.them');

  // Goal buttons: show actual team / opponent name
  const ourBtn  = document.querySelector('.md-goal-us');
  const themBtn = document.querySelector('.md-goal-them');
  if (ourBtn)  ourBtn.textContent  = `⚽ ${teamName || t('matchday.us')}`;
  if (themBtn) themBtn.textContent = `⚽ ${oppName  || t('matchday.them')}`;

  // Goal event log
  const logEl = document.getElementById('mdGoalsList');
  if (!logEl) return;

  const sorted = [...mdGoals].sort((a, b) => a.minute - b.minute);
  if (!sorted.length) { logEl.innerHTML = ''; return; }

  logEl.innerHTML = sorted.map(g => {
    const minBadge = `<span class="md-goal-min">${g.minute}'</span>`;
    const removeBtn = `<button class="md-goal-remove" onclick="mdRemoveGoal('${g.id}')" title="Remove">✕</button>`;
    if (g.team === 'us') {
      const assistHtml = g.assister
        ? ` <span class="md-goal-assist">(${esc(g.assister)})</span>` : '';
      return `<div class="md-goal-event md-goal-event-us">
        ${minBadge}
        <span class="md-goal-scorer">⚽ ${esc(g.scorer)}${assistHtml}</span>
        ${removeBtn}
      </div>`;
    } else {
      return `<div class="md-goal-event md-goal-event-them">
        ${removeBtn}
        <span>⚽ ${t('matchday.theirGoalLabel')}</span>
        ${minBadge}
      </div>`;
    }
  }).join('');
}

// ── Note persistence ──────────────────────────────────────────────────────────

function mdSaveNote() {
  const val = document.getElementById('mdNote')?.value || '';
  try { localStorage.setItem(MD_NOTE_KEY, val); } catch(e) {}
}

// ── Render ────────────────────────────────────────────────────────────────────

function mdRenderAll() {
  mdRenderScore();
  mdRenderLineup();
  mdRenderPitch();
  mdUpdateNextSubCard();
  mdRenderSubsList();
  mdRenderTimeline();
  mdUpdateClock();
}

// ── Match summary & timeline ──────────────────────────────────────────────────

function mdOpenSummary() {
  const teamUs   = document.getElementById('teamName')?.value?.trim()      || t('matchday.us');
  const teamThem = document.getElementById('matchOpponent')?.value?.trim() || t('matchday.them');

  // Final score
  document.getElementById('mdSumScoreUs').textContent   = mdOurScore();
  document.getElementById('mdSumScoreThem').textContent = mdTheirScore();
  document.getElementById('mdSumTeamUs').textContent    = teamUs;
  document.getElementById('mdSumTeamThem').textContent  = teamThem;

  // Timeline headers
  document.getElementById('mdSumTlUs').textContent   = teamUs;
  document.getElementById('mdSumTlThem').textContent = teamThem;

  // Build timeline
  document.getElementById('mdSummaryTimeline').innerHTML = mdBuildTimelineHTML();

  document.getElementById('mdSummaryOverlay').style.display = 'flex';
}

function mdCloseSummary() {
  document.getElementById('mdSummaryOverlay').style.display = 'none';
}

function mdBuildTimelineHTML() {
  // Merge goals + completed subs, sort chronologically
  const events = [];

  mdGoals.forEach(g => events.push({
    minute: g.minute, type: 'goal', team: g.team,
    scorer: g.scorer, assister: g.assister,
  }));

  subEvents
    .filter(ev => ev.completed)
    .forEach(ev => events.push({
      minute: ev.minute, type: 'sub',
      playersOut: ev.playersOut, playersIn: ev.playersIn,
    }));

  // Goals first within same minute, subs after
  events.sort((a, b) => a.minute !== b.minute
    ? a.minute - b.minute
    : (a.type === 'goal' ? -1 : 1));

  if (!events.length)
    return `<div class="md-tl-empty">${t('matchday.noEvents')}</div>`;

  // Running score — computed as we walk the events
  let us = 0, them = 0;

  return events.map(ev => {
    if (ev.type === 'goal') {
      const isUs = ev.team === 'us';
      if (isUs) us++; else them++;
      const scoreBadge = `<span class="md-tl-score-badge ${isUs ? 'md-tl-sb-us' : 'md-tl-sb-them'}">${us}–${them}</span>`;
      const assistHtml = ev.assister
        ? ` <span class="md-tl-assist">(${esc(ev.assister)})</span>` : '';

      const usCell   = isUs
        ? `<div class="md-tl-us">⚽ ${esc(ev.scorer)}${assistHtml}</div>`
        : `<div class="md-tl-us"></div>`;
      const themCell = !isUs
        ? `<div class="md-tl-them">⚽ ${t('matchday.theirGoalLabel')}</div>`
        : `<div class="md-tl-them"></div>`;

      return `
        <div class="md-tl-row">
          ${usCell}
          <div class="md-tl-mid">
            <span class="md-tl-min">${ev.minute}'</span>
            <div class="md-tl-dot ${isUs ? 'md-tl-dot-us' : 'md-tl-dot-them'}"></div>
            ${scoreBadge}
          </div>
          ${themCell}
        </div>`;

    } else {
      const out = ev.playersOut.map(n => `<span class="planner-out">${esc(n)}</span>`).join(', ');
      const inp = ev.playersIn.map(n  => `<span class="planner-in">${esc(n)}</span>`).join(', ');
      return `
        <div class="md-tl-row md-tl-sub-row">
          <div class="md-tl-us md-tl-sub-detail">⇄ ${out} → ${inp}</div>
          <div class="md-tl-mid">
            <span class="md-tl-min">${ev.minute}'</span>
            <div class="md-tl-dot md-tl-dot-sub"></div>
          </div>
          <div class="md-tl-them"></div>
        </div>`;
    }
  }).join('');
}

// Keep mdRenderTimeline as a no-op (timeline now only shown in summary)
function mdRenderTimeline() {}

// ── PNG Export ────────────────────────────────────────────────────────────────

function mdRoundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + w - r, y);  cx.arcTo(x + w, y,   x + w, y + r,   r);
  cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x + r, y + h);  cx.arcTo(x,   y + h, x,   y + h - r, r);
  cx.lineTo(x, y + r);      cx.arcTo(x,   y,     x + r, y,        r);
  cx.closePath();
}

function mdExportSummaryPNG() {
  const teamUs   = document.getElementById('teamName')?.value?.trim()      || t('matchday.us');
  const teamThem = document.getElementById('matchOpponent')?.value?.trim() || t('matchday.them');
  const matchTitle = document.getElementById('matchTitle')?.value?.trim() || '';

  // Build sorted events (same logic as mdBuildTimelineHTML)
  const events = [];
  mdGoals.forEach(g => events.push({
    minute: g.minute, type: 'goal', team: g.team,
    scorer: g.scorer, assister: g.assister,
  }));
  subEvents.filter(ev => ev.completed).forEach(ev => events.push({
    minute: ev.minute, type: 'sub',
    playersOut: ev.playersOut, playersIn: ev.playersIn,
  }));
  events.sort((a, b) => a.minute !== b.minute
    ? a.minute - b.minute : (a.type === 'goal' ? -1 : 1));

  // ── Layout constants ──
  const SCALE  = 2;        // retina
  const W      = 640;
  const PAD    = 32;
  const MID_X  = W / 2;
  const HALF_M = 36;       // half of centre column
  const ROW_H  = 58;

  const TITLE_H  = matchTitle ? 44 : 28;
  const SCORE_H  = 120;
  const HDR_H    = 34;
  const FOOT_H   = 44;
  const evCount  = Math.max(events.length, 1);
  const H        = TITLE_H + SCORE_H + HDR_H + evCount * ROW_H + FOOT_H;

  const c  = document.createElement('canvas');
  c.width  = W * SCALE;
  c.height = H * SCALE;
  const cx = c.getContext('2d');
  cx.scale(SCALE, SCALE);

  // ── Background ──
  cx.fillStyle = '#0e0e1c';
  cx.fillRect(0, 0, W, H);

  // Top accent stripe
  const stripe = cx.createLinearGradient(0, 0, W, 0);
  stripe.addColorStop(0,   '#e94560');
  stripe.addColorStop(0.5, '#c0392b');
  stripe.addColorStop(1,   '#e94560');
  cx.fillStyle = stripe;
  cx.fillRect(0, 0, W, 3);

  let y = 12;

  // ── Match title (optional) ──
  if (matchTitle) {
    cx.font = '12px "Segoe UI", sans-serif';
    cx.fillStyle = '#666';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(matchTitle, MID_X, y + 10);
    y += 22;
  }

  // ── "MATCH SUMMARY" label ──
  cx.font = 'bold 10px "Segoe UI", sans-serif';
  cx.fillStyle = '#444';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('MATCH SUMMARY', MID_X, y + 9);
  y += 24;

  // ── Team names ──
  cx.font = 'bold 13px "Segoe UI", sans-serif';
  cx.fillStyle = '#6fcf97';
  cx.textAlign = 'right';
  cx.fillText(teamUs.toUpperCase(), MID_X - 50, y + 11);
  cx.fillStyle = '#e57373';
  cx.textAlign = 'left';
  cx.fillText(teamThem.toUpperCase(), MID_X + 50, y + 11);
  y += 22;

  // ── Big score ──
  cx.font = 'bold 76px "Segoe UI", sans-serif';
  cx.fillStyle = '#ffffff';
  cx.textBaseline = 'top';
  cx.textAlign = 'right';
  cx.fillText(String(mdOurScore()), MID_X - 16, y);
  cx.textAlign = 'left';
  cx.fillText(String(mdTheirScore()), MID_X + 16, y);
  cx.font = '200 56px "Segoe UI", sans-serif';
  cx.fillStyle = '#333';
  cx.textAlign = 'center';
  cx.fillText('–', MID_X, y + 10);
  y += 90;

  // ── Divider ──
  cx.strokeStyle = '#2a2a4e';
  cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(PAD, y); cx.lineTo(W - PAD, y); cx.stroke();
  y += 12;

  // ── Column headers ──
  cx.font = 'bold 9px "Segoe UI", sans-serif';
  cx.textBaseline = 'middle';
  cx.fillStyle = '#6fcf97';
  cx.textAlign = 'right';
  cx.fillText(teamUs.toUpperCase(), MID_X - HALF_M - 10, y + 8);
  cx.fillStyle = '#e57373';
  cx.textAlign = 'left';
  cx.fillText(teamThem.toUpperCase(), MID_X + HALF_M + 10, y + 8);
  y += HDR_H;

  // ── Centre vertical line ──
  cx.strokeStyle = '#2a2a4e';
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.moveTo(MID_X, y);
  cx.lineTo(MID_X, y + events.length * ROW_H);
  cx.stroke();

  // ── Events ──
  let us = 0, them = 0;

  if (!events.length) {
    cx.font = '11px "Segoe UI", sans-serif';
    cx.fillStyle = '#333';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(t('matchday.noEvents'), MID_X, y + ROW_H / 2);
    y += ROW_H;
  }

  events.forEach(ev => {
    const rowMid = y + ROW_H / 2;

    if (ev.type === 'goal') {
      const isUs = ev.team === 'us';
      if (isUs) us++; else them++;
      const scoreStr = `${us}–${them}`;
      const textX = isUs ? MID_X - HALF_M - 12 : MID_X + HALF_M + 12;
      const hasAssist = isUs && ev.assister;

      // Scorer line
      cx.font = 'bold 12px "Segoe UI", sans-serif';
      cx.fillStyle = isUs ? '#6fcf97' : '#e57373';
      cx.textAlign = isUs ? 'right' : 'left';
      cx.textBaseline = 'middle';
      cx.fillText(`⚽ ${isUs ? ev.scorer : t('matchday.theirGoalLabel')}`, textX, rowMid - (hasAssist ? 8 : 2));

      // Assist
      if (hasAssist) {
        cx.font = '10px "Segoe UI", sans-serif';
        cx.fillStyle = '#9ab';
        cx.fillText(`(${ev.assister})`, textX, rowMid + 8);
      }

      // Minute label
      cx.font = 'bold 9px "Segoe UI", sans-serif';
      cx.textAlign = 'center';
      cx.fillStyle = '#777';
      cx.fillText(`${ev.minute}'`, MID_X, rowMid - 17);

      // Dot
      cx.beginPath(); cx.arc(MID_X, rowMid - 6, 5.5, 0, Math.PI * 2);
      cx.fillStyle = isUs ? '#27ae60' : '#e74c3c'; cx.fill();
      cx.strokeStyle = '#0e0e1c'; cx.lineWidth = 1.5; cx.stroke();

      // Score pill badge
      const bw = 40, bh = 15, bx = MID_X - bw / 2, by = rowMid + 5;
      cx.fillStyle = isUs ? 'rgba(39,174,96,0.22)' : 'rgba(231,76,60,0.22)';
      mdRoundRect(cx, bx, by, bw, bh, 7); cx.fill();
      cx.strokeStyle = isUs ? 'rgba(39,174,96,0.45)' : 'rgba(231,76,60,0.45)';
      cx.lineWidth = 0.8;
      mdRoundRect(cx, bx, by, bw, bh, 7); cx.stroke();
      cx.font = 'bold 9px "Segoe UI", sans-serif';
      cx.fillStyle = isUs ? '#6fcf97' : '#e57373';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(scoreStr, MID_X, by + bh / 2);

    } else {
      // Substitution row
      const subLabel = `⇄ ${ev.playersOut.join(', ')} → ${ev.playersIn.join(', ')}`;
      cx.font = '10px "Segoe UI", sans-serif';
      cx.fillStyle = '#c9882a';
      cx.textAlign = 'right';
      cx.textBaseline = 'middle';
      // Truncate if too long
      const maxW = MID_X - HALF_M - 12 - PAD;
      let label = subLabel;
      while (cx.measureText(label).width > maxW && label.length > 8) label = label.slice(0, -4) + '…';
      cx.fillText(label, MID_X - HALF_M - 12, rowMid);

      // Minute label
      cx.font = 'bold 9px "Segoe UI", sans-serif';
      cx.textAlign = 'center';
      cx.fillStyle = '#777';
      cx.fillText(`${ev.minute}'`, MID_X, rowMid - 10);

      // Small amber dot
      cx.beginPath(); cx.arc(MID_X, rowMid, 4, 0, Math.PI * 2);
      cx.fillStyle = '#f39c12'; cx.fill();
      cx.strokeStyle = '#0e0e1c'; cx.lineWidth = 1; cx.stroke();
    }

    y += ROW_H;
  });

  // ── Footer branding ──
  y += 10;
  cx.font = '9px "Segoe UI", sans-serif';
  cx.fillStyle = '#2a2a4e';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('Made with RoTactic ⚽', MID_X, y + 18);

  // ── Download ──
  const a = document.createElement('a');
  a.download = `${teamUs} vs ${teamThem}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
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
