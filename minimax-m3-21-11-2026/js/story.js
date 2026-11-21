// ---------------------------------------------------------------------------
// THE TIDE ENGINE — narrative content
// ---------------------------------------------------------------------------

export const SPEAKERS = {
  WREN:        { name: 'WREN',              col: '#ffd7a3', voice: 'wren' },
  HARBORMASTER:{ name: 'HARBORMASTER OKONJO', col: '#7dffb4', voice: 'radio' },
  ENGINE:      { name: 'THE ENGINE',        col: '#ff9a6e', voice: 'stamp' },
  ARCHIVE:     { name: 'ARCHIVE — M. VALE',  col: '#c6a8ff', voice: 'radio' },
  LIGHT:       { name: 'FLOODLIGHT WALKWAY', col: '#9fd4ff', voice: 'radio' },
  ILSE:        { name: 'ILSE (RECORDING)',   col: '#ff9ec4', voice: 'warm' },
  SYS:         { name: '',                  col: '#8fd8ff', voice: 'sys' },
};

export const INTRO = [
  'ANEMONE WENT UNDER FORTY YEARS AGO.',
  'THE SEA TOOK THE STREETS. THE SEA TOOK THE BELLS. THE SEA TOOK THE PEOPLE.',
  'IT DID NOT TAKE THE ENGINE.',
  'THE TIDE ENGINE STILL TURNS. STILL KEEPS THE UPPER CITY DRY. IT HAS NEVER STOPPED.',
  'TONIGHT IS THE SPRING TIDE. THE ENGINE MUST BE WOUND TO FULL BEFORE DAWN — OR THE SEA COMES BACK FOR THE REST.',
  'YOU ARE WREN. YOU ARE ON THE NIGHT SHIFT.',
  'THE INSTRUMENT IS IN FRONT OF YOU.',
];

export const ACT_LINES = {
  1: [
    { at: 0.000, sp: 'HARBORMASTER', t: 'WREN. THE SEA IS CHEWING THE VENN WALL AGAIN. WIND HER UP. FULL — YOU HEAR ME? FULL.' },
    { at: 0.020, sp: 'WREN', t: "PRESSING IT ISN'T THE PROBLEM. THE PROBLEM IS SHE WON'T HOLD A NOTE." },
    { at: 0.040, sp: 'HARBORMASTER', t: "SHE'S HAD ELEVEN YEARS OF HER SISTER IN HER PIPES. LET HER SING." },
    { at: 0.120, sp: 'WREN', t: 'HOLD [A] AND [D]. KEEP THE NEEDLE IN THE LIT BAND. SHE HUMS SWEET WHEN YOU ARE RIGHT.' },
    { at: 0.560, sp: 'ENGINE', t: 'GOOD. NOW THE SONG.' },
    { at: 0.780, sp: 'HARBORMASTER', t: "DON'T LET HER SONG OUT. THE ENGINE ISN'T A CHOIR. IT IS A LOCK." },
    { at: 0.930, sp: 'ENGINE', t: 'THREE HUNDRED AND SIXTY PRESSURE TO THE SECOND. HOLD HER, WREN.' },
  ],
  2: [
    { at: 0.000, sp: 'ENGINE', t: 'THE CHOIR HAS LOST ITS TEMPO. CATCH THE NOTES AS THEY PASS. DO NOT LET THEM FALL.' },
    { at: 0.030, sp: 'WREN', t: "THAT'S ILSE. THAT'S HER VOICE IN THE VALVES. HOLD IT STEADY…" },
    { at: 0.560, sp: 'ENGINE', t: 'SHE IS CLOSE. THE VERSE IS CLOSE.' },
    { at: 0.860, sp: 'WREN', t: 'IF I TUNE HER BY EAR, THE SONG COMES BACK. ONE VERSE. ONE MORE VERSE.' },
  ],
  3: [
    { sec: 0.0, sp: 'HARBORMASTER', t: 'WREN. I HAVE THREE THINGS WANTING YOUR HANDS AND ONE PAIR OF HANDS.' },
    { sec: 3.0, sp: 'WREN', t: 'I KNOW. THE ENGINE FIRST. ALWAYS THE ENGINE FIRST.' },
  ],
  4: [
    { sec: 0.0, sp: 'ENGINE', t: 'THE CORE IS OPEN. THREE RINGS. TURN THEM UNTIL THE SONG LINES UP.' },
    { sec: 9.0, sp: 'WREN', t: 'ELEVEN YEARS. ONE VERSE. ONE VALVE.' },
    { sec: 22.0, sp: 'ENGINE', t: 'TWO VALVES. ONE STOPS THE SEA. ONE FINISHES THE SONG. THE ENGINE WILL NOT OPEN BOTH.' },
    { sec: 27.0, sp: 'ILSE', t: '…WREN?' },
  ],
};

