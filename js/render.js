// Canvas drawing, drag, share/export functions
let canvas = document.getElementById('pitchCanvas');
let ctx    = canvas.getContext('2d');

function computeLayout() {
  const dual = document.getElementById('showOpponent')?.checked || false;
  const W  = 640;
  const PP = 28;
  const PW = W - PP * 2;          // 584
  const PH = dual ? 390 : 520;    // each half height
  const PT = dual ? 30 : 36;      // pitch top
  const PB = dual ? PT + PH*2 : PT + PH;
  const ARC_R  = Math.round(PW * 0.110);
  const GOAL_W = Math.round(PW * 0.200);
  const GOAL_D = 20;
  const BT     = PB + GOAL_D + 16;
  const SEAT_Y = BT + 90;
  const SEAT_H = 12;
  const LEG_H  = 16;
  const NAME_Y = SEAT_Y + SEAT_H + LEG_H + 6;
  const H      = NAME_Y + 44;
  const FIELD_SIZE = dual ? 19 : 23;
  const MID_Y = dual ? PT + PH : null;
  return { W, H, PP, PW, PH, PT, PB, ARC_R, GOAL_W, GOAL_D, BT, SEAT_Y, SEAT_H, LEG_H, NAME_Y, FIELD_SIZE, MID_Y, dual };
}

function rrPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
function rrFill(x,y,w,h,r){ rrPath(x,y,w,h,r); ctx.fill(); }

function lighten(hex, amt) {
  const n=parseInt(hex.replace('#',''),16);
  return `rgb(${Math.min(255,(n>>16)+amt)},${Math.min(255,((n>>8)&0xff)+amt)},${Math.min(255,(n&0xff)+amt)})`;
}
function darken(hex, amt) {
  const n=parseInt(hex.replace('#',''),16);
  return `rgb(${Math.max(0,(n>>16)-amt)},${Math.max(0,((n>>8)&0xff)-amt)},${Math.max(0,(n&0xff)-amt)})`;
}

// ── RENDER ────────────────────────────────────────────────────────────────
function render() {
  const L = computeLayout();
  canvas.width  = L.W;
  canvas.height = L.H;

  ctx.clearRect(0, 0, L.W, L.H);
  ctx.save();
  rrPath(0, 0, L.W, L.H, 12); ctx.clip();
  ctx.fillStyle = '#141428'; ctx.fillRect(0, 0, L.W, L.H);

  // pitch surface clip
  ctx.save();
  ctx.beginPath(); ctx.rect(0, L.PT-4, L.W, (L.dual ? L.PH*2 : L.PH)+8); ctx.clip();
  drawSurface(L);
  ctx.restore();

  drawBenchBg(L);
  drawMarkings(L);
  placePlayersOnPitch(L);
  drawBench(L);
  drawTeamLabel(L);
  if (badgeImg) drawBadge(L);
  ctx.restore();
  checkWarnings();
  saveState();
}

// ── SURFACES ──────────────────────────────────────────────────────────────
function drawSurface(L) {
  if (pitchType === 'grass') {
    for (let i=0;i<8;i++) {
      ctx.fillStyle = i%2===0 ? '#2a7825' : '#2f8c2a';
      ctx.fillRect(i*(L.W/8), 0, L.W/8, L.H);
    }
  } else if (pitchType === 'hard') {
    ctx.fillStyle='#2e5280'; ctx.fillRect(0,0,L.W,L.H);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
    for(let y=0;y<L.H;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(L.W,y);ctx.stroke();}
    for(let x=0;x<L.W;x+=12){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,L.H);ctx.stroke();}
  } else {
    ctx.fillStyle='#b07830'; ctx.fillRect(0,0,L.W,L.H);
    for(let row=0;row<L.H/18+1;row++) for(let col=0;col<L.W/60+1;col++){
      const off=(row%2)*30;
      ctx.fillStyle=row%2===0?(col%2===0?'#be8838':'#b07830'):(col%2===0?'#a87028':'#b07830');
      ctx.fillRect(col*60-off, row*18, 59, 17);
    }
  }
}

