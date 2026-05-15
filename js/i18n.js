// ── INTERNATIONALISATION ──────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    // App name & header
    'app.name':       'RoTactic',
    'header.tagline': 'Squad rotation & match tactics for every manager',
    // Sections
    'section.match':     'Match Setup',
    'section.team':      'Team Setup',
    'section.squad':     'Squad Management',
    'section.starting':  'Starting XI',
    'section.subs':      'Substitutes',
    'section.staff':     'Staff',
    'section.share':     'Share Lineup',
    'section.formation': 'Formation',
    // Navigation
    'nav.myClub':        'My Club',
    // Matches panel
    'matches.title':     'My Matches',
    'matches.new':       '+ New Match',
    'matches.empty':     'No matches yet — create your first one!',
    'matches.untitled':  'Untitled Match',
    'matches.open':      'Open →',
    // Match Setup
    'label.matchTitle':  'Match Title',
    'ph.matchTitle':     'e.g. U12 Cup Semi-Final',
    'label.date':        'Date',
    'label.format':      'Format',
    'opt.anyFormat':     '— Any —',
    'label.opponent':    'Opponent',
    'ph.opponent':       'Opponent team name',
    'label.showOnPitch': 'Show opponent on pitch',
    'label.venue':       'Venue',
    'ph.venue':          'Stadium / pitch name',
    'label.duration':    'Duration (min)',
    'label.periods':     'Periods',
    'label.homeAway':    'Home / Away',
    'btn.home':          '🏠 Home',
    'btn.away':          '✈️ Away',
    'btn.neutral':       '⚖️ Neutral',
    'label.pitchSurface':'Pitch Surface',
    'btn.grass':         'Grass',
    'btn.hard':          'Hard',
    'btn.indoor':        'Indoor',
    'label.notes':       'Notes',
    'ph.notes':          'Tactical notes, reminders…',
    // Team Setup
    'label.teamName':    'Team Name',
    'label.jerseyColor': 'Jersey Color',
    'label.numberColor': 'Number Color',
    'label.shortsColor': 'Shorts Color',
    'label.gkJersey':    'GK Jersey',
    'label.gkNumber':    'GK Number',
    'label.gkShorts':    'GK Shorts',
    'label.kitPattern':  'Kit Pattern',
    'label.patternHint': 'Pattern color shown over jersey',
    'opt.plain':         'Plain',
    'opt.vstripes':      'Vertical Stripes',
    'opt.hoops':         'Hoops',
    'opt.sash':          'Sash',
    'opt.halves':        'Half & Half',
    'opt.sleeves':       'Sleeves',
    'label.formation':   'Formation',
    'label.customForm':  'Custom formation',
    'ph.customForm':     'e.g. 4-2-3-1',
    'label.clubBadge':   'Club Badge',
    'label.badgeHint':   'Shown in bottom-left of pitch',
    // Opponent colors (inside match setup)
    'label.oppJersey':   'Jersey Color',
    'label.oppNumber':   'Number Color',
    'label.oppShorts':   'Shorts Color',
    'btn.apply':         'Apply',
    // Squad
    'ph.squadSearch':    'Search players…',
    'btn.addPlayer':     '+ Add',
    'squad.empty':       'No players yet — add your squad!',
    'squad.noMatches':   'No matches.',
    'squad.noPlayers':   'No players saved',
    'squad.count':       (n, active) => `${n} player${n>1?'s':''} · ${active} active`,
    'squad.markInactive':'Mark inactive',
    'squad.markActive':  'Mark active',
    'squad.edit':        'Edit',
    'squad.duplicate':   'Duplicate',
    'squad.delete':      'Delete',
    'squad.confirmDel':  'Remove this player from the squad?',
    'squad.noActive':    'No active squad players. Add players in Squad Management.',
    'squad.allUsed':     'All squad players are already in the lineup.',
    // Starting XI
    'col.name':          'Name',
    'col.shirt':         'Shirt #',
    'default.gk':        'Goalkeeper',
    'default.player':    (i) => `Player ${i}`,
    'default.sub':       (i) => `Sub ${i}`,
    // Substitutes
    'label.numSubs':     'Number of subs:',
    // Staff
    'staff.head':        'Head Coach',
    'staff.asst':        'Asst. Coach',
    'ph.coachName':      'Coach name',
    'ph.asstName':       'Assistant name',
    'label.jersey':      'Jersey',
    'label.initials':    'Initials',
    // Buttons
    'btn.remove':        'Remove',
    // Share
    'btn.copyLink':      '🔗 Copy Share Link',
    'toast.linkCopied':  'Link copied!',
    // Main buttons
    'btn.render':        '🎨 RENDER LINEUP',
    'btn.export':        '⬇ Export PNG',
    // Canvas
    'canvas.hint':       'Drag players to reposition · Changes re-render live',
    'canvas.bench':      'BENCH',
    'canvas.halfway':    'HALFWAY LINE',
    'canvas.opponent':   'Opponent',
    // Formation validation
    'form.invalid':      'Format: numbers separated by dashes (e.g. 4-3-3)',
    'form.minOne':       'Each line must have at least 1 player',
    'form.sumErr':       (n, got) => `Must sum to ${n} outfield players (got ${got})`,
    'form.sumErrShort':  (n, got) => `Must sum to ${n} (got ${got})`,
    'form.valid':        (v) => `✓ Valid — ${v}`,
    // Warnings
    'warn.dupShirt':     (n) => `Duplicate shirt #${n}`,
    'warn.dupPlayer':    (name) => `${name} appears more than once`,
    'warn.inactive':     (name) => `${name} is marked inactive`,
    // Validation (Phase 3)
    'val.allClear':          'Lineup looks good — no issues found',
    'val.summaryErrors':     (n) => `${n} error${n>1?'s':''}`,
    'val.summaryWarnings':   (n) => `${n} warning${n>1?'s':''}`,
    'val.noGK':              'GK slot has no name',
    'val.emptySlots':        (n) => `${n} starter slot${n>1?'s are':' is'} empty`,
    'val.gkMismatch':        (name) => `${name} is in GK slot but isn't a Goalkeeper`,
    'val.noDef':             'No defenders detected in starting XI',
    'val.noAtt':             'No attackers detected in starting XI',
    // Player Modal
    'modal.addPlayer':   'Add Player',
    'modal.editPlayer':  'Edit Player',
    'label.firstName':   'First Name',
    'label.lastName':    'Last Name',
    'label.displayName': 'Display Name',
    'label.displayHint': '(shown on jersey)',
    'ph.firstName':      'First',
    'ph.lastName':       'Last',
    'ph.displayName':    'Display name',
    'label.shirtNum':    'Shirt #',
    'label.strongFoot':  'Strong Foot',
    'opt.right':         'Right',
    'opt.left':          'Left',
    'opt.both':          'Both',
    'opt.unknown':       'Unknown',
    'label.playerType':  'Player Type',
    'opt.goalkeeper':    'Goalkeeper',
    'opt.defender':      'Defender',
    'opt.midfielder':    'Midfielder',
    'opt.attacker':      'Attacker',
    'opt.utility':       'Utility',
    'label.prefPos':     'Preferred Positions',
    'label.prefHint':    '(tap to select)',
    'label.secPos':      'Secondary Positions',
    'label.playerNotes': 'Notes',
    'ph.playerNotes':    'Optional coach notes',
    'label.active':      'Active player',
    'btn.cancel':        'Cancel',
    'btn.save':          'Save',
  },
  he: {
    // App name & header
    'app.name':       'רוטקטיקה',
    'header.tagline': 'ניהול רוטציה וטקטיקה לכל מאמן',
    // Sections
    'section.match':     'הגדרות משחק',
    'section.team':      'הגדרות קבוצה',
    'section.squad':     'ניהול סגל',
    'section.starting':  'הרכב פותח',
    'section.subs':      'ספסל מחליפים',
    'section.staff':     'צוות מקצועי',
    'section.share':     'שיתוף הרכב',
    'section.formation': 'מערך',
    // Navigation
    'nav.myClub':        'הקבוצה שלי',
    // Matches panel
    'matches.title':     'המשחקים שלי',
    'matches.new':       '+ משחק חדש',
    'matches.empty':     'אין משחקים עדיין — צור את הראשון!',
    'matches.untitled':  'משחק ללא שם',
    'matches.open':      'פתח ◀',
    // Match Setup
    'label.matchTitle':  'כותרת משחק',
    'ph.matchTitle':     'לדוג׳ גביע U12 חצי גמר',
    'label.date':        'תאריך',
    'label.format':      'פורמט',
    'opt.anyFormat':     '— הכל —',
    'label.opponent':    'יריב',
    'ph.opponent':       'שם קבוצת היריב',
    'label.showOnPitch': 'הצג יריב במגרש',
    'label.venue':       'מיקום',
    'ph.venue':          'שם האצטדיון / המגרש',
    'label.duration':    'משך (דק׳)',
    'label.periods':     'מחציות',
    'label.homeAway':    'בית / חוץ',
    'btn.home':          '🏠 בית',
    'btn.away':          '✈️ חוץ',
    'btn.neutral':       '⚖️ ניטרלי',
    'label.pitchSurface':'סוג מגרש',
    'btn.grass':         'דשא',
    'btn.hard':          'קשה',
    'btn.indoor':        'סגור',
    'label.notes':       'הערות',
    'ph.notes':          'הערות טקטיות, תזכורות…',
    // Team Setup
    'label.teamName':    'שם קבוצה',
    'label.jerseyColor': 'צבע חולצה',
    'label.numberColor': 'צבע מספר',
    'label.shortsColor': 'צבע מכנסיים',
    'label.gkJersey':    'חולצת שוער',
    'label.gkNumber':    'מספר שוער',
    'label.gkShorts':    'מכנסי שוער',
    'label.kitPattern':  'דוגמת חולצה',
    'label.patternHint': 'צבע דוגמה על גבי החולצה',
    'opt.plain':         'רגיל',
    'opt.vstripes':      'פסים אנכיים',
    'opt.hoops':         'טבעות',
    'opt.sash':          'אלכסון',
    'opt.halves':        'חצי-חצי',
    'opt.sleeves':       'שרוולים',
    'label.formation':   'מערך',
    'label.customForm':  'מערך בהתאמה אישית',
    'ph.customForm':     'לדוג׳ 4-2-3-1',
    'label.clubBadge':   'סמל מועדון',
    'label.badgeHint':   'מוצג בפינה של המגרש',
    // Opponent colors
    'label.oppJersey':   'צבע חולצה',
    'label.oppNumber':   'צבע מספר',
    'label.oppShorts':   'צבע מכנסיים',
    'btn.apply':         'החל',
    // Squad
    'ph.squadSearch':    'חפש שחקנים…',
    'btn.addPlayer':     '+ הוסף',
    'squad.empty':       'אין שחקנים עדיין — הוסף את הקבוצה!',
    'squad.noMatches':   'לא נמצאו תוצאות.',
    'squad.noPlayers':   'אין שחקנים שמורים',
    'squad.count':       (n, active) => `${n} שחקנ${n>1?'ים':''} · ${active} פעיל${active>1?'ים':''}`,
    'squad.markInactive':'סמן כלא פעיל',
    'squad.markActive':  'סמן כפעיל',
    'squad.edit':        'ערוך',
    'squad.duplicate':   'שכפל',
    'squad.delete':      'מחק',
    'squad.confirmDel':  'להסיר שחקן זה מהקבוצה?',
    'squad.noActive':    'אין שחקנים פעילים. הוסף שחקנים בניהול סגל.',
    'squad.allUsed':     'כל שחקני הקבוצה כבר בהרכב.',
    // Starting XI
    'col.name':          'שם',
    'col.shirt':         'מס׳',
    'default.gk':        'שוער',
    'default.player':    (i) => `שחקן ${i}`,
    'default.sub':       (i) => `חילוף ${i}`,
    // Substitutes
    'label.numSubs':     'מספר שחקני ספסל:',
    // Staff
    'staff.head':        'מאמן ראשי',
    'staff.asst':        'עוזר מאמן',
    'ph.coachName':      'שם מאמן',
    'ph.asstName':       'שם עוזר מאמן',
    'label.jersey':      'חולצה',
    'label.initials':    'ר״ת',
    // Buttons
    'btn.remove':        'הסר',
    // Share
    'btn.copyLink':      '🔗 העתק קישור שיתוף',
    'toast.linkCopied':  '!הקישור הועתק',
    // Main buttons
    'btn.render':        '🎨 צייר הרכב',
    'btn.export':        '⬇ ייצוא PNG',
    // Canvas
    'canvas.hint':       'גרור שחקנים לשינוי מיקום · שינויים מתעדכנים בזמן אמת',
    'canvas.bench':      'ספסל',
    'canvas.halfway':    'קו אמצע',
    'canvas.opponent':   'יריב',
    // Formation validation
    'form.invalid':      'פורמט: מספרים מופרדים במקפים (לדוג׳ 4-3-3)',
    'form.minOne':       'כל שורה חייבת לכלול לפחות שחקן אחד',
    'form.sumErr':       (n, got) => `הסכום חייב להיות ${n} שחקני שדה (קיבלת ${got})`,
    'form.sumErrShort':  (n, got) => `הסכום חייב להיות ${n} (קיבלת ${got})`,
    'form.valid':        (v) => `✓ תקין — ${v}`,
    // Warnings
    'warn.dupShirt':     (n) => `מספר חולצה כפול #${n}`,
    'warn.dupPlayer':    (name) => `${name} מופיע יותר מפעם אחת`,
    'warn.inactive':     (name) => `${name} מסומן כלא פעיל`,
    // Validation (Phase 3)
    'val.allClear':          'ההרכב תקין — לא נמצאו בעיות',
    'val.summaryErrors':     (n) => `${n} שגיאה${n>1?'ות':''}`,
    'val.summaryWarnings':   (n) => `${n} אזהרה${n>1?'ות':''}`,
    'val.noGK':              'משבצת שוער ריקה',
    'val.emptySlots':        (n) => `${n} משבצת${n>1?'ות':''} ריק${n>1?'ות':'ה'} בהרכב`,
    'val.gkMismatch':        (name) => `${name} בעמדת שוער אך אינו שוער`,
    'val.noDef':             'לא נמצאו מגנים בהרכב הפתיחה',
    'val.noAtt':             'לא נמצאו חלוצים בהרכב הפתיחה',
    // Player Modal
    'modal.addPlayer':   'הוסף שחקן',
    'modal.editPlayer':  'ערוך שחקן',
    'label.firstName':   'שם פרטי',
    'label.lastName':    'שם משפחה',
    'label.displayName': 'שם תצוגה',
    'label.displayHint': '(מוצג על החולצה)',
    'ph.firstName':      'שם פרטי',
    'ph.lastName':       'שם משפחה',
    'ph.displayName':    'שם תצוגה',
    'label.shirtNum':    'מספר חולצה',
    'label.strongFoot':  'רגל דומיננטית',
    'opt.right':         'ימין',
    'opt.left':          'שמאל',
    'opt.both':          'שתיים',
    'opt.unknown':       'לא ידוע',
    'label.playerType':  'תפקיד שחקן',
    'opt.goalkeeper':    'שוער',
    'opt.defender':      'מגן',
    'opt.midfielder':    'קשר',
    'opt.attacker':      'חלוץ',
    'opt.utility':       'רב-תפקידי',
    'label.prefPos':     'עמדות מועדפות',
    'label.prefHint':    '(הקש לבחירה)',
    'label.secPos':      'עמדות משניות',
    'label.playerNotes': 'הערות',
    'ph.playerNotes':    'הערות מאמן (אופציונלי)',
    'label.active':      'שחקן פעיל',
    'btn.cancel':        'ביטול',
    'btn.save':          'שמור',
  }
};

let currentLang = 'en';

function t(key, ...args) {
  const val = (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS.en[key];
  if (typeof val === 'function') return val(...args);
  return val || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('flc_lang', lang);
  document.documentElement.dir  = lang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = lang;
  applyTranslations();
  if (typeof renderMatchCard     === 'function') renderMatchCard();
  if (typeof checkWarnings       === 'function') checkWarnings();
  if (typeof render              === 'function') render();
}

function loadLanguage() {
  const saved = localStorage.getItem('flc_lang') || 'en';
  currentLang = saved;
  document.documentElement.dir  = saved === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = saved;
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = saved;
  applyTranslations();
}