// Radio calls — each carries a decision with consequences.
export const CALLS = [
  {
    id: 'wall',
    sp: 'HARBORMASTER',
    t: 'VENN WALL IS BREACHING. I CAN DUMP THE PRESSURE INTO THE WALL, OR INTO THE OLD TOWN. YOUR CALL, WREN.',
    choices: [
      { label: 'INTO THE WALL', sub: 'the old town floods', set: { wallSaved: true, oldTownFlooded: true }, cost: 0.0,
        after: 'THE WALL TOOK IT. THE OLD TOWN IS TAKING WATER NOW. THE ARCHIVE IS UNDER.', log: 'PRESSURE DIVERTED — VENN WALL — SHE HELD' },
      { label: 'INTO THE OLD TOWN', sub: 'the wall is left thin', set: { wallFailed: true, oldTownSafe: true }, cost: 0.05,
        after: 'THE OLD TOWN IS DRY. THE WALL IS THIN. LOWER BLOCKS WILL FLOOD FIRST.', log: 'PRESSURE DIVERTED — LOWER BLOCKS — THE WALL IS THIN' },
    ],
  },
  {
    id: 'walkway',
    sp: 'LIGHT',
    t: 'IS ANYONE THERE? THERE IS A PERSON ON THE FLOODLIGHT WALKWAY. THEY ARE WAVING.',
    choices: [
      { label: 'GO TO THEM', sub: 'six minutes you did not have', set: { savedStranger: true }, cost: 0.18,
        after: 'YOU WENT OUT ON THE WALKWAY IN THE DARK. IT TOOK SIX MINUTES YOU DID NOT HAVE. THE KID WAS COLD AND SHAKING AND ALIVE.',
        log: 'WALKWAY — SECTION 6 — RECOVERED ONE' },
      { label: 'THE ENGINE FIRST', sub: 'the light goes on without you', set: { leftStranger: true }, cost: 0.0,
        after: 'YOU DID NOT GO. THE ENGINE DID NOT ASK YOU TO. THE LIGHT ON THE WALKWAY WENT ON WITHOUT YOU.',
        log: 'WALKWAY — SECTION 6 — NO ANSWER' },
    ],
  },
  {
    id: 'archive',
    sp: 'ARCHIVE',
    t: 'WE CAN SAVE THE RECORDS OR THE PUMPS. NOT BOTH, GIRL. THE SEA IS COMING FOR THE SHELVES.',
    choices: [
      { label: 'SAVE THE RECORDS', sub: 'four hundred drowned names', set: { recordsSaved: true, pumpsIdle: true }, cost: 0.10,
        after: 'MRS VALE CRIES INTO THE RADIO AND THEN STOPS CRYING, WHICH IS WORSE. FOUR HUNDRED NAMES, DRY.',
        log: 'ARCHIVE — LOWER SHELVES — PRESERVED' },
      { label: 'SAVE THE PUMPS', sub: 'the pumps keep the blocks dry', set: { pumpsSaved: true, recordsLost: true }, cost: 0.0,
        after: 'THE PUMPS STAY LIT. THE LOWER SHELVES GO UNDER. MRS VALE SAYS THAT IS ALRIGHT, FOUR TIMES.',
        log: 'ARCHIVE — LOWER SHELVES — SUBMERGED' },
    ],
  },
  {
    id: 'ilse',
    sp: 'ILSE',
    t: 'WREN? WREN, IS THAT YOU? I DO NOT REMEMBER THE LAST VERSE. TELL ME THE LAST VERSE.',
    choices: [
      { label: 'TELL HER', sub: 'hum what you tuned', set: { toldHer: true }, cost: 0.0,
        after: 'YOU HUM IT. BADLY. SHE Hums IT BACK, ONE NOTE OUT OF TIME, AND LAUGHS — AND THE LAUGH IS ELEVEN YEARS OLD.',
        log: 'CORE MEMORY — CHANNEL OPEN — LAST VERSE SENT' },
      { label: 'SAY NOTHING', sub: 'some doors stay shut', set: { silentToHer: true }, cost: 0.0,
        after: 'YOU SAY NOTHING. THE RADIO MAKES A SOUND LIKE SOMEONE LETTING GO OF A HANDLE. YOU HOLD ON.',
        log: 'CORE MEMORY — CHANNEL OPEN — NO REPLY' },
    ],
  },
  {
    id: 'verse',
    sp: 'ENGINE',
    t: 'THE SONG HAS TWO VERSES. ONE FOR THE SEA. ONE FOR HER. I CAN ONLY CARRY ONE. THE OTHER I WILL LOSE.',
    choices: [
      { label: 'THE SEA’S VERSE', sub: 'the water forgets its hunger', set: { seaVerse: true }, cost: 0.0,
        after: 'THE SEA GAVE UP ITS VERSE TO THE WALL. THE WALL IS THICK TONIGHT. THE WATER HAS FORGOTTEN WHAT IT CAME FOR.',
        log: 'THE ENGINE CARRIES THE SEA’S VERSE — THE WALL IS THICK' },
      { label: 'HERS', sub: 'the wall goes on thin', set: { herVerse: true }, cost: 0.08,
        after: 'THE ENGINE KEPT HER VERSE. THE SEA KEPT ITS SONG. THE WALL IS THIN AS PAPER AND THE SEA IS SINGING.',
        log: 'THE ENGINE CARRIES HER VERSE — THE WALL IS THIN' },
    ],
  },
];