function drawBenchBg(L) {
  ctx.fillStyle = {grass:'#162a14',hard:'#1e3050',indoor:'#6a4818'}[pitchType];
  ctx.fillRect(0, L.BT-4, L.W, L.H-L.BT+4);
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
  ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.moveTo(L.PP, L.BT-4); ctx.lineTo(L.W-L.PP, L.BT-4); ctx.stroke();
  ctx.setLineDash([]);
}

// ── MARKINGS ──────────────────────────────────────────────────────────────
function drawMarkings(L) {
  const { W, PP, PW, PH, PT, PB, ARC_R, GOAL_W, GOAL_D, dual, MID_Y } = L;

  ctx.strokeStyle='rgba(255,255,255,0.88)'; ctx.lineWidth=2;

  if (dual) {
    // Full pitch border
    ctx.strokeRect(PP, PT, PW, PH*2);
    // Halfway line
    ctx.beginPath(); ctx.moveTo(PP, MID_Y); ctx.lineTo(PP+PW, MID_Y); ctx.stroke();
    // Centre circle
    ctx.beginPath(); ctx.arc(W/2, MID_Y, ARC_R, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, MID_Y, 4, 0, Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.fill();

    // Our half markings (bottom)
    drawHalfMarkings(L, MID_Y, PT+PH*2, false);
    // Opponent half markings (top, inverted)
    drawHalfMarkings(L, PT, MID_Y, true);

    // Our goal (bottom)
    drawGoal(L, PT+PH*2, false);
    // Opponent goal (top, inverted)
    drawGoal(L, PT, true);

    // Labels
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.font='10px Segoe UI';
    ctx.textAlign='left'; ctx.textBaseline='bottom';
    ctx.fillText(document.getElementById('matchOpponent').value || t('canvas.opponent'), PP+5, MID_Y-3);
    ctx.textBaseline='top';
    ctx.fillText(document.getElementById('teamName').value || 'My Team', PP+5, MID_Y+3);
    ctx.restore();
  } else {
    // Half pitch
    ctx.strokeRect(PP, PT, PW, PH);
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.font='10px Segoe UI';
    ctx.textAlign='left'; ctx.textBaseline='bottom';
    ctx.fillText(t('canvas.halfway'), PP+5, PT-3);
    ctx.restore();
    // Centre arc (half visible)
    ctx.beginPath(); ctx.arc(W/2, PT, ARC_R, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, PT, 4, 0, Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.fill();
    drawHalfMarkings(L, PT, PB, false);
    drawGoal(L, PB, false);
  }
}

function drawHalfMarkings(L, topY, botY, inverted) {
  const { PP, PW, ARC_R } = L;
  const halfH = botY - topY;
  const W     = L.W;

  ctx.strokeStyle='rgba(255,255,255,0.88)'; ctx.lineWidth=2;

  const goalLineY = inverted ? topY : botY;

  // Penalty area
  const penW = PW*0.57, penH = halfH*0.31;
  const penX = PP+(PW-penW)/2;
  const penTop = inverted ? goalLineY : goalLineY - penH;
  ctx.strokeRect(penX, penTop, penW, inverted ? penH : penH);

  // Goal box
  const gboxW = PW*0.27, gboxH = halfH*0.09;
  const gboxTop = inverted ? goalLineY : goalLineY - gboxH;
  ctx.strokeRect(PP+(PW-gboxW)/2, gboxTop, gboxW, gboxH);

  // Penalty spot
  const psY = inverted ? goalLineY + halfH*0.21 : goalLineY - halfH*0.21;
  ctx.beginPath(); ctx.arc(W/2, psY, 3.5, 0, Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.fill();

  // Penalty arc (clipped to exclude penalty area)
  const arcClipTop = inverted ? penTop + penH : topY;
  const arcClipBot = inverted ? botY          : penTop;
  ctx.save();
  ctx.beginPath(); ctx.rect(PP, arcClipTop, PW, arcClipBot - arcClipTop); ctx.clip();
  ctx.beginPath(); ctx.arc(W/2, psY, ARC_R, 0, Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.88)'; ctx.lineWidth=2;
  ctx.stroke();
  ctx.restore();

  // Corner arcs
  const cr=11;
  if (inverted) {
    ctx.beginPath(); ctx.arc(PP,    topY, cr, Math.PI*1.5, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(PP+PW, topY, cr, Math.PI,     Math.PI*1.5); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(PP,    botY, cr, Math.PI*1.5, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(PP+PW, botY, cr, Math.PI,     Math.PI*1.5); ctx.stroke();
  }
}

function drawGoal(L, lineY, inverted) {
  const { W, GOAL_W, GOAL_D } = L;
  const gx = W/2 - GOAL_W/2;
  const netY  = inverted ? lineY - GOAL_D : lineY;
  const netDir = inverted ? -1 : 1;

  ctx.fillStyle='rgba(255,255,255,0.07)';
  ctx.fillRect(gx+3, netY, GOAL_W-6, GOAL_D * netDir);

  ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=0.6;
  for(let nx=gx+10;nx<gx+GOAL_W-3;nx+=10){
    ctx.beginPath(); ctx.moveTo(nx, netY); ctx.lineTo(nx, netY+GOAL_D*netDir); ctx.stroke();
  }
  for(let nd=6;nd<GOAL_D;nd+=6){
    const ny = netY + nd * netDir;
    ctx.beginPath(); ctx.moveTo(gx+3,ny); ctx.lineTo(gx+GOAL_W-3,ny); ctx.stroke();
  }

  const postY = inverted ? lineY - GOAL_D - 4 : lineY - 4;
  ctx.fillStyle='#efefef';
  ctx.fillRect(gx-3, postY, GOAL_W+6, 5);
  ctx.fillRect(gx-3, postY, 5, GOAL_D+4);
  ctx.fillRect(gx+GOAL_W-2, postY, 5, GOAL_D+4);
}

// ── PLAYER POSITIONS ──────────────────────────────────────────────────────
function getPositions(formation, halfTop, halfH, inverted) {
  const W  = 640;
  const PP = 28;
  const PW = W - PP * 2;
  const lines = formation.split('-').map(Number);
  const lc    = lines.length;
  const pos   = [];

  const gkFrac  = inverted ? 0.10 : 0.86;
  const defFrac = inverted ? 0.26 : 0.64;  // line closest to own GK
  const range   = 0.54;

  pos.push({ x: W/2, y: halfTop + halfH * gkFrac });
  lines.forEach((count, li) => {
    // not inverted: defense at 0.64, attack at 0.64-0.54=0.10
    // inverted:     defense at 0.26, attack at 0.26+0.54=0.80
    const frac = inverted
      ? defFrac + (li / Math.max(lc-1, 1)) * range
      : defFrac - (li / Math.max(lc-1, 1)) * range;
    const y = halfTop + halfH * frac;
    for (let p=0; p<count; p++)
      pos.push({ x: PP + PW*(p+1)/(count+1), y });
  });
  return pos;
}

// ── JERSEY ────────────────────────────────────────────────────────────────
function drawJersey(cx, cy, number, name, jColor, nColor, sColor, isGK, size, showNameOnShirt, pattern, patternCol) {
  const base  = jColor;
  const sBase = sColor;

  const w      = size * 1.9;
  const h      = size * 2.3;
  const t      = cy - h * 0.44;
  const b      = cy + h * 0.56;
  const hw     = w / 2;
  const cw2    = hw * 0.28;
  const cd     = h * 0.14;
  const slvX   = hw * 0.20;
  const slvY   = t + h * 0.28;
  const tap    = hw * 0.04;
  const shortsH = size * 1.4;

  ctx.save();

  // shadow
  ctx.beginPath();
  ctx.ellipse(cx, b+shortsH+3, hw*0.85, 4, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fill();

  // shorts
  rrPath(cx-hw+tap, b-1, w-tap*2, shortsH+1, 2);
  ctx.fillStyle=sBase; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=0.7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,b); ctx.lineTo(cx,b+shortsH);
  ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=0.6; ctx.stroke();

  // jersey body path (reusable)
  function jerseyBodyPath() {
    ctx.beginPath();
    ctx.moveTo(cx-cw2, t);
    ctx.lineTo(cx-hw-slvX, t+h*0.04);
    ctx.lineTo(cx-hw-slvX, slvY);
    ctx.lineTo(cx-hw,      slvY+h*0.06);
    ctx.lineTo(cx-hw+tap,  b);
    ctx.lineTo(cx+hw-tap,  b);
    ctx.lineTo(cx+hw,      slvY+h*0.06);
    ctx.lineTo(cx+hw+slvX, slvY);
    ctx.lineTo(cx+hw+slvX, t+h*0.04);
    ctx.lineTo(cx+cw2,     t);
    ctx.lineTo(cx,         t+cd);
    ctx.closePath();
  }

  // fill jersey
  jerseyBodyPath();
  const grad = ctx.createLinearGradient(cx-hw, t, cx+hw, b);
  grad.addColorStop(0,    lighten(base, 22));
  grad.addColorStop(0.45, base);
  grad.addColorStop(1,    lighten(base, 8));
  ctx.fillStyle=grad; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8; ctx.stroke();

  // kit pattern overlay
  if (pattern && pattern !== 'plain' && patternCol) {
    ctx.save();
    jerseyBodyPath();
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = patternCol;

    if (pattern === 'vstripes') {
      const strW = w * 0.22;
      for (let sx = cx - hw - slvX; sx < cx + hw + slvX + strW; sx += strW * 2) {
        ctx.fillRect(sx, t, strW, h + shortsH);
      }
    } else if (pattern === 'hoops') {
      const bandH = h * 0.22;
      for (let sy = t; sy < b + bandH; sy += bandH * 2) {
        ctx.fillRect(cx - hw - slvX, sy, w + slvX*2, bandH);
      }
    } else if (pattern === 'sash') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.55);
      ctx.fillRect(-hw*2, -size*0.45, hw*4, size*0.90);
      ctx.restore();
    } else if (pattern === 'halves') {
      ctx.fillRect(cx, t, hw + slvX, h + shortsH);
    } else if (pattern === 'sleeves') {
      ctx.fillRect(cx-hw-slvX, t, slvX+hw*0.35, h*0.35);
      ctx.fillRect(cx+hw*0.65, t, slvX+hw*0.35, h*0.35);
    }

    ctx.restore();
  }

  // collar
  ctx.beginPath();
  ctx.moveTo(cx-cw2,t); ctx.lineTo(cx+cw2,t); ctx.lineTo(cx,t+cd);
  ctx.closePath(); ctx.fillStyle=darken(base,30); ctx.fill();

  // sleeve edge
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-hw-slvX+1,t+h*0.06); ctx.lineTo(cx-hw-slvX+1,slvY-1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+hw+slvX-1,t+h*0.06); ctx.lineTo(cx+hw+slvX-1,slvY-1); ctx.stroke();

  // text
  ctx.fillStyle=nColor; ctx.textAlign='center';

  if (showNameOnShirt) {
    const lastName = name.trim().split(/\s+/).pop().toUpperCase();
    const bodyW    = (w - tap*2) * 0.86;
    let nfs = Math.max(5, size * 0.44);
    ctx.font = `bold ${nfs}px Segoe UI`;
    while (ctx.measureText(lastName).width > bodyW && nfs > 5) {
      nfs -= 0.3;
      ctx.font = `bold ${nfs}px Segoe UI`;
    }
    ctx.textBaseline='middle';
    ctx.fillText(lastName, cx, cy - size*0.30);
    ctx.font = `bold ${Math.max(8, Math.round(size*0.80))}px Segoe UI`;
    ctx.fillText(String(number), cx, cy + size*0.40);
  } else {
    ctx.font = `bold ${Math.max(7, Math.round(size*0.78))}px Segoe UI`;
    ctx.textBaseline='middle';
    ctx.fillText(String(number), cx, cy);
  }

  ctx.restore();
}

// ── PLACE PLAYERS ON PITCH ────────────────────────────────────────────────
function placePlayersOnPitch(L) {
  const players    = window._mdPlayersOverride || getPlayers();
  const formation  = currentFormation || '4-3-3';
  const jColor     = document.getElementById('jerseyColor').value;
  const gkColor    = document.getElementById('gkColor').value;
  const gkNumColor = document.getElementById('gkNumberColor').value;
  const gkSrtColor = document.getElementById('gkShortsColor').value;
  const nColor     = document.getElementById('numberColor').value;
  const sColor     = document.getElementById('shortsColor').value;
  const pattern    = document.getElementById('kitPattern').value;
  const patternCol = document.getElementById('patternColor').value;

  let halfTop, halfH;
  if (L.dual) {
    halfTop = L.MID_Y;
    halfH   = L.PH;
  } else {
    halfTop = L.PT;
    halfH   = L.PH;
  }

  const defaultPositions = getPositions(formation, halfTop, halfH, false);
  lastPositions = [];

  players.forEach((p, i) => {
    const def = defaultPositions[i];
    if (!def) return;
    const pos = customPositions[i] ? customPositions[i] : def;
    lastPositions[i] = { x: pos.x, y: pos.y };
    const jerseyC = p.isGK ? gkColor    : jColor;
    const numC    = p.isGK ? gkNumColor : nColor;
    const shrtC   = p.isGK ? gkSrtColor : sColor;
    drawJersey(pos.x, pos.y, p.number, p.name, jerseyC, numC, shrtC, p.isGK, L.FIELD_SIZE, true, p.isGK ? null : pattern, patternCol);

    // Goal / assist badge overlay (matchday only)
    const gd = window._mdGoalOverride;
    if (gd && p.name) drawPlayerIcons(pos.x, pos.y, L.FIELD_SIZE,
      gd.scorers.get(p.name)  || 0,
      gd.assisters.get(p.name) || 0);
  });

  // Opponent team
  if (L.dual) {
    const oppJ  = document.getElementById('oppJerseyColor').value;
    const oppN  = document.getElementById('oppNumberColor').value;
    const oppS  = document.getElementById('oppShortsColor').value;
    const oppFm = oppFormation || (FORMATIONS[outfieldCount] || [['4-3-3']])[0][0];
    const oppPositions = getPositions(oppFm, L.PT, L.PH, true);
    for (let i = 0; i < Math.min(oppPositions.length, outfieldCount + 1); i++) {
      const isGK = i === 0;
      const oppGK = isGK ? darken(oppJ, 45) : oppJ;
      drawJersey(oppPositions[i].x, oppPositions[i].y, i+1, '', isGK ? oppGK : oppJ, oppN, oppS, isGK, L.FIELD_SIZE, false, null, null);
    }
  }
}

// ── BENCH ──────────────────────────────────────────────────────────────────
function drawBench(L) {
  const coachName  = document.getElementById('coachName').value     || 'Coach';
  const asstName   = document.getElementById('asstCoachName').value  || 'Asst.';
  const coachColor = document.getElementById('coachColor').value;
  const asstColor  = document.getElementById('asstColor').value;
  const coachInit  = (document.getElementById('coachInitials').value || 'HC').toUpperCase();
  const asstInit   = (document.getElementById('asstInitials').value  || 'AC').toUpperCase();
  const subs       = getSubs();
  const jColor     = document.getElementById('jerseyColor').value;
  const nColor     = document.getElementById('numberColor').value;
  const sColor     = document.getElementById('shortsColor').value;
  const gkColor    = document.getElementById('gkColor').value;
  const gkNumColor = document.getElementById('gkNumberColor').value;
  const gkSrtColor = document.getElementById('gkShortsColor').value;
  const { PP, PW, BT, SEAT_Y, SEAT_H, LEG_H, NAME_Y } = L;

  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='bold 11px Segoe UI';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(t('canvas.bench'), PP, BT+6);

  const sx=PP+12, sw=PW-24;
  ctx.fillStyle = pitchType==='indoor' ? '#8B6520' : '#5a5a5a';
  rrPath(sx, SEAT_Y, sw, SEAT_H, 3); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.stroke();
  [0.12,0.38,0.62,0.88].forEach(f => {
    ctx.fillStyle='#404040';
    ctx.fillRect(sx+sw*f-2, SEAT_Y+SEAT_H, 4, LEG_H);
  });

  const all = [
    { name:coachName, number:coachInit, color:coachColor, nColor:'#fff', sColor, isStaff:true },
    ...subs.map(s => {
      const sp      = s.squadId ? getById(s.squadId) : null;
      const isSubGK = sp && sp.playerType === 'Goalkeeper';
      return {
        name:   s.name,
        number: s.number,
        color:  isSubGK ? gkColor    : jColor,
        nColor: isSubGK ? gkNumColor : nColor,
        sColor: isSubGK ? gkSrtColor : sColor,
        isStaff: false,
      };
    }),
    { name:asstName, number:asstInit, color:asstColor, nColor:'#fff', sColor, isStaff:true },
  ];

  const N    = all.length;
  const size = Math.min(18, Math.max(10, (sw-10) / (N * 3.0)));
  const cy   = SEAT_Y - (size*1.288 + size*1.4 + 3);

  all.forEach((p, i) => {
    const x = PP + PW*(i+1)/(N+1);
    drawJersey(x, cy, p.number, p.name, p.color, p.nColor, p.sColor, false, size, false, null, null);

    // Goal / assist badge overlay for bench players (matchday only)
    const gd = window._mdGoalOverride;
    if (!p.isStaff && gd && p.name) drawPlayerIcons(x, cy, size,
      gd.scorers.get(p.name)  || 0,
      gd.assisters.get(p.name) || 0);
  });

  ctx.font='bold 10px Segoe UI'; ctx.textBaseline='top';
  all.forEach((p, i) => {
    const x      = PP + PW*(i+1)/(N+1);
    const spaceI = p.name.indexOf(' ');
    const line1  = spaceI > -1 ? p.name.slice(0, spaceI) : p.name;
    const line2  = spaceI > -1 ? p.name.slice(spaceI+1)  : '';
    const clamp  = (s) => s.length > 9 ? s.slice(0,8)+'.' : s;
    ctx.textAlign = 'center';
    ctx.fillStyle = (p.color===coachColor||p.color===asstColor) ? p.color : 'rgba(255,255,255,0.65)';
    ctx.fillText(clamp(line1), x, NAME_Y);
    if (line2) ctx.fillText(clamp(line2), x, NAME_Y + 13);
  });
}

// ── TEAM LABEL ────────────────────────────────────────────────────────────
function drawTeamLabel(L) {
  const name      = document.getElementById('teamName').value || 'My Team';
  const formation = currentFormation || '4-3-3';
  const label     = `${name}  ·  ${formation}`;
  ctx.font='bold 15px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const tw=ctx.measureText(label).width+24;
  ctx.fillStyle='rgba(0,0,0,0.55)'; rrFill(L.W/2-tw/2, 9, tw, 24, 6);
  ctx.fillStyle='#fff'; ctx.fillText(label, L.W/2, 21);
}

// ── CLUB BADGE ─────────────────────────────────────────────────────────────
function drawBadge(L) {
  const bSize = 52;
  const bx    = L.PP + 8;
  const by    = L.dual ? L.MID_Y + 8 : L.PT + 8;
  ctx.save();
  rrPath(bx-2, by-2, bSize+4, bSize+4, 6);
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill();
  rrPath(bx, by, bSize, bSize, 5);
  ctx.clip();
  ctx.drawImage(badgeImg, bx, by, bSize, bSize);
  ctx.restore();
}

// ── GOAL / ASSIST ICON BADGE ──────────────────────────────────────────────
// Draws ⚽ and 👟 emoji badges near a jersey for players who scored / assisted.
function drawPlayerIcons(cx, cy, size, goals, assists) {
  if (!goals && !assists) return;
  ctx.save();

  const r   = Math.max(9, size * 0.56);
  let bx    = cx + size * 1.05;
  let by    = cy - size * 1.0;

  const drawBadge = (emoji, count, bg) => {
    // Dark halo for contrast against any pitch colour
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 6;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 1.8;
    ctx.stroke();

    // Emoji
    ctx.font         = `${Math.round(r * 1.5)}px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, bx, by + 1);

    // Count bubble when > 1
    if (count > 1) {
      const br  = r * 0.52;
      const bbx = bx + r * 0.68, bby = by - r * 0.68;
      ctx.beginPath(); ctx.arc(bbx, bby, br, 0, Math.PI*2);
      ctx.fillStyle = '#e74c3c'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.font      = `bold ${Math.round(br * 1.6)}px Segoe UI`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(count), bbx, bby + 0.5);
    }

    by += r * 2.5;
  };

  if (goals)   drawBadge('⚽', goals,   '#f0f0f0');  // white — pops on green pitch
  if (assists) drawBadge('👟', assists, '#f39c12');  // gold — clearly different from ⚽

  ctx.restore();
}

// ── MATCHDAY CANVAS RENDER ────────────────────────────────────────────────
// Renders the live lineup to a separate canvas without touching main state.
function renderToCanvas(targetCanvas, liveSlots) {
  if (!targetCanvas) return;
  const savedCanvas = canvas;
  const savedCtx    = ctx;
  canvas = targetCanvas;
  ctx    = targetCanvas.getContext('2d');

  // Map formation slots to the player format render() expects
  window._mdPlayersOverride = liveSlots.map(s => ({
    name:   s.current,
    number: s.number,
    isGK:   s.isGK,
    squadId: null,
  }));

  // Build scorer / assister look-up maps from live matchday goals
  if (typeof mdGoals !== 'undefined' && mdGoals.length) {
    const scorers  = new Map();
    const assisters = new Map();
    mdGoals.forEach(g => {
      if (g.scorer)   scorers.set(g.scorer,    (scorers.get(g.scorer)    || 0) + 1);
      if (g.assister) assisters.set(g.assister, (assisters.get(g.assister) || 0) + 1);
    });
    window._mdGoalOverride = { scorers, assisters };
  } else {
    window._mdGoalOverride = null;
  }

  render();
  canvas = savedCanvas;
  ctx    = savedCtx;
  window._mdPlayersOverride = null;
  window._mdGoalOverride    = null;
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────
function getCanvasPos(e) {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left)  * scaleX,
    y: (src.clientY - rect.top)   * scaleY,
  };
}

function hitTestPlayer(px, py) {
  const L    = computeLayout();
  const size = L.FIELD_SIZE;
  for (let i = 0; i < lastPositions.length; i++) {
    const p = lastPositions[i];
    if (!p) continue;
    const dx = px - p.x, dy = py - p.y;
    if (Math.sqrt(dx*dx + dy*dy) < size * 2.0) return i;
  }
  return -1;
}

function onPointerDown(e) {
  const { x, y } = getCanvasPos(e);
  const idx = hitTestPlayer(x, y);
  if (idx < 0) return;
  e.preventDefault();
  dragState = { idx };
  canvas.style.cursor = 'grabbing';
}

function onPointerMove(e) {
  if (!dragState) return;
  e.preventDefault();
  const { x, y } = getCanvasPos(e);
  const L = computeLayout();
  // Clamp within pitch area
  const clampX = Math.max(L.PP + 10, Math.min(L.PP + L.PW - 10, x));
  const pitchTop  = L.dual ? L.MID_Y + 5 : L.PT + 5;
  const pitchBot  = L.dual ? L.PT + L.PH*2 - 5 : L.PT + L.PH - 5;
  const clampY = Math.max(pitchTop, Math.min(pitchBot, y));
  customPositions[dragState.idx] = { x: clampX, y: clampY };
  render();
}

function onPointerUp(e) {
  if (!dragState) return;
  dragState = null;
  canvas.style.cursor = 'default';
}

canvas.addEventListener('mousedown',  onPointerDown);
canvas.addEventListener('mousemove',  onPointerMove);
canvas.addEventListener('mouseup',    onPointerUp);
canvas.addEventListener('mouseleave', onPointerUp);
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove',  onPointerMove, { passive: false });
canvas.addEventListener('touchend',   onPointerUp);

// ── BADGE ─────────────────────────────────────────────────────────────────
function loadBadge(input) {
  if (!input.files || !input.files[0]) return;
  const url = URL.createObjectURL(input.files[0]);
  const img = new Image();
  img.onload = () => {
    badgeImg = img;
    document.getElementById('badgePreview').src = url;
    document.getElementById('badgePreview').style.display = 'block';
    document.getElementById('clearBadgeBtn').style.display = '';
    render();
  };
  img.src = url;
}

function clearBadge() {
  badgeImg = null;
  document.getElementById('badgePreview').style.display = 'none';
  document.getElementById('badgePreview').src = '';
  document.getElementById('clearBadgeBtn').style.display = 'none';
  document.getElementById('badgeFile').value = '';
  render();
}

// ── SHARE LINK ────────────────────────────────────────────────────────────
function getShareState() {
  return {
    t:  document.getElementById('teamName').value,
    jc: document.getElementById('jerseyColor').value,
    nc: document.getElementById('numberColor').value,
    sc: document.getElementById('shortsColor').value,
    gk: document.getElementById('gkColor').value,
    gkn: document.getElementById('gkNumberColor').value,
    gks: document.getElementById('gkShortsColor').value,
    kp: document.getElementById('kitPattern').value,
    pc: document.getElementById('patternColor').value,
    pt: pitchType,
    oc: outfieldCount,
    fm: currentFormation,
    pl: readRows('#playerList'),
    sb: readRows('#subList'),
    sn: subCount,
    cn: document.getElementById('coachName').value,
    cc: document.getElementById('coachColor').value,
    ci: document.getElementById('coachInitials').value,
    an: document.getElementById('asstCoachName').value,
    ac: document.getElementById('asstColor').value,
    ai: document.getElementById('asstInitials').value,
    opp: document.getElementById('showOpponent').checked,
    on: document.getElementById('matchOpponent').value,
    oj: document.getElementById('oppJerseyColor').value,
    onu: document.getElementById('oppNumberColor').value,
    os: document.getElementById('oppShortsColor').value,
    of: oppFormation,
    cp: customPositions,
  };
}

function copyShareLink() {
  const state   = getShareState();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  const url     = location.href.split('#')[0] + '#' + encoded;
  navigator.clipboard.writeText(url).then(() => {
    showToast(t('toast.linkCopied'));
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}

// ── EXPORT ────────────────────────────────────────────────────────────────
function exportPNG() {
  render();
  const a=document.createElement('a');
  a.download=(document.getElementById('teamName').value||'lineup')+'.png';
  a.href=canvas.toDataURL('image/png'); a.click();
}
