/* Majlis result card artwork: real emblems for ideologies and faiths, each theme's background scene and
   flavour layer, and the cut-out of the closest leader that pops out of the card.
   Loaded before app.js; everything here is used by buildResultCard(). */
(function(){
'use strict';
const ASSET_V = '1';

/* ---------- emblems ---------- */
// First match wins. Each key is a picture in card/emblems/.
const IDEOLOGY_EMBLEMS = [
  [/christian democra/i, 'cdshield'],
  [/one[- ]nation|paternalis|tory democra/i, 'primrose'],
  [/national[- ]conserv/i, 'natcon'],
  [/monarch|royalis|legitimis|absolutis|jacobit|carlis/i, 'crown'],
  [/anarcho[- ]?capital|ancap/i, 'ancap'],
  [/anarcho[- ]?(syndical|communis)|libertarian socialis|syndicalis/i, 'redblack'],
  [/anarch/i, 'anarchy'],
  [/libertarian|minarch|paleolibertar|voluntar/i, 'gadsden'],
  [/communis|marxis|lenin|maois|trotsk|stalin|hoxha|juche/i, 'hammer'],
  [/social democra|third way|labou?r(ism)?\b/i, 'rose'],
  [/socialis|eco[- ]?marx/i, 'redflag'],
  [/green|ecolog|environment|eco[- ]/i, 'green'],
  [/kemal/i, 'kemal'],
  [/gaull/i, 'lorraine'],
  [/pan[- ]?african|garvey/i, 'panafrican'],
  [/pan[- ]?arab|nasser|ba.?ath/i, 'arabrevolt'],
  [/islam|muslim|salaf|khilaf|caliph/i, 'crescent'],
  [/zionis|jewish/i, 'david'],
  [/hindutva|hindu/i, 'om'],
  [/buddhis/i, 'dharma'],
  [/feminis/i, 'venus'],
  [/christian|catholic|integralis|theonom|clerical/i, 'cross'],
];
const FAITH_EMBLEMS = { 'Christianity': 'cross', 'Islam': 'crescent', 'Judaism': 'david', 'Hinduism': 'om', 'Buddhism': 'dharma',
  'Sikhism': 'khanda', "Bahá'í Faith": 'ninestar', 'Taoism': 'yinyang', 'Shinto': 'torii', 'Paganism / Wicca': 'pentacle', 'Atheism': 'atom' };
const emblemUrl = (key) => 'card/emblems/' + key + '.png?v=' + ASSET_V;
window.cardIdeologyEmblem = (name) => { const hit = IDEOLOGY_EMBLEMS.find(([re]) => re.test(name || '')); return hit ? emblemUrl(hit[1]) : null; };
window.cardFaithEmblem = (religion) => FAITH_EMBLEMS[religion] ? emblemUrl(FAITH_EMBLEMS[religion]) : null;

/* ---------- background scenes ---------- */
const sceneCache = {};
window.cardSceneSVG = (theme) => sceneCache[theme] || null;
window.loadCardScene = (theme) => {
  if(sceneCache[theme]) return Promise.resolve(sceneCache[theme]);
  return fetch('card/scenes/' + theme + '.svg?v=' + ASSET_V).then(r => r.ok ? r.text() : null)
    .then(t => { if(t && /^<svg[\s>]/.test(t)) sceneCache[theme] = t; return sceneCache[theme] || null; })
    .catch(() => null);
};

/* ---------- flavour layer (drawn on the 864 x 1536 sketch, scaled with the card) ---------- */
const OVERLAYS = {
"dark": "<path d=\"M34 388V366H56 M470 366H492V388 M492 1146V1168H470 M56 1168H34V1146\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"4\"/><path d=\"M505 390V368H527 M848 368H870V390 M870 660V682H848 M527 682H505V660\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"4\"/><path d=\"M505 702V680H527 M848 680H870V702 M870 906V928H848 M527 928H505V906\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"4\"/><path d=\"M505 948V926H527 M848 926H870V948 M870 1146V1168H848 M527 1168H505V1146\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"4\"/><path d=\"M34 1208V1186H56 M654 1186H676V1208 M676 1450V1472H654 M56 1472H34V1450\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"4\"/><path d=\"M684 1208V1186H706 M848 1186H870V1208 M870 1450V1472H848 M706 1472H684V1450\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"4\"/><text x=\"46\" y=\"122\" font-family=\"VT323,monospace\" font-size=\"21\" fill=\"#00ff66\">root@majlis:~$ ./compass --scan</text><text x=\"46\" y=\"146\" font-family=\"VT323,monospace\" font-size=\"21\" fill=\"#00ff66\" opacity=\".75\">[████████████████] 100%  MATCH FOUND</text><text x=\"640\" y=\"122\" font-family=\"VT323,monospace\" font-size=\"19\" fill=\"#00ff66\" opacity=\".7\">SIGNAL ▮▮▮▮▯  ENC:AES</text>",
"light": "<text x=\"48\" y=\"118\" font-family=\"Georgia,serif\" font-size=\"17\" letter-spacing=\"4\" fill=\"#0b6b3a\">OFFICIAL RECORD · VOL. I · No. 1</text><line x1=\"48\" y1=\"128\" x2=\"330\" y2=\"128\" stroke=\"#0b6b3a\" stroke-width=\"1.5\"/><g transform=\"translate(462 344) rotate(-14)\"><circle r=\"40\" fill=\"#a3122a\"/><circle r=\"32\" fill=\"none\" stroke=\"#ffd7a8\" stroke-width=\"2\" stroke-dasharray=\"4 3\"/><text y=\"-3\" text-anchor=\"middle\" font-family=\"Georgia,serif\" font-weight=\"700\" font-size=\"12\" fill=\"#ffd7a8\">CERTIFIED</text><text y=\"13\" text-anchor=\"middle\" font-family=\"Georgia,serif\" font-size=\"10\" fill=\"#ffd7a8\">MAJLIS</text></g>",
"mint": "<g transform=\"translate(28 392) rotate(-20) scale(1)\"><path d=\"M0 0 C 20 -10 40 -10 60 -30\" stroke=\"#0e9e53\" stroke-width=\"3\" fill=\"none\"/><path transform=\"translate(12.0 0.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(24.0 -18.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(36.0 -12.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(48.0 -30.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(57.0 -22.5) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/></g><g transform=\"translate(500 1182) rotate(200) scale(0.9)\"><path d=\"M0 0 C 20 -10 40 -10 60 -30\" stroke=\"#0e9e53\" stroke-width=\"3\" fill=\"none\"/><path transform=\"translate(12.0 0.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(24.0 -18.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(36.0 -12.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(48.0 -30.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(57.0 -22.5) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/></g><g transform=\"translate(860 700) rotate(160) scale(0.8)\"><path d=\"M0 0 C 20 -10 40 -10 60 -30\" stroke=\"#0e9e53\" stroke-width=\"3\" fill=\"none\"/><path transform=\"translate(12.0 0.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(24.0 -18.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(36.0 -12.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(48.0 -30.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(57.0 -22.5) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/></g><g transform=\"translate(52 1450) rotate(10) scale(0.8)\"><path d=\"M0 0 C 20 -10 40 -10 60 -30\" stroke=\"#0e9e53\" stroke-width=\"3\" fill=\"none\"/><path transform=\"translate(12.0 0.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(24.0 -18.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(36.0 -12.0) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(48.0 -30.0) rotate(-40)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/><path transform=\"translate(57.0 -22.5) rotate(30)\" d=\"M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z\" fill=\"#3fd6a0\" stroke=\"#0e9e53\" stroke-width=\"1.5\"/></g><g transform=\"translate(470 368)\"><ellipse rx=\"16\" ry=\"13\" fill=\"#e03131\"/><path d=\"M0 -13V13\" stroke=\"#000\" stroke-width=\"2\"/><circle cx=\"-7\" cy=\"-3\" r=\"3\"/><circle cx=\"7\" cy=\"4\" r=\"3\"/><circle cx=\"-5\" cy=\"7\" r=\"2.4\"/><circle cy=\"-15\" r=\"7\" fill=\"#111\"/></g><g transform=\"translate(700 1178)\" font-family=\"Nunito,sans-serif\"><rect x=\"-6\" y=\"-24\" width=\"150\" height=\"30\" rx=\"15\" fill=\"#fff\" opacity=\".85\"/><text x=\"69\" y=\"-4\" text-anchor=\"middle\" font-size=\"16\" font-weight=\"800\" fill=\"#0e9e53\">fresh take ✿</text></g><ellipse cx=\"500\" cy=\"690\" rx=\"6\" ry=\"8\" fill=\"#fff\" fill-opacity=\".7\" stroke=\"#3fd6a0\" stroke-width=\"1.5\"/><ellipse cx=\"28\" cy=\"700\" rx=\"6\" ry=\"8\" fill=\"#fff\" fill-opacity=\".7\" stroke=\"#3fd6a0\" stroke-width=\"1.5\"/><ellipse cx=\"846\" cy=\"1000\" rx=\"6\" ry=\"8\" fill=\"#fff\" fill-opacity=\".7\" stroke=\"#3fd6a0\" stroke-width=\"1.5\"/><ellipse cx=\"498\" cy=\"1460\" rx=\"6\" ry=\"8\" fill=\"#fff\" fill-opacity=\".7\" stroke=\"#3fd6a0\" stroke-width=\"1.5\"/><ellipse cx=\"684\" cy=\"1170\" rx=\"6\" ry=\"8\" fill=\"#fff\" fill-opacity=\".7\" stroke=\"#3fd6a0\" stroke-width=\"1.5\"/>",
"glass": "<defs><linearGradient id=\"pr\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#ff7ad9\"/><stop offset=\".33\" stop-color=\"#ffd27a\"/><stop offset=\".66\" stop-color=\"#35f28a\"/><stop offset=\"1\" stop-color=\"#5a6eff\"/></linearGradient></defs><g transform=\"translate(70 230) rotate(-18)\"><path d=\"M0 40 L40 -30 L80 40Z\" fill=\"#fff\" fill-opacity=\".12\" stroke=\"#fff\" stroke-opacity=\".7\" stroke-width=\"2\"/><path d=\"M60 10 L260 -40 L260 -10 Z\" fill=\"url(#pr)\" opacity=\".55\"/></g><circle cx=\"500\" cy=\"330\" r=\"22\" fill=\"url(#bub)\" stroke=\"#fff\" stroke-opacity=\".5\"/><circle cx=\"30\" cy=\"1178\" r=\"16\" fill=\"url(#bub)\" stroke=\"#fff\" stroke-opacity=\".5\"/><circle cx=\"846\" cy=\"1170\" r=\"12\" fill=\"url(#bub)\" stroke=\"#fff\" stroke-opacity=\".5\"/><circle cx=\"470\" cy=\"1480\" r=\"18\" fill=\"url(#bub)\" stroke=\"#fff\" stroke-opacity=\".5\"/><defs><radialGradient id=\"bub\" cx=\".35\" cy=\".3\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".7\"/><stop offset=\".3\" stop-color=\"#fff\" stop-opacity=\".1\"/><stop offset=\"1\" stop-color=\"#8fa2ff\" stop-opacity=\".25\"/></radialGradient></defs>",
"esports": "<path d=\"M32 390V364H58 M468 364H494V390 M494 1144V1170H468 M58 1170H32V1144\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"5\"/><path d=\"M503 392V366H529 M846 366H872V392 M872 658V684H846 M529 684H503V658\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"5\"/><path d=\"M503 704V678H529 M846 678H872V704 M872 904V930H846 M529 930H503V904\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"5\"/><path d=\"M503 950V924H529 M846 924H872V950 M872 1144V1170H846 M529 1170H503V1144\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"5\"/><path d=\"M32 1210V1184H58 M652 1184H678V1210 M678 1448V1474H652 M58 1474H32V1448\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"5\"/><path d=\"M682 1210V1184H708 M846 1184H872V1210 M872 1448V1474H846 M708 1474H682V1448\" fill=\"none\" stroke=\"#00ff66\" stroke-width=\"5\"/><g transform=\"translate(46 112)\"><rect width=\"104\" height=\"30\" fill=\"#e8001c\"/><circle cx=\"16\" cy=\"15\" r=\"6\" fill=\"#fff\"/><text x=\"30\" y=\"23\" font-family=\"Barlow Condensed,sans-serif\" font-style=\"italic\" font-weight=\"800\" font-size=\"22\" fill=\"#fff\">LIVE</text></g><g transform=\"translate(46 150)\"><text font-family=\"Barlow Condensed,sans-serif\" font-style=\"italic\" font-weight=\"800\" font-size=\"24\" fill=\"#00ff66\" y=\"18\">PLAYER 1 · RANKED</text></g><g transform=\"translate(826 392)\"><path d=\"M0 -36 L31 -18 L31 18 L0 36 L-31 18 L-31 -18Z\" fill=\"#05070a\" stroke=\"#00ff66\" stroke-width=\"4\"/><text y=\"14\" text-anchor=\"middle\" font-family=\"Barlow Condensed,sans-serif\" font-style=\"italic\" font-weight=\"800\" font-size=\"40\" fill=\"#ffcc00\">S</text></g><g transform=\"translate(560 240) rotate(-6)\"><rect width=\"270\" height=\"44\" fill=\"#05070a\" stroke=\"#00ff66\" stroke-width=\"3\"/><text x=\"135\" y=\"32\" text-anchor=\"middle\" font-family=\"Barlow Condensed,sans-serif\" font-style=\"italic\" font-weight=\"800\" font-size=\"30\" fill=\"#00ff66\">MATCH FOUND</text></g>",
"retro": "<g transform=\"translate(560 108)\"><path d=\"M0 0 H230 V96 H70 L40 122 L48 96 H0Z\" fill=\"#ffffe1\" stroke=\"#000\" stroke-width=\"2\"/><text x=\"12\" y=\"26\" font-family=\"VT323,monospace\" font-size=\"21\">It looks like you’re a</text><text x=\"12\" y=\"48\" font-family=\"VT323,monospace\" font-size=\"21\">{{IDEO}}!</text><rect x=\"12\" y=\"62\" width=\"62\" height=\"24\" fill=\"#c0c0c0\" stroke=\"#000\"/><text x=\"43\" y=\"80\" text-anchor=\"middle\" font-family=\"VT323,monospace\" font-size=\"19\">Yes</text><rect x=\"84\" y=\"62\" width=\"110\" height=\"24\" fill=\"#c0c0c0\" stroke=\"#000\"/><text x=\"139\" y=\"80\" text-anchor=\"middle\" font-family=\"VT323,monospace\" font-size=\"19\">Don’t show</text></g><g transform=\"translate(570 236)\" fill=\"none\" stroke=\"#9a9a9a\" stroke-width=\"7\" stroke-linecap=\"round\"><path d=\"M14 0 C 0 0 0 20 0 30 V80 C0 100 30 100 30 80 V20 C30 8 18 8 18 20 V70\"/><circle cx=\"6\" cy=\"34\" r=\"7\" fill=\"#fff\" stroke=\"#000\" stroke-width=\"2\"/><circle cx=\"26\" cy=\"34\" r=\"7\" fill=\"#fff\" stroke=\"#000\" stroke-width=\"2\"/><circle cx=\"8\" cy=\"35\" r=\"2.5\" fill=\"#000\" stroke=\"none\"/><circle cx=\"28\" cy=\"35\" r=\"2.5\" fill=\"#000\" stroke=\"none\"/></g>",
"kawaii": "<g transform=\"translate(52 388) rotate(-14)\"><circle r=\"26\" fill=\"#fff\"/><circle r=\"22\" fill=\"#ffd1e8\"/><path d=\"M-9 -2 q3 -5 6 0 M3 -2 q3 -5 6 0\" stroke=\"#4a1238\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M-5 7 q5 5 10 0\" stroke=\"#4a1238\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"-13\" cy=\"5\" r=\"4\" fill=\"#ff8cc6\"/><circle cx=\"13\" cy=\"5\" r=\"4\" fill=\"#ff8cc6\"/></g><g transform=\"translate(842 690) rotate(12)\"><path d=\"M0 -26 L7 -8 L26 -8 L11 4 L17 23 L0 12 L-17 23 L-11 4 L-26 -8 L-7 -8Z\" fill=\"#ffe28a\" stroke=\"#fff\" stroke-width=\"5\" paint-order=\"stroke\"/></g><g transform=\"translate(470 1180) rotate(8)\"><circle r=\"26\" fill=\"#fff\"/><circle r=\"22\" fill=\"#ffd1e8\"/><path d=\"M-9 -2 q3 -5 6 0 M3 -2 q3 -5 6 0\" stroke=\"#4a1238\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M-5 7 q5 5 10 0\" stroke=\"#4a1238\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"-13\" cy=\"5\" r=\"4\" fill=\"#ff8cc6\"/><circle cx=\"13\" cy=\"5\" r=\"4\" fill=\"#ff8cc6\"/></g><g transform=\"translate(690 388) rotate(0)\"><path d=\"M0 0 C-20 -24 -46 -14 -40 6 C-34 22 -14 12 0 0 C14 12 34 22 40 6 C46 -14 20 -24 0 0Z\" fill=\"#ff5ab0\" stroke=\"#fff\" stroke-width=\"4\"/><circle r=\"9\" fill=\"#d6156f\" stroke=\"#fff\" stroke-width=\"3\"/></g><g transform=\"translate(856 1190) rotate(16)\"><path d=\"M0 -26 L7 -8 L26 -8 L11 4 L17 23 L0 12 L-17 23 L-11 4 L-26 -8 L-7 -8Z\" fill=\"#ffe28a\" stroke=\"#fff\" stroke-width=\"5\" paint-order=\"stroke\"/></g><g transform=\"translate(56 1180) rotate(-10)\"><path d=\"M0 0 C-20 -24 -46 -14 -40 6 C-34 22 -14 12 0 0 C14 12 34 22 40 6 C46 -14 20 -24 0 0Z\" fill=\"#ff5ab0\" stroke=\"#fff\" stroke-width=\"4\"/><circle r=\"9\" fill=\"#d6156f\" stroke=\"#fff\" stroke-width=\"3\"/></g><g transform=\"translate(60 150) rotate(-6)\"><rect width=\"200\" height=\"40\" rx=\"20\" fill=\"#fff\" stroke=\"#ff8cc6\" stroke-width=\"3\"/><text x=\"100\" y=\"27\" text-anchor=\"middle\" font-family=\"Fredoka,sans-serif\" font-size=\"20\" fill=\"#d6156f\">✧ you did it!! ✧</text></g>",
"shonen": "<g transform=\"translate(548 352) rotate(-6)\"><text font-family=\"Bebas Neue,sans-serif\" font-size=\"40\" fill=\"#ffd400\" stroke=\"#000\" stroke-width=\"6\" paint-order=\"stroke\">POWER LEVEL {{PCT}}%!!</text></g><g transform=\"translate(46 150) rotate(-4)\"><rect width=\"196\" height=\"46\" fill=\"#ff2d3d\" stroke=\"#000\" stroke-width=\"4\"/><text x=\"98\" y=\"35\" text-anchor=\"middle\" font-family=\"Bebas Neue,sans-serif\" font-size=\"36\" fill=\"#fff\">CHAPTER 1</text></g><g transform=\"translate(640 1478)\"><path d=\"M0 0 H178 L206 22 L178 44 H0Z\" fill=\"#f5e6c8\" stroke=\"#3a2a12\" stroke-width=\"3\"/><text x=\"10\" y=\"30\" font-family=\"Bebas Neue,sans-serif\" font-size=\"25\" fill=\"#3a2a12\">TO BE CONTINUED</text></g>",
"doge": "<text x=\"52\" y=\"1184\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#e0218a\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(-8 52 1184)\">many ideal</text><text x=\"250\" y=\"1186\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#2b8a3e\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(-3 250 1186)\">such axes</text><text x=\"560\" y=\"682\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#1c7ed6\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(-4 560 682)\">so closest</text><text x=\"700\" y=\"928\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#2b8a3e\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(5 700 928)\">much nation</text><text x=\"540\" y=\"1182\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#7a3fd6\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(3 540 1182)\">very ideology</text><text x=\"700\" y=\"1484\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#c2410c\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(-6 700 1484)\">excite</text><text x=\"60\" y=\"1484\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"28\" fill=\"#1c7ed6\" stroke=\"#fff\" stroke-width=\"6\" paint-order=\"stroke\" transform=\"rotate(4 60 1484)\">so faith</text><g transform=\"translate(46 150)\"><rect width=\"230\" height=\"38\" rx=\"19\" fill=\"#fff\" opacity=\".88\"/><text x=\"115\" y=\"26\" text-anchor=\"middle\" font-family=\"Comic Neue,Comic Sans MS,sans-serif\" font-weight=\"700\" font-size=\"21\" fill=\"#a8320a\">1 MAJLIS = 1 MAJLIS</text></g>",
"midnight": "<g transform=\"translate(0 -48)\" stroke=\"#9ad3ff\" stroke-opacity=\".7\" stroke-width=\"1.6\" fill=\"#fff\"><path d=\"M60 300 L95 240 L130 285 L165 230 L200 300\" fill=\"none\"/><circle cx=\"60\" cy=\"300\" r=\"4\"/><circle cx=\"95\" cy=\"240\" r=\"4\"/><circle cx=\"130\" cy=\"285\" r=\"4\"/><circle cx=\"165\" cy=\"230\" r=\"4\"/><circle cx=\"200\" cy=\"300\" r=\"4\"/><text x=\"88\" y=\"330\" font-family=\"Lora,serif\" font-size=\"14\" fill=\"#9ad3ff\" stroke=\"none\" letter-spacing=\"3\">MAJLIS MAJOR</text></g><g transform=\"translate(560 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"22\" r=\"11\" fill=\"#0b1730\"/></g><g transform=\"translate(596 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"14\" r=\"11\" fill=\"#0b1730\"/></g><g transform=\"translate(632 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"7\" r=\"11\" fill=\"#0b1730\"/></g><circle cx=\"668\" cy=\"140\" r=\"11\" fill=\"#eaf4ff\"/><g transform=\"translate(704 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"-7\" r=\"11\" fill=\"#0b1730\"/></g><g transform=\"translate(740 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"-14\" r=\"11\" fill=\"#0b1730\"/></g><g transform=\"translate(776 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"-22\" r=\"11\" fill=\"#0b1730\"/></g><g transform=\"translate(812 140)\"><circle r=\"11\" fill=\"#eaf4ff\"/><circle cx=\"30\" r=\"11\" fill=\"#0b1730\"/></g><text x=\"560\" y=\"176\" font-family=\"Lora,serif\" font-size=\"14\" fill=\"#9ad3ff\" letter-spacing=\"3\">TONIGHT'S ALIGNMENT</text><path d=\"M40 1190 L180 1120\" stroke=\"url(#sh2)\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M640 600 L780 540\" stroke=\"url(#sh2)\" stroke-width=\"2\" stroke-linecap=\"round\"/><defs><linearGradient id=\"sh2\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#fff\"/></linearGradient></defs>",
"lofi": "<g transform=\"translate(46 110)\"><rect width=\"370\" height=\"58\" rx=\"12\" fill=\"#120e22\" opacity=\".75\" stroke=\"#ffc896\" stroke-opacity=\".5\"/><path d=\"M18 18 L18 40 L36 29Z\" fill=\"#ffa65c\"/><text x=\"50\" y=\"25\" font-family=\"Lora,serif\" font-style=\"italic\" font-size=\"16\" fill=\"#ffd2a8\">lofi beats to find where you stand to</text><rect x=\"50\" y=\"36\" width=\"250\" height=\"5\" rx=\"2.5\" fill=\"#4a2f4f\"/><rect x=\"50\" y=\"36\" width=\"150\" height=\"5\" rx=\"2.5\" fill=\"#ffa65c\"/><circle cx=\"200\" cy=\"38.5\" r=\"6\" fill=\"#ffd2a8\"/><text x=\"310\" y=\"43\" font-family=\"Lora,serif\" font-size=\"13\" fill=\"#ffd2a8\">1:24</text></g><g transform=\"translate(790 300)\"><circle r=\"62\" fill=\"#0c0918\"/><circle r=\"26\" fill=\"none\" stroke=\"#2a2146\" stroke-width=\"1.5\"/><circle r=\"32\" fill=\"none\" stroke=\"#2a2146\" stroke-width=\"1.5\"/><circle r=\"38\" fill=\"none\" stroke=\"#2a2146\" stroke-width=\"1.5\"/><circle r=\"44\" fill=\"none\" stroke=\"#2a2146\" stroke-width=\"1.5\"/><circle r=\"50\" fill=\"none\" stroke=\"#2a2146\" stroke-width=\"1.5\"/><circle r=\"56\" fill=\"none\" stroke=\"#2a2146\" stroke-width=\"1.5\"/><circle r=\"20\" fill=\"#ffa65c\"/><circle r=\"3\" fill=\"#0c0918\"/></g><g transform=\"translate(150 1420)\"><path d=\"M0 0 H44 V40 C44 56 0 56 0 40Z\" fill=\"#0c0918\"/><path d=\"M44 10 C62 10 62 30 44 30\" stroke=\"#0c0918\" stroke-width=\"6\" fill=\"none\"/><path d=\"M12 -6 C4 -20 20 -26 12 -40 M28 -6 C20 -20 36 -26 28 -40\" stroke=\"#ffd2a8\" stroke-opacity=\".6\" stroke-width=\"3\" fill=\"none\"/></g>"
};
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Panels on the sketch: axes, leader, nation, ideology, then the bottom row (with or without the faith panel).
function panelBoxes(hasFaith){
  const p = [[40,372,446,790],[511,374,353,302],[511,686,353,236],[511,932,353,230]];
  return hasFaith ? p.concat([[40,1192,630,274],[690,1192,174,274]]) : p.concat([[197,1192,470,274]]);
}
function brackets(col, L, w, inset, hasFaith){
  return panelBoxes(hasFaith).map(([x, y, wd, h]) => {
    const x0 = x + inset, y0 = y + inset, x1 = x + wd - inset, y1 = y + h - inset;
    return '<path d="M' + x0 + ' ' + (y0 + L) + 'V' + y0 + 'H' + (x0 + L) + ' M' + (x1 - L) + ' ' + y0 + 'H' + x1 + 'V' + (y0 + L) +
      ' M' + x1 + ' ' + (y1 - L) + 'V' + y1 + 'H' + (x1 - L) + ' M' + (x0 + L) + ' ' + y1 + 'H' + x0 + 'V' + (y1 - L) + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"/>';
  }).join('');
}
// ctx: { ideology: closest ideology name, pct: its match, hasFaith }
window.cardFlavorSVG = (theme, ctx) => {
  let body = OVERLAYS[theme];
  if(body == null) return null;
  let ideo = ctx.ideology || 'Free Thinker';
  ideo = ideo.replace(/\b\w/g, c => c.toUpperCase());
  const long = ideo.length > 24;
  body = body.replace('>{{IDEO}}!</text>', (long ? ' textLength="214" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(ideo) + '!</text>')
             .replace('{{PCT}}', esc(ctx.pct == null ? '??' : ctx.pct));
  if(theme === 'dark') body = brackets('#00ff66', 22, 4, -6, ctx.hasFaith) + body;
  if(theme === 'esports') body = brackets('#00ff66', 26, 5, -8, ctx.hasFaith) + body;
  return '<svg class="rc9__flav" viewBox="0 0 864 1536" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
};

/* ---------- the leader cut out of his photo (for the pop-out) ----------
   Uses MediaPipe's small person-segmentation model in the browser, loaded only when a result card is shown. */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
let segmenterP = null;
function segmenter(){
  if(!segmenterP) segmenterP = import(MP + '/vision_bundle.mjs')
    .then(V => V.FilesetResolver.forVisionTasks(MP + '/wasm').then(fs => V.ImageSegmenter.createFromOptions(fs, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false })))
    .catch(e => { console.warn('person cut-out unavailable', e); segmenterP = null; return null; });
  return segmenterP;
}
// The model takes a lot of memory; let it go a little after the last cut-out (it loads again if needed), so the
// browser has less reason to throw this tab away while it sits in the background.
let releaseTimer = null;
function releaseSoon(){
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    const p = segmenterP; segmenterP = null;
    if(p) p.then(seg => { try { seg && seg.close(); } catch(e){} });
  }, 20000);
}
function loadImg(url){
  return new Promise((done, fail) => {
    const img = new Image();
    if(!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => done(img); img.onerror = () => fail(new Error('image did not load'));
    img.src = url;
  });
}
const cutCache = new Map(), cutDone = new Map();
// Resolves to { url, w, h, head: { top, cx, w } (fractions of the picture), topCut } or null.
window.cardCutout = (url) => {
  if(!url) return Promise.resolve(null);
  if(!cutCache.has(url)) cutCache.set(url, (async () => {
    const seg = await segmenter();
    if(!seg) return null;
    const img = await loadImg(url);
    const W = img.naturalWidth, H = img.naturalHeight;
    if(!W || !H) return null;
    const res = seg.segment(img);
    const m = res.confidenceMasks && res.confidenceMasks[0];
    if(!m) return null;
    const mw = m.width, mh = m.height, a = m.getAsFloat32Array().slice();
    res.close && res.close();
    // How wide the person is on each row, to find the top of the head and how wide the head is.
    const rows = [];
    for(let y = 0; y < mh; y++){
      let l = -1, r = -1;
      for(let x = 0; x < mw; x++){ if(a[y * mw + x] > 0.5){ if(l < 0) l = x; r = x; } }
      rows.push(l < 0 ? null : [l, r]);
    }
    const top = rows.findIndex(r => r && r[1] - r[0] > mw * 0.02);
    if(top < 0) return null;
    // The head ends at the neck: the narrowest row below the head's widest point, before the shoulders widen out.
    // (Measuring until the rows suddenly get much wider failed on painted portraits whose coats widen gradually:
    // the whole upper body was taken for the head, and the head then sat far too high in its circle.)
    // The mask is square whatever the picture's shape, so a mask row is k mask columns tall in real pixels.
    const k = (H / mh) / (W / mw);
    const span = Math.min(mh - top, Math.round(mh * 0.75));
    const raw = [];
    for(let i = 0; i < span; i++){ const r = rows[top + i]; raw.push(r ? r[1] - r[0] : 0); }
    const sm = raw.map((_, i) => { let s = 0, c = 0; for(let j = i - 2; j <= i + 2; j++) if(j >= 0 && j < raw.length){ s += raw[j]; c++; } return s / c; });
    let widest = 0, neck = -1, low = -1;
    for(let i = 1; i < sm.length; i++){
      if(low < 0){
        if(sm[i] > sm[widest]) widest = i;
        // narrowing well below the widest point, once the head is tall enough to be a head
        else if(i > 6 && i * k > sm[widest] * 0.7 && sm[i] < sm[widest] * 0.88) low = i;
      } else {
        if(sm[i] < sm[low]) low = i;
        else if(sm[i] > sm[low] * 1.25){ neck = low; break; }   // the shoulders start
      }
    }
    // No clear neck (a hood, long hair, a high collar): take the top part of the figure, at most half the picture wide.
    const end = neck > 0 ? neck : Math.max(8, Math.round(mh * 0.16));
    let headW = 0, cxSum = 0, n = 0;
    for(let i = 0; i < Math.min(end, raw.length); i++){
      const r = rows[top + i]; if(!r) continue;
      if(i > 8 && i * k >= headW * 1.45) break;   // a head is never much taller than it is wide: below this is the body
      headW = Math.max(headW, r[1] - r[0]); cxSum += (r[0] + r[1]) / 2; n++;
    }
    if(neck < 0) headW = Math.min(headW, mw * 0.5);
    if(!n || headW < mw * 0.05) return null;
    // The cut-out: the photo with everything but the person made transparent.
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H), px = d.data;
    for(let yy = 0; yy < H; yy++){
      const my = Math.min(mh - 1, (yy * mh / H) | 0) * mw;
      for(let xx = 0; xx < W; xx++){
        const v = a[my + Math.min(mw - 1, (xx * mw / W) | 0)];
        px[(yy * W + xx) * 4 + 3] = v <= 0.35 ? 0 : v >= 0.65 ? 255 : ((v - 0.35) / 0.3 * 255) | 0;
      }
    }
    x.putImageData(d, 0, 0);
    const blob = await new Promise(done => c.toBlob(done, 'image/png'));
    if(!blob) return null;
    return { url: URL.createObjectURL(blob), w: W, h: H,
      head: { top: top / mh, cx: cxSum / n / mw, w: headW / mw }, topCut: top < mh * 0.015 };
  })().catch(e => { console.warn('cut-out failed', e); return null; }).then(v => { cutDone.set(url, v); releaseSoon(); return v; }));
  return cutCache.get(url);
};
// The finished cut-out for a picture: the result, null when there is none, undefined while it is still being made.
window.cardCutoutNow = (url) => cutDone.get(url);

/* Where to place a cut-out so the head sits at the top centre of a box `bw` wide, its top `headTop` boxes-widths
   from the box's top, with the head `headW` box-widths wide. Returns left/top/width/height in box-widths. */
window.cardPlace = (cut, headW, headTop) => {
  const scale = headW / cut.head.w;              // picture width, in box widths
  const ph = scale * cut.h / cut.w;              // picture height, in box widths
  return { left: 0.5 - cut.head.cx * scale, top: headTop - cut.head.top * ph, width: scale, height: ph };
};
})();