export const FINAL_WARNING = {
  sp: 'HARBORMASTER',
  t: 'SPRING TIDE IS OVER THE SEAWALL. WIND HER UP OR THE CORE GOES UNDER.',
};

// The final, irreversible choice.
export const FINAL_CHOICES = [
  {
    id: 'pump',
    label: 'OPEN THE WALL GATES',
    sub: 'stop the sea',
    hint: 'The Engine is spent. The song is finished. The city stays dry.',
  },
  {
    id: 'memory',
    label: 'LET THE SONG FINISH',
    sub: 'finish the verse',
    hint: 'The Engine sings. The sea comes in. She comes back for one line.',
  },
];

export const ENDINGS = {
  pump: [
    'YOU OPENED THE GATES.',
    'THE SPRING TIDE BROKE ITS TEETH ON THE OLD WALL AND THE OLD WALL HELD.',
    { cond: 'seaVerse', t: 'THE SEA HAD GIVEN UP ITS SONG TO THE WALL. THE WALL HELD LIKE IT HAD NEVER BEEN ASKED.' },
    { cond: 'herVerse', t: 'THE WALL HAD GIVEN UP ITS SONG TO THE ENGINE. THE WALL HELD ANYWAY, ON THIN PAPER AND LUCK.' },
    "THE ENGINE DID NOT MAKE A SOUND. IT HAD NO SONG LEFT. THE PIPES WENT COLD ONE BY ONE, LIKE FINGERS LETTING GO.",
    { cond: 'savedStranger', t: "THERE WAS A KID ON THE STEP OF THE PUMP HOUSE WITH A JAR OF SEA GLASS. 'I HEARD YOU,' BEX SAID. 'THE WHOLE CITY HEARD YOU.'" },
    { cond: '!savedStranger', t: 'THERE WAS NO ONE ON THE STEP OF THE PUMP HOUSE. THE FLOODLIGHT WALKWAY IS EMPTY NOW, AND THE TIDE HAS TAKEN IT.' },
    "IN THE MORNING THE HARBORMASTER FOUND YOU ASLEEP ON THE FLOOR WITH YOUR HAND STILL ON THE VALVE.",
    "'GOOD NIGHT,' HE SAID. 'BAD NIGHT. BUT GOOD.'",
    'THE CITY WAS DRY. THE SONG WAS NOT.',
    'SOMEWHERE UNDER THE WATER A VOICE IS STILL ASKING FOR THE LAST VERSE.',
  ],
  memory: [
    'THE CORE SANG.',
    "ILSE'S VOICE CAME UP THROUGH THE IRON LIKE SOMETHING THAT HAD BEEN WAITING A LONG TIME TO BE HEARD.",
    { cond: 'toldHer', t: "'YOU GOT IT,' SHE SAID. 'THE LAST VERSE. THANK YOU, WREN.'" },
    { cond: '!toldHer', t: "'I DON'T REMEMBER,' SHE SAID. 'I'M SORRY, WREN. I'M SORRY, I DON'T REMEMBER.'" },
    'THE ENGINE WENT OUT LIKE A HELD BREATH.',
    'AND THEN THE SEA CAME IN.',
    { cond: 'seaVerse', t: 'THE SEA HAD NOTHING LEFT TO SAY. IT CAME IN QUIETLY, LIKE A HELD EXHALE.' },
    { cond: 'herVerse', t: 'THE SEA CAME IN SINGING. IT SANG THE VERSE IT GAVE UP, WHICH WAS THE WRONG ONE.' },
    "IT DID NOT SOUND LIKE WATER. IT SOUNDED LIKE AN APOLOGY.",
    'THE UPPER CITY WENT UNDER THE WAY A WOUND GOES UNDER SOMETHING BIG AND MERCIFUL AND TERRIBLE.',
    'THE LAMPS WENT OUT ONE BY ONE, LIKE NOTES.',
    { cond: 'savedStranger', t: 'BEX WAS ON THE ROOF OF THE PUMP HOUSE WITH THE WHOLE STREET, AND THE WHOLE STREET SANG.' },
    { cond: '!savedStranger', t: 'NOBODY WAS ON THE ROOF OF THE PUMP HOUSE. THE WATER TOOK IT FIRST.' },
    'THE SONG YOU TUNED TONIGHT IS THE SONG SHE WILL SING FOREVER.',
  ],
};

