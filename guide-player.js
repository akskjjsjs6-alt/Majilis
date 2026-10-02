/* =====================================================================
   Majlis — Update 29: the 30-day guide as narrated cartoon animations.
   Each lesson in guide-videos-*.js is a list of "beats". The player animates one scene per beat,
   in time with the narrator: things appear as they're said, the host talks (lip-sync), moves and
   gestures, thinkers and debaters appear as Majlis characters, the camera drifts, and scenes
   whip from one to the next. The voice is the browser's own (Web Speech), so there are no video
   files to download. With no voice on the device, or sound off, it runs on timed captions.
   ===================================================================== */
(function(){
  'use strict';

  const LS = { get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : v; } catch(e){ return d; } },
               set(k, v){ try { localStorage.setItem(k, v); } catch(e){} } };

  /* ---------- big stroke icons ---------- */
  const IC = {
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/><path d="M12 9h-2M12 14h2"/>',
    scale: '<path d="M12 3v18M7 21h10M4 7h16"/><path d="M6 7l-3 6a3 3 0 0 0 6 0L6 7zM18 7l-3 6a3 3 0 0 0 6 0l-3-6z"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z"/><path d="M5 19h14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/><path d="M9 7h6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
    chain: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 7-3.7"/>',
    school: '<path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    coin: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    flame: '<path d="M12 3c1 3.5 4.5 5.2 4.5 9.5A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.5c0-2 1-3.3 2-4.3.2 1.5 1 2.4 2 2.8C11.2 8.5 11 5.6 12 3z"/><path d="M8 20h8"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3z"/>',
    dove: '<path d="M3 14c3 0 5-1 7-4l3-5c1 2 1 4 0 6 3-1 5-1 8 1-3 1-5 3-6 6-2 3-6 3-9 1l-3 2v-3c-1 0-1-2 0-4z"/><circle cx="15.5" cy="9.5" r=".6"/>',
    sword: '<path d="M14.5 3H21v6.5L10 20.5 3.5 14 14.5 3z"/><path d="M6 12l6 6M4 20l3-3"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    mosque: '<path d="M4 21V12h16v9M3 21h18"/><path d="M7 12a5 5 0 0 1 10 0"/><path d="M12 4v3M10 21v-4a2 2 0 0 1 4 0v4"/>',
    church: '<path d="M12 2v4M10 4h4"/><path d="M6 21V11l6-5 6 5v10M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
    synagogue: '<path d="M4 21V9l8-5 8 5v12M3 21h18"/><path d="M12 9.5l2 3.5h-4l2-3.5zM12 15.5l-2-3.5h4l-2 3.5z"/>',
    lotus: '<path d="M12 20c-4 0-8-2-9-6 3 0 6 1 9 4 3-3 6-4 9-4-1 4-5 6-9 6z"/><path d="M12 18c-2-2-3-5-3-8 1 1 2 2 3 4 1-2 2-3 3-4 0 3-1 6-3 8zM12 14V5"/>',
    scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M9 9h4M9 13h4"/>',
    ballot: '<rect x="4" y="11" width="16" height="10" rx="1.5"/><path d="M8 11V4h8v7M10 7l1.5 1.5L14 6M9 15h6"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mask: '<path d="M3 6c3-1 6-1 9 0 3-1 6-1 9 0v4c0 5-4 9-9 9s-9-4-9-9V6z"/><path d="M7 10.5c1-.7 2-.7 3 0M14 10.5c1-.7 2-.7 3 0M9 15c2 1.5 4 1.5 6 0"/>',
    mirror: '<ellipse cx="12" cy="9.5" rx="6" ry="7"/><path d="M12 16.5V21M9 21h6M10 6.5c-1 .7-1.5 1.7-1.5 3"/>',
    play: '<path d="M7 4.5v15l12-7.5L7 4.5z" fill="currentColor"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/>',
    prev: '<path d="M18 5L8 12l10 7V5zM6 5v14"/>',
    next: '<path d="M6 5l10 7-10 7V5zM18 5v14"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l4.5 5M21.5 9.5l-4.5 5"/>',
    cc: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.2a2.3 2.3 0 1 0 0 3.6M17 10.2a2.3 2.3 0 1 0 0 3.6"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  };
  // pathLength=1 on every shape lets the scene "draw" the icon on with a stroke animation
  const svgIcon = (name, size, sw, draw) => {
    let inner = IC[name] || IC.bulb;
    if(draw) inner = inner.replace(/<(path|circle|ellipse|rect)\b/g, '<$1 pathLength="1"');
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- narration helpers ---------- */
  const splitSentences = s => String(s || '').split(/(?<=(?<!\b[A-Z])[.?!])\s+(?=[A-Z0-9"'‘“])/).map(x => x.trim()).filter(Boolean);
  const wordList = s => String(s || '').trim().split(/\s+/).filter(Boolean);
  const words = s => wordList(s).length;
  const WPS = 2.55;                         // a calm narrator's words per second at speed 1
  const beatSeconds = b => Math.max(3.2, words(b.say || b.text) / WPS + 0.7);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* ---------- characters ---------- */
  // Prophets, angels and the Prophet's family and companions are never drawn — they get a lettered medallion instead.
  const NO_FACE = /\b(muhammad|mohammed|prophet|moses|musa|jesus|isa|christ|abraham|ibrahim|noah|nuh|solomon|sulayman|david|dawud|job|ayyub|joseph|yusuf|jacob|yaqub|isaac|ishaq|ishmael|ismail|elijah|ilyas|jonah|yunus|mary|maryam|gabriel|jibril|angel|allah|god|buddha|siddhartha|krishna|ali ibn|imam ali|husayn|hussain|hasan ibn|fatima|fatimah|khadija|aisha|abu bakr|umar ibn|uthman|companions?)\b/i;
  const isPersonName = n => /^[A-ZÀ-ÝÅØa-z]/.test(n) && !/^(option|critics?|defenders?|many|the |state$|nation$|duty$|character$|realist$|liberal$|insider$|outsider$|straw|steel|logical|evidential|deduction|induction|dualism|physicalism|negative|positive|civic|ethnic|rule by|democracy|religious|secularism|lending|handing|free speech|limits|atheist|sceptical)/i.test(n);
  const canDraw = n => !!window.MajlisCharacters && !NO_FACE.test(String(n));
  const charCache = {};
  function charSvg(seed, pose, expression, flip){
    const key = seed + '|' + pose + '|' + expression + '|' + (flip ? 1 : 0);
    if(key in charCache) return charCache[key];
    let s = '';
    try {
      if(window.MajlisCharacters){
        const M = window.MajlisCharacters;
        const spec = seed.startsWith('preset:') ? Object.assign({}, M.get(seed.slice(7)), { pose, expression, prop: null })
                                                : M.random(seed, { pose, expression, prop: null, extras: [] });
        if(seed.startsWith('thinker:')) Object.assign(spec, thinkerLook(seed.slice(8)));
        if(spec.topColor === 'neon') spec.topColor = 'cream';     // don't melt into the neon background
        s = window.MajlisCharacters.svg(spec, { sticker: true, size: 300, flip: !!flip, title: ' ' });
      }
    } catch(e){ s = ''; }
    return (charCache[key] = s);
  }
  // a period-ish look for a named thinker: robes for the ancients, beards before 1700, jackets after
  const WOMEN = /\b(elisabeth|elizabeth|philippa|eleanor|simone|hannah|mary wollstonecraft|rabia|rabi'a|hypatia|iris|martha|judith)\b/i;
  const THINKER_DATES = {};
  function thinkerLook(name){
    let h = 0; for(const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pick = a => a[(h = (h * 1103515245 + 12345) >>> 0) % a.length];
    const d = THINKER_DATES[name] || '';
    const m = d.match(/(\d{2,4})/); const bc = /BC/i.test(d);
    const year = m ? (bc ? -Number(m[1]) : Number(m[1])) : 1900;
    const islamic = /^(al-|ibn |abu )/i.test(name);
    const woman = WOMEN.test(name);
    const look = { prop: null, headwear: null, bodywear: [] };
    if(year < 1500){ look.top = islamic ? 'thobe' : 'robe'; look.topColor = pick(['sand', 'khaki', 'maroon', 'navy', 'teal', 'mustard']); }
    else if(year < 1900){ look.top = pick(['jacket', 'blazer']); look.topColor = pick(['charcoal', 'navy', 'maroon', 'slate', 'deep']); }
    else { look.top = pick(['blazer', 'sweater', 'jacket']); look.topColor = pick(['charcoal', 'navy', 'teal', 'slate', 'khaki', 'maroon']); }
    if(woman){ look.hair = pick(['bun', 'long', 'wavy', 'bob']); look.facewear = []; }
    else {
      look.hair = pick(year < 1700 ? ['short', 'curly', 'bald', 'wavy'] : ['short', 'sidepart', 'curly', 'bald', 'wavy']);
      look.facewear = year < 1700 || pick([0, 0, 1]) ? ['beard'] : [];
      if(islamic && year < 1500){ look.headwear = 'kufi'; }
    }
    if(year < 1800 && look.hairColor === undefined) look.hairColor = pick(['black', 'darkbrown', 'brown', 'grey', 'white']);
    return look;
  }
  function monogram(name){
    const parts = String(name).replace(/^(al|ibn|el|de|von|van)[-\s]/i, '').split(/[\s-]+/).filter(p => /^[A-ZÀ-ÝÅØ]/.test(p));
    return ((parts[0] || name || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  // a talking figure: two stacked frames (mouth open / closed) that the player flips while speaking
  function figure(seed, pose, expr, cls, flip){
    const a = charSvg(seed, pose, expr, flip), b = charSvg(seed, pose, 'talking', flip);
    if(!a) return `<div class="gv-fig gv-fig--mono ${cls || ''}"><div class="gv-medal"><span>${esc(monogram(seed))}</span></div></div>`;
    return `<div class="gv-fig ${cls || ''}"><div class="gv-fig__a">${a}</div><div class="gv-fig__b">${b}</div></div>`;
  }
  const personOrMono = (name, pose, expr, cls, flip) => canDraw(name)
    ? figure('thinker:' + name, pose, expr, cls, flip)
    : `<div class="gv-fig gv-fig--mono ${cls || ''}"><div class="gv-medal"><span>${esc(monogram(name))}</span></div></div>`;

  // the host's two poses for each kind of scene (first half, second half) and expression
  const HOST = { title: ['wave', 'explain', 'happy'], question: ['thinking', 'shrug', 'thinking'], idea: ['explain', 'point', 'talking'],
    example: ['point', 'explain', 'grinning'], list: ['present', 'explain', 'focused'], quote: ['hand-on-heart', 'listen', 'content'],
    thinker: ['present', 'listen', 'amazed'], versus: ['shrug', 'shrug', 'skeptical'], timeline: ['point', 'present', 'focused'],
    scale: ['shrug', 'thinking', 'thinking'], recap: ['thumbs-up', 'explain', 'proud'], debate: ['fist-pump', 'cheer', 'determined'] };

  /* ---------- scenes ----------
     Elements with data-at="x" appear when the narration is x of the way through the beat. */
  // when does the narrator say this phrase? (fraction of the beat's words), so lists tick in as they're read out
  const norm = w => w.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, '');
  function atFor(T, phrase, from){
    const P = wordList(phrase).map(norm).filter(w => w.length > 2 && !/^(the|and|for|you|are|but|not|with|that|this|your|its)$/.test(w));
    if(!P.length) return -1;
    const need = Math.min(2, P.length);
    for(let k = from; k < T.length; k++){
      if(!P.includes(T[k])) continue;
      const win = T.slice(k, k + P.length + 3);
      if(P.filter(w => win.includes(w)).length >= need) return k;
    }
    return -1;
  }
  function syncAts(b, items, a, z){
    const T = wordList(b.text).map(norm), fb = spread(items.length, a, z);
    let from = 0, last = -1;
    return items.map((it, k) => {
      const at = atFor(T, it, from);
      let v = at >= 0 ? Math.max(0, (at - .5) / T.length) : fb[k];
      if(at >= 0) from = at + 1;
      v = Math.min(.9, Math.max(v, last + .02)); last = v; return v;
    });
  }
  function spread(n, a, b){ return Array.from({ length: n }, (_, k) => n === 1 ? a : a + (b - a) * k / (n - 1)); }
  function kinetic(text, at, cls){   // words fly in one after another
    return `<div class="gv-s gv-words ${cls || ''}" data-at="${at}">${wordList(text).map((w, k) => `<span style="--i:${k}">${esc(w)}</span>`).join(' ')}</div>`;
  }
  function typed(text, a, b, cls){   // words appear in step with the voice
    const ws = wordList(text), ats = spread(ws.length, a, b);
    return `<div class="gv-typed ${cls || ''}">${ws.map((w, k) => `<span class="gv-s gv-w" data-at="${ats[k].toFixed(3)}">${esc(w)}</span>`).join(' ')}</div>`;
  }
  function scene(b, lesson){
    const S = (at, fx, cls, html) => `<div class="gv-s ${cls || ''}" data-at="${at}" data-fx="${fx}">${html}</div>`;
    switch(b.type){
      case 'title': return `<div class="gv-scene gv-title">
          ${S(0, 'left', 'gv-kicker', `${esc(lesson.track)} · Day ${lesson.day} of 30`)}
          ${S(0, 'zoom', 'gv-daynum', String(lesson.day).padStart(2, '0'))}
          ${kinetic(b.heading, .08, 'gv-h1')}
          ${S(.2, 'sweep', 'gv-underline', '')}</div>`;
      case 'question': return `<div class="gv-scene gv-question">
          <div class="gv-qmark">?</div>${typed(b.big, .02, .35, 'gv-big')}
          ${S(.5, 'pop', 'gv-thinkdots', '<i></i><i></i><i></i>')}</div>`;
      case 'idea': case 'example': return `<div class="gv-scene gv-idea ${b.type === 'example' ? 'is-example' : ''}">
          ${S(0, 'left', 'gv-badge', b.type === 'example' ? 'For example' : 'Big idea')}
          ${S(.02, 'pop', 'gv-iconbub', `<div class="gv-ring"></div>${svgIcon(b.icon, 64, 1.6, true)}`)}
          ${kinetic(b.headline, .1, 'gv-h2')}
          ${S(.42, 'up', 'gv-sub', esc(b.sub))}
          <div class="gv-orbit">${[0, 1, 2].map(k => `<span style="--k:${k}">${svgIcon(b.icon, 22, 2)}</span>`).join('')}</div></div>`;
      case 'thinker': THINKER_DATES[b.name] = b.dates; return `<div class="gv-scene gv-thinker">
          ${S(0, 'enter-left', 'gv-thinker__fig', personOrMono(b.name, 'explain', 'talking', 'is-guest'))}
          <div class="gv-thinker__txt">${S(.04, 'left', 'gv-plate', `<b>${esc(b.name)}</b><span>${esc(b.dates)}</span>`)}
          ${S(.28, 'pop', 'gv-bubble', esc(b.line))}</div></div>`;
      case 'versus': {
        const fig = (side, flip) => isPersonName(side.name) && canDraw(side.name) ? figure('thinker:' + side.name, 'argue', 'determined', '', flip)
          : canDraw('x') ? figure('side:' + side.name, 'argue', 'determined', '', flip) : `<div class="gv-fig gv-fig--mono"><div class="gv-medal"><span>${esc(monogram(side.name))}</span></div></div>`;
        return `<div class="gv-scene gv-versus">
          <div class="gv-vs-col is-left">${S(0, 'enter-left', 'gv-vs-fig', fig(b.left, false))}${S(.02, 'up', 'gv-vs-name', esc(b.left.name))}${S(.18, 'pop', 'gv-vs-bubble', esc(b.left.line))}</div>
          ${S(.06, 'slam', 'gv-vs', 'VS')}
          <div class="gv-vs-col is-right">${S(.08, 'enter-right', 'gv-vs-fig', fig(b.right, true))}${S(.1, 'up', 'gv-vs-name', esc(b.right.name))}${S(.55, 'pop', 'gv-vs-bubble', esc(b.right.line))}</div></div>`;
      }
      case 'list': { const ats = syncAts(b, b.items, .14, .8);
        return `<div class="gv-scene gv-list">${kinetic(b.headline, 0, 'gv-h2')}
          <ol>${b.items.map((it, k) => `<li class="gv-s" data-at="${ats[k].toFixed(3)}" data-fx="left"><span>${k + 1}</span>${esc(it)}</li>`).join('')}</ol></div>`; }
      case 'quote': return `<div class="gv-scene gv-quote">${S(0, 'zoom', 'gv-qq', '“')}${typed(b.quote, .03, .6, 'gv-quote__q')}${S(.68, 'up', 'gv-quote__by', '— ' + esc(b.by))}</div>`;
      case 'timeline': { const ats = syncAts(b, b.events.map(e => e.year + ' ' + e.label), .1, .8);
        return `<div class="gv-scene gv-timeline"><div class="gv-tl-line"><div class="gv-tl-line__fill"></div></div>
          <div class="gv-tl">${b.events.map((ev, k) => `<div class="gv-s gv-tl__ev" data-at="${ats[k].toFixed(3)}" data-fx="drop"><div class="gv-tl__dot"></div><div class="gv-tl__year">${esc(ev.year)}</div><div class="gv-tl__lbl">${esc(ev.label)}</div></div>`).join('')}</div></div>`; }
      case 'scale': return `<div class="gv-scene gv-scalebeat" style="--tilt:${(Number(b.tilt) || 0) * -10}deg">${kinetic(b.headline, 0, 'gv-h2')}
          <div class="gv-beam-wrap"><div class="gv-beam">
            ${S(.12, 'drop', 'gv-pan is-left', esc(b.left))}${S(.3, 'drop', 'gv-pan is-right', esc(b.right))}</div><div class="gv-post"></div></div></div>`;
      case 'recap': { const ats = syncAts(b, b.items, .12, .82);
        return `<div class="gv-scene gv-recap">${S(0, 'left', 'gv-badge', 'Recap')}
          <ul>${b.items.map((it, k) => `<li class="gv-s" data-at="${ats[k].toFixed(3)}" data-fx="left"><span class="gv-tick">✓</span>${esc(it)}</li>`).join('')}</ul></div>`; }
      case 'debate': return `<div class="gv-scene gv-debate">${S(0, 'pop', 'gv-badge is-solid', 'Now argue it')}
          ${kinetic(b.motion, .05, 'gv-big is-motion')}
          ${S(.45, 'up', 'gv-cta-row', `<button type="button" class="gv-cta" data-act="debate">Debate this ${svgIcon('arrow', 16, 2.2)}</button><button type="button" class="gv-cta is-ghost" data-act="quiz">Take the quiz</button>`)}
          <div class="gv-confetti">${Array.from({ length: 18 }, (_, k) => `<i style="--k:${k}"></i>`).join('')}</div></div>`;
      default: return `<div class="gv-scene">${S(0, 'up', 'gv-sub', esc(b.text))}</div>`;
    }
  }

  /* ---------- voices ---------- */
  const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  function englishVoices(){
    if(!synth) return [];
    try { return synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang)); } catch(e){ return []; }
  }
  function voiceScore(v){
    const n = v.name.toLowerCase(); let s = 0;
    if(/natural|neural|online|premium|enhanced/.test(n)) s += 40;
    if(/google uk english male|google uk english female|google us english/.test(n)) s += 30;
    if(/daniel|samantha|serena|libby|ryan|sonia|aria|guy|jenny|arthur|martha|karen|moira|tessa/.test(n)) s += 20;
    if(/en-gb/i.test(v.lang)) s += 6;
    if(/en-us/i.test(v.lang)) s += 4;
    if(v.localService) s += 2;
    if(/compact|espeak|novelty|whisper|zarvox|bells|bad news|trinoids|albert|jester|organ|bubbles|boing|cellos|deranged|hysterical|wobble/.test(n)) s -= 60;
    return s;
  }
  function pickVoice(){
    const vs = englishVoices();
    if(!vs.length) return null;   // no English voice: the caller falls back to the device's default voice
    const want = LS.get('majlis-guide-voice', '');
    return vs.find(v => v.voiceURI === want) || vs.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
  }

  /* ---------- background particles ---------- */
  function particles(cv){
    const ctx = cv.getContext && cv.getContext('2d');
    const P = Array.from({ length: 34 }, (_, k) => ({ x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.8, s: .006 + Math.random() * .02, plus: k % 6 === 0, a: .15 + Math.random() * .35 }));
    let burst = [];
    return {
      burst(){ for(let k = 0; k < 26; k++){ const ang = Math.random() * Math.PI * 2, sp = .12 + Math.random() * .35; burst.push({ x: .5, y: .5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * .6, life: 1 }); } },
      draw(dt, cam){
        if(!ctx) return;
        const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        if(cv.width !== Math.round(w * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        P.forEach(p => {
          p.y -= p.s * dt; if(p.y < -.05){ p.y = 1.05; p.x = Math.random(); }
          const x = (p.x + cam * p.r * .01) * w, y = p.y * h;
          ctx.globalAlpha = p.a; ctx.fillStyle = ctx.strokeStyle = '#00FF66';
          if(p.plus){ ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill(); }
        });
        burst = burst.filter(b => (b.life -= dt * 1.6) > 0);
        burst.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; ctx.globalAlpha = b.life; ctx.fillStyle = '#00FF66'; ctx.beginPath(); ctx.arc(b.x * w, b.y * h, 2.2 * b.life + .5, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
      },
    };
  }

  /* ---------- the player ---------- */
  let current = null;   // only one lesson plays at a time

  function create(lesson, opts){
    opts = opts || {};
    const data = window.MAJLIS_GUIDE_VIDEOS && window.MAJLIS_GUIDE_VIDEOS[lesson.day];
    if(!data) return null;
    const beats = data.beats;
    const durs = beats.map(beatSeconds);
    const total = durs.reduce((a, b) => a + b, 0);
    const starts = durs.reduce((acc, d, k) => (acc.push(k ? acc[k - 1] + durs[k - 1] : 0), acc), []);
    const hostSeed = 'preset:' + ({ Philosophy: 'host-3', Politics: 'teacher', Theology: 'scholar' }[lesson.track] || 'host-3');

    const S = { i: 0, playing: false, ended: false, sent: 0, token: 0, timer: null, watchdog: null, sentStart: 0, sentEst: 1, talking: false,
      boundaryWord: -1, beatStart: 0, lastFrame: 0, flapAt: 0, mouth: false, p: 0,
      speed: Number(LS.get('majlis-guide-speed', '1')) || 1, muted: LS.get('majlis-guide-muted', '0') === '1',
      cc: LS.get('majlis-guide-cc', '1') !== '0', voice: null, started: false };

    const root = document.createElement('div');
    root.className = 'gv';
    root.dataset.day = lesson.day;
    root.innerHTML = `
      <div class="gv-stage" tabindex="0" aria-label="Day ${lesson.day} video lesson">
        <div class="gv-world">
          <div class="gv-bg"><div class="gv-grid"></div><div class="gv-glow"></div><div class="gv-blob is-a"></div><div class="gv-blob is-b"></div></div>
          <canvas class="gv-particles" aria-hidden="true"></canvas>
          <div class="gv-canvas"></div>
          <div class="gv-host" aria-hidden="true"><div class="gv-host__inner"></div><div class="gv-host__shadow"></div></div>
        </div>
        <div class="gv-wipe" aria-hidden="true"></div>
        <div class="gv-brand">MAJLIS <span>· Day ${lesson.day}</span></div>
        <div class="gv-count"></div>
        <div class="gv-caption" aria-live="polite"></div>
        <button type="button" class="gv-bigplay" aria-label="Play">
          <span class="gv-bigplay__btn">${svgIcon('play', 34)}</span>
          <span class="gv-bigplay__lbl">Watch · ${data.minutes} min</span>
        </button>
      </div>
      <div class="gv-bar">
        <button type="button" class="gv-btn" data-act="prev" aria-label="Previous scene">${svgIcon('prev', 18)}</button>
        <button type="button" class="gv-btn is-main" data-act="toggle" aria-label="Play">${svgIcon('play', 18)}</button>
        <button type="button" class="gv-btn" data-act="next" aria-label="Next scene">${svgIcon('next', 18)}</button>
        <div class="gv-track" role="slider" aria-label="Seek" tabindex="0" aria-valuemin="1" aria-valuemax="${beats.length}">
          <div class="gv-track__fill"></div>
          ${starts.map(s => `<i style="left:${(s / total * 100).toFixed(2)}%"></i>`).join('')}
        </div>
        <span class="gv-time">0:00 / ${fmt(total)}</span>
        <button type="button" class="gv-btn" data-act="mute" aria-label="Sound"></button>
        <button type="button" class="gv-btn" data-act="cc" aria-label="Captions">${svgIcon('cc', 18)}</button>
        <button type="button" class="gv-btn gv-speed" data-act="speed" aria-label="Speed"></button>
        <button type="button" class="gv-btn" data-act="full" aria-label="Full screen">${svgIcon('full', 18)}</button>
      </div>
      <div class="gv-settings">
        <label class="gv-voice-lbl">Voice <select class="gv-voice"></select></label>
        <span class="gv-note"></span>
      </div>`;
    const $ = s => root.querySelector(s);
    const stage = $('.gv-stage'), world = $('.gv-world'), canvas = $('.gv-canvas'), hostEl = $('.gv-host'), hostInner = $('.gv-host__inner'),
          cap = $('.gv-caption'), fill = $('.gv-track__fill'), timeEl = $('.gv-time'), countEl = $('.gv-count'), voiceSel = $('.gv-voice'), note = $('.gv-note'),
          wipe = $('.gv-wipe');
    const fx = particles($('.gv-particles'));

    function fmt(s){ s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    function fillVoices(){
      const vs = englishVoices();
      S.voice = pickVoice();
      voiceSel.innerHTML = '';
      if(!synth || !vs.length){
        voiceSel.disabled = true;
        voiceSel.appendChild(new Option('', ''));
        voiceSel.options[0].text = synth ? 'Device default voice' : 'No voice available';
        note.textContent = synth ? '' : 'This browser can\'t read aloud, so the video plays with captions.';
        return;
      }
      voiceSel.disabled = false; note.textContent = '';
      vs.slice().sort((a, b) => voiceScore(b) - voiceScore(a)).forEach(v => {
        const o = new Option(v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*\)$/, '').replace(/\s+-\s+English.*$/, '') + ' · ' + v.lang.replace('_', '-'), v.voiceURI);
        if(S.voice && v.voiceURI === S.voice.voiceURI) o.selected = true;
        voiceSel.appendChild(o);
      });
    }
    fillVoices();
    if(synth && synth.addEventListener){ try { synth.addEventListener('voiceschanged', fillVoices); } catch(e){} }
    voiceSel.addEventListener('change', () => { LS.set('majlis-guide-voice', voiceSel.value); S.voice = pickVoice(); if(S.playing) restartSentence(); });

    function paintButtons(){
      const t = $('[data-act="toggle"]');
      t.innerHTML = svgIcon(S.playing ? 'pause' : (S.ended ? 'replay' : 'play'), 18);
      t.setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
      $('[data-act="mute"]').innerHTML = svgIcon(S.muted ? 'mute' : 'sound', 18);
      $('[data-act="mute"]').classList.toggle('is-off', S.muted);
      $('[data-act="cc"]').classList.toggle('is-off', !S.cc);
      $('[data-act="speed"]').textContent = (S.speed === 1 ? '1' : String(S.speed)) + '×';
      root.classList.toggle('is-playing', S.playing);
      root.classList.toggle('is-started', S.started);
      root.classList.toggle('no-cc', !S.cc);
    }

    /* ----- host: pose for each half of the beat, lip-sync while talking ----- */
    let hostKey = '';
    function setHost(pose, expr){
      const key = pose + '|' + expr;
      if(key === hostKey) return;
      hostKey = key;
      const a = charSvg(hostSeed, pose, expr), b = charSvg(hostSeed, pose, 'talking');
      hostInner.innerHTML = a ? `<div class="gv-fig__a">${a}</div><div class="gv-fig__b">${b}</div>` : '';
      hostEl.classList.toggle('is-empty', !a);
    }

    /* ----- scenes ----- */
    let steps = [], sceneEl = null;
    function showBeat(i, animate){
      const b = beats[i];
      const old = sceneEl;
      const holder = document.createElement('div');
      holder.innerHTML = scene(b, lesson);
      sceneEl = holder.firstElementChild;
      if(old && animate){
        old.classList.add('is-leaving');
        setTimeout(() => old.remove(), 420);
        sceneEl.classList.add('is-entering');
        wipe.classList.remove('is-go'); void wipe.offsetWidth; wipe.classList.add('is-go');
        fx.burst();
      } else canvas.innerHTML = '';
      canvas.appendChild(sceneEl);
      steps = [...sceneEl.querySelectorAll('[data-at]')].map(e => ({ e, at: Number(e.dataset.at) || 0, on: false }));
      // host: hidden on versus (the two debaters fill the stage), hops in otherwise
      const H = HOST[b.type] || ['stand', 'stand', 'happy'];
      hostEl.classList.toggle('is-away', b.type === 'versus');
      hostEl.dataset.type = b.type;
      hostKey = ''; setHost(i === 0 && animate !== false && !S.started ? 'walk' : H[0], H[2]);
      hostEl.classList.remove('is-hop'); void hostEl.offsetWidth; hostEl.classList.add('is-hop');
      stage.dataset.type = b.type;
      countEl.textContent = (i + 1) + ' / ' + beats.length;
      $('.gv-track').setAttribute('aria-valuenow', i + 1);
      sceneEl.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        if(btn.dataset.act === 'debate' && typeof opts.onDebate === 'function'){ pause(); opts.onDebate(); }
        if(btn.dataset.act === 'quiz' && typeof opts.onQuiz === 'function'){ pause(); opts.onQuiz(); }
      }));
      S.beatStart = performance.now();
      S.p = 0;
      applyProgress(0, true);
    }

    function applyProgress(p, instant){
      S.p = p;
      steps.forEach(s => {
        const want = p >= s.at - 1e-6;
        if(want !== s.on){
          s.on = want; s.e.classList.toggle('on', want);
          if(want && s.e.dataset.fx === 'slam'){ stage.classList.remove('is-shake'); void stage.offsetWidth; stage.classList.add('is-shake'); }
        }
      });
      if(sceneEl) sceneEl.style.setProperty('--p', p.toFixed(3));
      if(instant && sceneEl) sceneEl.classList.toggle('is-instant', true), requestAnimationFrame(() => sceneEl && sceneEl.classList.remove('is-instant'));
    }

    /* ----- captions: the current sentence, words lighting up as they're said ----- */
    let capKey = '';
    function captionsFor(b){
      const shown = splitSentences(b.text), spoken = splitSentences(b.say || b.text);
      return { spoken, shown: shown.length === spoken.length ? shown : null, whole: b.text };
    }
    function paintCaption(frac){
      const b = beats[S.i], c = captionsFor(b);
      const txt = c.shown ? (c.shown[S.sent] || c.shown[c.shown.length - 1] || '') : c.whole;
      const key = S.i + '|' + S.sent + '|' + txt;
      if(key !== capKey){ capKey = key; cap.innerHTML = wordList(txt).map(w => `<span>${esc(w)}</span>`).join(' '); }
      const spans = cap.children, n = spans.length;
      const lit = c.shown ? Math.ceil(frac * n) : Math.ceil(S.p * n);
      for(let k = 0; k < n; k++) spans[k].classList.toggle('on', k < lit);
    }

    /* ----- narration ----- */
    function clearTimers(){ clearTimeout(S.timer); clearTimeout(S.watchdog); S.timer = S.watchdog = null; }
    function stopSpeech(){ S.token++; S.talking = false; clearTimers(); if(synth){ try { synth.cancel(); } catch(e){} } }
    function useVoice(){ return !!(synth && !S.muted); }

    function runSentence(){
      const b = beats[S.i];
      const c = captionsFor(b);
      if(S.sent >= c.spoken.length){ return afterBeat(); }
      const line = c.spoken[S.sent];
      const my = ++S.token;
      const est = (words(line) / WPS + 0.35) / S.speed;
      S.sentEst = est; S.boundaryWord = -1; S.sentStart = performance.now(); S.talking = true;
      const done = () => { if(my !== S.token || !S.playing) return; clearTimers(); S.talking = false; S.sent++; S.timer = setTimeout(runSentence, 160); };
      if(useVoice()){
        const u = new SpeechSynthesisUtterance(line);
        if(!S.voice) S.voice = pickVoice();   // voices can load after the player is built
        if(S.voice){ u.voice = S.voice; u.lang = S.voice.lang; }   // else: the device's default voice
        u.rate = Math.min(2, Math.max(.5, 0.98 * S.speed)); u.pitch = 1; u.volume = 1;
        u.onstart = () => { if(my === S.token) S.sentStart = performance.now(); };
        u.onboundary = (e) => { if(my !== S.token || !e || e.name === 'sentence') return; S.boundaryWord = words(line.slice(0, (e.charIndex || 0) + 1)); };
        u.onend = done;
        u.onerror = (e) => { if(my !== S.token) return; if(e && (e.error === 'interrupted' || e.error === 'canceled')) return; done(); };
        S.watchdog = setTimeout(done, est * 1000 * 2.2 + 2500);   // some browsers never fire onend
        try { synth.speak(u); } catch(e){ done(); }
      } else {
        S.timer = setTimeout(done, est * 1000);
      }
    }
    function afterBeat(){
      if(S.i >= beats.length - 1){ finish(); return; }
      go(S.i + 1, true);
    }
    function finish(){
      stopSpeech();
      S.playing = false; S.ended = true;
      applyProgress(1); setProgressBar(1); paintCaption(1);
      paintButtons();
      if(typeof opts.onEnd === 'function') opts.onEnd();
    }
    function go(i, keepPlaying){
      stopSpeech();
      const target = clamp(i, 0, beats.length - 1);
      const animate = S.started && target !== S.i;
      S.i = target; S.sent = 0; S.ended = false;
      showBeat(S.i, animate);
      if(!S.playing) applyProgress(S.started ? 1 : 0);   // paused: show the whole scene
      paintCaption(0); setProgressBar();
      if(keepPlaying && S.playing) S.timer = setTimeout(runSentence, 450);   // let the scene land first
      paintButtons();
    }
    function restartSentence(){ stopSpeech(); if(S.playing) runSentence(); }

    function play(){
      if(current && current !== api) current.pause();
      current = api;
      if(S.ended){ S.ended = false; S.started = true; go(0, false); }
      const first = !S.started;
      S.started = true;
      S.playing = true;
      if(first){ showBeat(S.i, false); setHost('walk', 'happy'); hostEl.classList.add('is-walkin'); setTimeout(() => hostEl.classList.remove('is-walkin'), 1300); }
      if(synth){ try { synth.cancel(); synth.resume(); } catch(e){} }
      paintButtons();
      S.timer = setTimeout(runSentence, first ? 500 : 60);
      S.lastFrame = performance.now();
      requestAnimationFrame(loop);
    }
    function pause(){
      if(!S.playing) return;
      S.playing = false;
      stopSpeech();
      hostEl.classList.remove('is-talking');
      paintButtons();
    }

    // how far through this beat are we? whole sentences done + a guess (or the voice's word events) inside this one
    function beatFraction(){
      const c = captionsFor(beats[S.i]);
      const all = c.spoken.reduce((n, s) => n + words(s), 0) || 1;
      const before = c.spoken.slice(0, S.sent).reduce((n, s) => n + words(s), 0);
      const cur = c.spoken[S.sent];
      let inSent = 0, sentFrac = 0;
      if(cur && S.talking){
        const n = words(cur);
        const t = (performance.now() - S.sentStart) / 1000;
        sentFrac = clamp(t / (n / WPS / S.speed), 0, .97);
        if(S.boundaryWord > 0) sentFrac = Math.max(sentFrac * .5, clamp(S.boundaryWord / n, 0, 1));
        inSent = sentFrac * n;
      } else if(cur && S.sent > 0){ sentFrac = 0; }
      return { p: clamp((before + inSent) / all, 0, 1), sentFrac };
    }
    function setProgressBar(frac){
      const f = frac != null ? frac : (starts[S.i] + durs[S.i] * S.p) / total;
      fill.style.width = (f * 100).toFixed(2) + '%';
      timeEl.textContent = fmt(f * total) + ' / ' + fmt(total);
    }

    function loop(now){
      if(!root.isConnected){ stopSpeech(); S.playing = false; return; }
      if(!S.playing) return;
      now = now || performance.now();
      const dt = Math.min(.1, (now - S.lastFrame) / 1000); S.lastFrame = now;
      let p, sentFrac;
      ({ p, sentFrac } = beatFraction());
      applyProgress(Math.max(S.p, p));
      paintCaption(sentFrac);
      setProgressBar();
      // host: second pose halfway, mouth flaps while talking
      const H = HOST[beats[S.i].type] || ['stand', 'stand', 'happy'];
      if(!hostEl.classList.contains('is-walkin')) setHost(S.p > .5 ? H[1] : H[0], H[2]);
      if(S.talking && now > S.flapAt){ S.mouth = !S.mouth; S.flapAt = now + (S.mouth ? 90 + Math.random() * 90 : 70 + Math.random() * 70); }
      if(!S.talking) S.mouth = false;
      // on a thinker scene the thinker takes over the talking once their speech bubble is up
      const guestTalks = beats[S.i].type === 'thinker' && S.p >= .28;
      hostEl.classList.toggle('is-talking', S.mouth && !guestTalks);
      if(sceneEl) sceneEl.classList.toggle('is-talking', S.mouth && guestTalks);
      // slow camera push-in across each beat
      const tb = (now - S.beatStart) / 1000;
      const zoom = 1 + .045 * ease(clamp(S.p, 0, 1));
      const drift = Math.sin(tb * .35) * .5;
      world.style.transform = `scale(${zoom.toFixed(4)}) translate(${drift.toFixed(3)}%, ${(Math.cos(tb * .27) * .35).toFixed(3)}%)`;
      fx.draw(dt, drift);
      requestAnimationFrame(loop);
    }

    /* ----- controls ----- */
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if(!b || !root.contains(b) || canvas.contains(b)) return;
      const a = b.dataset.act;
      if(a === 'toggle'){ S.playing ? pause() : play(); }
      else if(a === 'prev'){ S.started = true; go(S.playing && S.sent > 0 ? S.i : S.i - 1, true); }
      else if(a === 'next'){ S.started = true; go(S.i + 1, true); }
      else if(a === 'mute'){ S.muted = !S.muted; LS.set('majlis-guide-muted', S.muted ? '1' : '0'); restartSentence(); }
      else if(a === 'cc'){ S.cc = !S.cc; LS.set('majlis-guide-cc', S.cc ? '1' : '0'); }
      else if(a === 'speed'){ const L = [1, 1.15, 1.3, 1.5, 0.85]; S.speed = L[(L.indexOf(S.speed) + 1) % L.length] || 1; LS.set('majlis-guide-speed', String(S.speed)); restartSentence(); }
      else if(a === 'full'){
        if(document.fullscreenElement){ document.exitFullscreen && document.exitFullscreen(); }
        else if(stage.requestFullscreen) stage.requestFullscreen().catch(() => root.classList.toggle('is-theatre'));
        else root.classList.toggle('is-theatre');
      }
      paintButtons();
    });
    $('.gv-bigplay').addEventListener('click', play);
    stage.addEventListener('click', e => {
      if(e.target.closest('.gv-bigplay') || e.target.closest('[data-act]')) return;
      if(S.started){ S.playing ? pause() : play(); }
    });
    stage.addEventListener('keydown', e => {
      if(e.key === ' ' || e.key === 'k'){ e.preventDefault(); S.playing ? pause() : play(); }
      else if(e.key === 'ArrowRight'){ S.started = true; go(S.i + 1, true); }
      else if(e.key === 'ArrowLeft'){ S.started = true; go(S.i - 1, true); }
    });
    const track = $('.gv-track');
    track.addEventListener('click', e => {
      const r = track.getBoundingClientRect();
      const t = (e.clientX - r.left) / r.width * total;
      let k = 0; starts.forEach((s, j) => { if(t >= s) k = j; });
      S.started = true; go(k, true);
    });

    // poster: the title scene, fully shown, behind the big play button
    showBeat(0, false); applyProgress(1); paintCaption(0); paintButtons();
    setTimeout(() => fx.draw(0, 0), 0);

    const api = { el: root, day: lesson.day, play, pause, go,
      get state(){ return { i: S.i, playing: S.playing, ended: S.ended, beats: beats.length, total, p: S.p, voice: 'browser' }; },
      destroy(){ pause(); stopSpeech(); if(current === api) current = null; } };
    root._gv = api;
    return api;
  }

  // the lesson page re-renders often (quiz answers etc.); keep the same player so playback isn't cut off
  const cache = {};
  function playerFor(lesson, opts){
    Object.keys(cache).forEach(d => { if(Number(d) !== lesson.day){ cache[d].destroy(); delete cache[d]; } });
    if(!cache[lesson.day]) cache[lesson.day] = create(lesson, opts);
    return cache[lesson.day];
  }
  function stopAll(){ Object.keys(cache).forEach(d => { cache[d].destroy(); delete cache[d]; }); if(synth){ try { synth.cancel(); } catch(e){} } }
  setInterval(() => { Object.keys(cache).forEach(d => { if(!cache[d].el.isConnected && cache[d].state.playing) cache[d].pause(); }); }, 700);
  document.addEventListener('visibilitychange', () => { if(document.hidden && current) current.pause(); });

  window.MajlisGuidePlayer = { create, playerFor, stopAll, minutesFor: d => (window.MAJLIS_GUIDE_VIDEOS && window.MAJLIS_GUIDE_VIDEOS[d] || {}).minutes || null };
})();
