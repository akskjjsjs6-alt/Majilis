/* =====================================================================
   Majlis — Update 28: the 30-day guide as narrated cartoon videos.
   Each lesson in guide-videos-*.js is a list of "beats". The player draws one animated scene per
   beat (same look as the TikTok promos: dark, neon green, Majlis characters, hard cuts) and
   reads the narration with the browser's own voice (Web Speech). No video files to download.
   If the device has no voices, or sound is off, it runs on timed captions instead.
   ===================================================================== */
(function(){
  'use strict';

  const NEON = '#00FF66';
  const LS = { get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : v; } catch(e){ return d; } },
               set(k, v){ try { localStorage.setItem(k, v); } catch(e){} } };

  /* ---------- big stroke icons used in the scenes ---------- */
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
  const svgIcon = (name, size, sw) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || IC.bulb}</svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- narration helpers ---------- */
  const splitSentences = s => String(s || '').split(/(?<=(?<!\b[A-Z])[.?!])\s+(?=[A-Z0-9"'‘“])/).map(x => x.trim()).filter(Boolean);
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const WPS = 2.55;                         // a calm narrator's words per second at speed 1
  const beatSeconds = b => Math.max(3.2, words(b.say || b.text) / WPS + 0.7);

  // the host who presents each part of the guide
  const HOSTS = {
    Philosophy: { hair: 'curly', skin: 'tan', top: 'deep', name: 'Your host' },
    Politics:   { hair: 'bun', skin: 'brown', top: 'navy', name: 'Your host' },
    Theology:   { hair: 'short', skin: 'golden', top: 'moss', name: 'Your host' },
  };
  const POSE_FOR = { title: ['wave', 'happy'], question: ['thinking', 'thinking'], idea: ['explain', 'talking'], example: ['point', 'grinning'],
    list: ['present', 'talking'], quote: ['hand-on-heart', 'content'], thinker: ['present', 'amazed'], versus: ['shrug', 'skeptical'],
    timeline: ['point', 'focused'], scale: ['shrug', 'thinking'], recap: ['thumbs-up', 'proud'], debate: ['fist-pump', 'determined'] };
  const hostCache = {};
  function hostSvg(track, type){
    const key = track + '|' + type;
    if(hostCache[key]) return hostCache[key];
    let s = '';
    try {
      if(window.MajlisCharacters){
        const [pose, expression] = POSE_FOR[type] || ['stand', 'happy'];
        const h = HOSTS[track] || HOSTS.Philosophy;
        const spec = window.MajlisCharacters.random('majlis-guide-host-' + track, { pose, expression, prop: null, extras: [] });
        s = window.MajlisCharacters.svg(spec, { sticker: true, size: 260, title: h.name });
      }
    } catch(e){ s = ''; }
    return (hostCache[key] = s);
  }

  // thinkers get a monogram medallion, not a made-up face
  function monogram(name){
    const parts = String(name).replace(/^(al|ibn|el|de|von|van)[-\s]/i, '').split(/[\s-]+/).filter(p => /^[A-ZÀ-Ý]/.test(p));
    return ((parts[0] || name)[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  /* ---------- scene builders (one per beat type) ---------- */
  function scene(b, lesson, i){
    const st = (d, cls, html) => `<div class="gv-pop ${cls || ''}" style="--d:${d}s">${html}</div>`;
    switch(b.type){
      case 'title': return `<div class="gv-scene gv-title">
          ${st(0, 'gv-kicker', `${esc(lesson.track)} · Day ${lesson.day} of 30`)}
          ${st(.12, 'gv-daynum', String(lesson.day).padStart(2, '0'))}
          ${st(.28, 'gv-h1', esc(b.heading))}
          ${st(.45, 'gv-underline', '')}</div>`;
      case 'question': return `<div class="gv-scene gv-question">
          ${st(0, 'gv-qmark', '?')}${st(.15, 'gv-big', esc(b.big))}</div>`;
      case 'idea': case 'example': return `<div class="gv-scene gv-idea ${b.type === 'example' ? 'is-example' : ''}">
          ${st(0, 'gv-badge', b.type === 'example' ? 'For example' : 'Big idea')}
          ${st(.1, 'gv-iconbub', svgIcon(b.icon, 64, 1.6))}
          ${st(.25, 'gv-h2', esc(b.headline))}
          ${st(.4, 'gv-sub', esc(b.sub))}</div>`;
      case 'thinker': return `<div class="gv-scene gv-thinker">
          ${st(0, 'gv-medal', `<span>${esc(monogram(b.name))}</span>`)}
          <div class="gv-thinker__txt">${st(.15, 'gv-h2', esc(b.name))}${st(.25, 'gv-dates', esc(b.dates))}
          ${st(.45, 'gv-bubble', esc(b.line))}</div></div>`;
      case 'versus': return `<div class="gv-scene gv-versus">
          ${st(0, 'gv-side is-left', `<div class="gv-medal is-sm"><span>${esc(monogram(b.left.name))}</span></div><div class="gv-side__name">${esc(b.left.name)}</div><div class="gv-side__line">${esc(b.left.line)}</div>`)}
          ${st(.2, 'gv-vs', 'VS')}
          ${st(.35, 'gv-side is-right', `<div class="gv-medal is-sm"><span>${esc(monogram(b.right.name))}</span></div><div class="gv-side__name">${esc(b.right.name)}</div><div class="gv-side__line">${esc(b.right.line)}</div>`)}</div>`;
      case 'list': return `<div class="gv-scene gv-list">${st(0, 'gv-h2', esc(b.headline))}
          <ol>${b.items.map((it, k) => `<li class="gv-pop" style="--d:${(.25 + k * .55).toFixed(2)}s"><span>${k + 1}</span>${esc(it)}</li>`).join('')}</ol></div>`;
      case 'quote': return `<div class="gv-scene gv-quote">${st(0, 'gv-qq', '“')}${st(.12, 'gv-quote__q', esc(b.quote))}${st(.5, 'gv-quote__by', '— ' + esc(b.by))}</div>`;
      case 'timeline': return `<div class="gv-scene gv-timeline">${st(0, 'gv-tl-line', '')}
          <div class="gv-tl">${b.events.map((ev, k) => `<div class="gv-pop gv-tl__ev" style="--d:${(.2 + k * .6).toFixed(2)}s"><div class="gv-tl__dot"></div><div class="gv-tl__year">${esc(ev.year)}</div><div class="gv-tl__lbl">${esc(ev.label)}</div></div>`).join('')}</div></div>`;
      case 'scale': return `<div class="gv-scene gv-scalebeat">${st(0, 'gv-h2', esc(b.headline))}
          <div class="gv-pop gv-beam-wrap" style="--d:.2s"><div class="gv-beam" style="--tilt:${(Number(b.tilt) || 0) * -9}deg">
            <div class="gv-pan is-left">${esc(b.left)}</div><div class="gv-pan is-right">${esc(b.right)}</div></div><div class="gv-post"></div></div></div>`;
      case 'recap': return `<div class="gv-scene gv-recap">${st(0, 'gv-badge', 'Recap')}
          <ul>${b.items.map((it, k) => `<li class="gv-pop" style="--d:${(.2 + k * .5).toFixed(2)}s"><span class="gv-tick">✓</span>${esc(it)}</li>`).join('')}</ul></div>`;
      case 'debate': return `<div class="gv-scene gv-debate">${st(0, 'gv-badge is-solid', 'Now argue it')}
          ${st(.15, 'gv-big is-motion', esc(b.motion))}
          ${st(.5, 'gv-cta-row', `<button type="button" class="gv-cta" data-act="debate">Debate this ${svgIcon('arrow', 16, 2.2)}</button><button type="button" class="gv-cta is-ghost" data-act="quiz">Take the quiz</button>`)}</div>`;
      default: return `<div class="gv-scene">${st(0, 'gv-sub', esc(b.text))}</div>`;
    }
  }

  /* ---------- voices ---------- */
  const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  function englishVoices(){
    if(!synth) return [];
    return synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
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
    if(!vs.length) return null;
    const want = LS.get('majlis-guide-voice', '');
    return vs.find(v => v.voiceURI === want) || vs.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
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

    const S = { i: 0, playing: false, ended: false, sent: 0, beatT0: 0, beatElapsed: 0, token: 0, timer: null, watchdog: null,
      speed: Number(LS.get('majlis-guide-speed', '1')) || 1, muted: LS.get('majlis-guide-muted', '0') === '1',
      cc: LS.get('majlis-guide-cc', '1') !== '0', voice: null, started: false };

    const root = document.createElement('div');
    root.className = 'gv';
    root.dataset.day = lesson.day;
    root.innerHTML = `
      <div class="gv-stage" tabindex="0" aria-label="Day ${lesson.day} video lesson">
        <div class="gv-bg"><div class="gv-grid"></div><div class="gv-glow"></div></div>
        <div class="gv-brand">MAJLIS <span>· Day ${lesson.day}</span></div>
        <div class="gv-count"></div>
        <div class="gv-canvas"></div>
        <div class="gv-host" aria-hidden="true"></div>
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
        <div class="gv-track" role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0" aria-valuemax="${beats.length}">
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
    const stage = $('.gv-stage'), canvas = $('.gv-canvas'), hostEl = $('.gv-host'), cap = $('.gv-caption'),
          fill = $('.gv-track__fill'), timeEl = $('.gv-time'), countEl = $('.gv-count'), voiceSel = $('.gv-voice'), note = $('.gv-note');

    function fmt(s){ s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    function fillVoices(){
      const vs = englishVoices();
      S.voice = pickVoice();
      voiceSel.innerHTML = '';
      if(!synth || !vs.length){
        voiceSel.disabled = true;
        voiceSel.appendChild(new Option('No voices on this device', ''));
        note.textContent = synth ? 'Your device has no English voice installed, so the video plays with captions.' : 'This browser can\'t read aloud, so the video plays with captions.';
        return;
      }
      voiceSel.disabled = false; note.textContent = '';
      vs.slice().sort((a, b) => voiceScore(b) - voiceScore(a)).forEach(v => {
        const o = new Option(v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*\)$/, '') + ' · ' + v.lang.replace('_', '-'), v.voiceURI);
        if(S.voice && v.voiceURI === S.voice.voiceURI) o.selected = true;
        voiceSel.appendChild(o);
      });
    }
    fillVoices();
    if(synth && 'onvoiceschanged' in synth){ synth.addEventListener('voiceschanged', fillVoices); }
    voiceSel.addEventListener('change', () => {
      LS.set('majlis-guide-voice', voiceSel.value);
      S.voice = pickVoice();
      if(S.playing){ restartSentence(); }
    });

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

    function showBeat(i){
      const b = beats[i];
      canvas.innerHTML = scene(b, lesson, i);
      canvas.firstElementChild.classList.add('is-cut');
      const h = hostSvg(lesson.track, b.type);
      hostEl.innerHTML = h;
      hostEl.className = 'gv-host is-' + b.type + (h ? '' : ' is-empty');
      hostEl.classList.remove('is-in'); void hostEl.offsetWidth; hostEl.classList.add('is-in');
      countEl.textContent = (i + 1) + ' / ' + beats.length;
      root.querySelector('.gv-track').setAttribute('aria-valuenow', i + 1);
      canvas.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        if(btn.dataset.act === 'debate' && typeof opts.onDebate === 'function'){ pause(); opts.onDebate(); }
        if(btn.dataset.act === 'quiz' && typeof opts.onQuiz === 'function'){ pause(); opts.onQuiz(); }
      }));
    }

    function captionsFor(b){
      const shown = splitSentences(b.text), spoken = splitSentences(b.say || b.text);
      return { spoken, shown: shown.length === spoken.length ? shown : null, whole: b.text };
    }
    function setCaption(b, k){
      const c = captionsFor(b);
      cap.textContent = c.shown ? c.shown[k] || '' : c.whole;
    }

    function clearTimers(){ clearTimeout(S.timer); clearTimeout(S.watchdog); S.timer = S.watchdog = null; }
    function stopSpeech(){ S.token++; clearTimers(); if(synth){ try { synth.cancel(); } catch(e){} } }

    function useVoice(){ return !!(synth && !S.muted && englishVoices().length); }

    // speak sentence k of the current beat, then the next, then move on
    function runSentence(){
      const b = beats[S.i];
      const c = captionsFor(b);
      if(S.sent >= c.spoken.length){ return afterBeat(); }
      setCaption(b, S.sent);
      const line = c.spoken[S.sent];
      const my = ++S.token;
      const est = (words(line) / WPS + 0.35) / S.speed;
      if(useVoice()){
        const u = new SpeechSynthesisUtterance(line);
        if(S.voice){ u.voice = S.voice; u.lang = S.voice.lang; } else u.lang = 'en-GB';
        u.rate = Math.min(2, Math.max(.5, 0.98 * S.speed)); u.pitch = 1; u.volume = 1;
        const done = () => { if(my !== S.token || !S.playing) return; clearTimers(); S.sent++; S.timer = setTimeout(runSentence, 140); };
        u.onend = done;
        u.onerror = (e) => { if(my !== S.token) return; if(e && (e.error === 'interrupted' || e.error === 'canceled')) return; done(); };
        // some browsers never fire onend — don't let the video get stuck
        S.watchdog = setTimeout(done, est * 1000 * 2.2 + 2500);
        try { synth.speak(u); } catch(e){ done(); }
        S.sentStart = performance.now();
      } else {
        S.sentStart = performance.now();
        S.timer = setTimeout(() => { if(my !== S.token || !S.playing) return; S.sent++; runSentence(); }, est * 1000);
      }
    }
    function afterBeat(){
      S.beatElapsed = 0;
      if(S.i >= beats.length - 1){ finish(); return; }
      go(S.i + 1, true);
    }
    function finish(){
      stopSpeech();
      S.playing = false; S.ended = true;
      setProgress(1);
      paintButtons();
      if(typeof opts.onEnd === 'function') opts.onEnd();
    }

    function go(i, keepPlaying){
      stopSpeech();
      S.i = Math.max(0, Math.min(beats.length - 1, i));
      S.sent = 0; S.ended = false; S.beatT0 = performance.now();
      showBeat(S.i);
      setCaption(beats[S.i], 0);
      setProgress();
      if(keepPlaying && S.playing){ S.timer = setTimeout(runSentence, 380); }   // let the cut land first
      paintButtons();
    }
    function restartSentence(){ stopSpeech(); if(S.playing) runSentence(); }

    function play(){
      if(current && current !== api) current.pause();
      current = api;
      if(S.ended){ S.ended = false; go(0, false); }
      if(!S.started){ S.started = true; showBeat(S.i); setCaption(beats[S.i], 0); }
      S.playing = true;
      if(synth){ try { synth.cancel(); synth.resume(); } catch(e){} }
      paintButtons();
      runSentence();
      loop();
    }
    function pause(){
      if(!S.playing) return;
      S.playing = false;
      stopSpeech();
      paintButtons();
    }

    // progress: whole beats done + a guess at how far through this one we are
    function setProgress(frac){
      let f = frac;
      if(f == null){
        const c = captionsFor(beats[S.i]);
        const wordsBefore = c.spoken.slice(0, S.sent).reduce((n, s) => n + words(s), 0);
        const all = c.spoken.reduce((n, s) => n + words(s), 0) || 1;
        let inSent = 0;
        if(S.playing && S.sentStart && c.spoken[S.sent]){
          const est = (words(c.spoken[S.sent]) / WPS) / S.speed;
          inSent = Math.min(.95, (performance.now() - S.sentStart) / 1000 / est) * words(c.spoken[S.sent]);
        }
        f = (starts[S.i] + durs[S.i] * Math.min(1, (wordsBefore + inSent) / all)) / total;
      }
      fill.style.width = (f * 100).toFixed(2) + '%';
      timeEl.textContent = fmt(f * total) + ' / ' + fmt(total);
    }
    function loop(){
      if(!S.playing || !root.isConnected){ if(!root.isConnected) stopSpeech(); return; }
      setProgress();
      requestAnimationFrame(loop);
    }

    // controls
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
        const fs = document.fullscreenElement;
        if(fs) document.exitFullscreen && document.exitFullscreen();
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
      else if(e.key === 'ArrowRight'){ go(S.i + 1, true); }
      else if(e.key === 'ArrowLeft'){ go(S.i - 1, true); }
    });
    const track = $('.gv-track');
    track.addEventListener('click', e => {
      const r = track.getBoundingClientRect();
      const t = (e.clientX - r.left) / r.width * total;
      let k = 0; starts.forEach((s, j) => { if(t >= s) k = j; });
      S.started = true; go(k, true);
    });

    // first frame: title card behind the big play button
    showBeat(0); setCaption(beats[0], 0); paintButtons();

    const api = { el: root, day: lesson.day, play, pause, go, get state(){ return { i: S.i, playing: S.playing, ended: S.ended, beats: beats.length, total }; },
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
  // if the player leaves the page (new tab, other lesson), stop talking
  setInterval(() => { Object.keys(cache).forEach(d => { if(!cache[d].el.isConnected && cache[d].state.playing) cache[d].pause(); }); }, 700);
  document.addEventListener('visibilitychange', () => { if(document.hidden && current) current.pause(); });

  window.MajlisGuidePlayer = { create, playerFor, stopAll, minutesFor: d => (window.MAJLIS_GUIDE_VIDEOS && window.MAJLIS_GUIDE_VIDEOS[d] || {}).minutes || null };
})();