export const CODA = [
  'ANEMONE WENT UNDER FORTY YEARS AGO.',
  'THE SEA TOOK THE STREETS. THE BELLS. THE PEOPLE.',
  'IT DID NOT TAKE THE ENGINE.',
  'TONIGHT THE ENGINE TOOK THE REST.',
];

export const LOG_LINES = {
  1: [
    'REV. 11 — CHOIR RECALIBRATED — wren, 03:14',
    'LINE 4 TRIMMED TO 41% — auto',
    'PRESSURE MEMBRANE 7 — WITHIN TOLERANCE',
    'A NOTE ABOUT NOTES: THE ENGINE KEEPS TIME BETTER THAN THE PEOPLE WHO BUILT HER',
    'VALVE 12 LUBRICATED — 11 YEARS — STILL GOOD',
    'THE ENGINE DOES NOT MIND THE WAIT. THE ENGINE HAS NEVER MINDED ANYTHING.',
  ],
  2: [
    'SHEET 9 — CHOIR PIPES — 31 VESSELS — 4 SILENT',
    'NOTE: THE SONG WAS NEVER FOR THE SEA',
    'TEMPO DRIFT +2.1 BPM — CORRECTING',
    'THE FOURTH VESSEL IS THE ONE SHE DIED IN',
    '31 VESSELS, 30 VOICES, 1 LISTENER',
  ],
  3: [
    'SHEET 2 — UPPER ANEMONE — PONTOON PLAN',
    'SHEET 3 — LOWER ANEMONE — SUBMERGED 1979',
    'TIDE TABLE 04:51 — 5.4 M',
    'WE DO NOT WRITE DOWN WHAT THE WALL COULD NOT HOLD',
    'EVERY CALL COSTS THE ENGINE A SECOND OF SLEEP',
  ],
  4: [
    'FIG. 4 — THE CORE — SECTION A–A',
    'THE CORE HAS NO SCHEDULE. THE CORE HAS A MEMORY',
    'ONE VALVE STOPS THE SEA. ONE VALVE FINISHES THE SONG',
    'ELEVEN YEARS AND THE SONG IS STILL ONE VERSE SHORT',
    'SELECTION IS FINAL — THERE IS NO UNWIND ON THIS INSTRUMENT',
  ],
};

// Ilse's song — the chart the player catches in Act II.
// step = eighth notes from the top of the sweep revolution.
export const SONG = [
  { s: 0, m: 57 }, { s: 2, m: 60 }, { s: 4, m: 62 }, { s: 6, m: 64 }, { s: 8, m: 62 }, { s: 10, m: 60 }, { s: 12, m: 57 },
  { s: 16, m: 60 }, { s: 18, m: 64 }, { s: 20, m: 67 }, { s: 22, m: 64 }, { s: 24, m: 62 }, { s: 26, m: 60 }, { s: 28, m: 57 },
  { s: 32, m: 59 }, { s: 34, m: 60 }, { s: 36, m: 62 }, { s: 38, m: 64 }, { s: 40, m: 67 }, { s: 42, m: 69 }, { s: 44, m: 67 },
  { s: 48, m: 64 }, { s: 50, m: 62 }, { s: 52, m: 60 }, { s: 54, m: 57 }, { s: 56, m: 60 }, { s: 58, m: 64 }, { s: 60, m: 62 }, { s: 62, m: 60 },
  { s: 64, m: 57 }, { s: 66, m: 60 }, { s: 68, m: 62 }, { s: 70, m: 64 }, { s: 72, m: 67 }, { s: 74, m: 69 }, { s: 76, m: 67 },
  { s: 78, m: 64 }, { s: 80, m: 62 }, { s: 82, m: 60 }, { s: 84, m: 57 },
  { s: 88, m: 55 }, { s: 90, m: 57 }, { s: 92, m: 60 }, { s: 94, m: 62 }, { s: 96, m: 60 }, { s: 98, m: 57 }, { s: 100, m: 55 },
  { s: 104, m: 57 }, { s: 106, m: 60 }, { s: 108, m: 64 }, { s: 110, m: 67 }, { s: 112, m: 64 }, { s: 114, m: 62 }, { s: 116, m: 60 },
  { s: 120, m: 59 }, { s: 122, m: 60 }, { s: 124, m: 62 }, { s: 126, m: 64 }, { s: 128, m: 67 }, { s: 130, m: 69 },
  { s: 132, m: 71 }, { s: 134, m: 72 }, { s: 136, m: 71 }, { s: 138, m: 69 }, { s: 140, m: 67 }, { s: 142, m: 64 },
  { s: 144, m: 62 }, { s: 146, m: 60 }, { s: 148, m: 57 },
];

export const TIPS = {
  1: { title: 'THE VALVE', body: 'HOLD  [A]  /  [D]   (or drag the dial)\nKEEP THE NEEDLE INSIDE THE LIT BAND' },
  2: { title: 'THE SWEEP', body: 'PRESS  [SPACE]   WHEN THE SWEEP CROSSES A NOTE\nTHE VALVE STILL NEEDS YOU' },
  3: { title: 'COMMS', body: 'PRESS  [1]  OR  [2]   TO ANSWER A CALL\nEVERY CALL COSTS YOU SECONDS' },
  4: { title: 'THE CORE', body: '[UP]/[DOWN] SELECT RING     [LEFT]/[RIGHT] TURN\nHOLD  [ENTER]  TO COMMIT A VALVE' },
};
