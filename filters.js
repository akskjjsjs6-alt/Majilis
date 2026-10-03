/* =====================================================================
   Majlis: your own filters.
   The site never removes words for everyone. Each person chooses what THEY see.
   A hidden message shows "Hidden by your filter" with a Show button, so nothing is ever lost.
   Your choices live in this browser only (localStorage). The word lists for swearing and slurs
   come from the database (filter_terms), so they stay in one place.
   To change what's hidden by default for new visitors, edit DEFAULTS below.
   ===================================================================== */
(function(){
  'use strict';

  const PREFS_KEY = 'majlis-filters';
  const TERMS_KEY = 'majlis-filter-terms';
  const DEFAULTS = { swearing: false, slurs: true, words: [] };   // slurs are hidden (click to show) until you turn it off

  function readJSON(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } }
  function writeJSON(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

  let prefs = Object.assign({}, DEFAULTS, readJSON(PREFS_KEY) || {});
  if(!Array.isArray(prefs.words)) prefs.words = [];
  let terms = readJSON(TERMS_KEY);
  if(!terms || !Array.isArray(terms.list)) terms = { at: 0, list: [] };

  let compiled = null;                 // rebuilt whenever your choices or the word lists change
  const verdicts = new Map();          // text -> 'swearing' | 'slur' | 'custom' | ''  (so lists of messages stay fast)
  const revealed = new Set();          // things you pressed "Show" on, until you reload the page
  let savedNote = '', noteTimer = null;   // the little "Saved" message next to the button

  // Same clean-up the database filter uses, so "sh1t" and "$hit" are caught like "shit".
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 's', '|': 'i' };
  const clean = (t) => String(t).toLowerCase().replace(/[0134578@$!|]/g, (c) => LEET[c] || c);
  const lettersOnly = (s) => s.replace(/[^a-z]/g, '');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function compile(){
    const out = [];
    terms.list.forEach(t => {
      const kind = t.kind === 'swearing' ? 'swearing' : 'slur';
      if(kind === 'swearing' && !prefs.swearing) return;
      if(kind === 'slur' && !prefs.slurs) return;
      try {
        if(t.compact) out.push({ kind, re: new RegExp(t.pattern), onLetters: true });
        else out.push({ kind, re: new RegExp('(^|[^a-z])(' + t.pattern + ')($|[^a-z])'), onLetters: false });
      } catch(e){ /* a pattern this browser can't read is simply skipped */ }
    });
    prefs.words.forEach(w => {
      const word = clean(w).trim();
      if(!word) return;
      try { out.push({ kind: 'custom', re: new RegExp('(^|[^a-z0-9])(' + escapeRe(word) + ')($|[^a-z0-9])'), onLetters: false }); } catch(e){}
    });
    compiled = out;
  }

  // Which of YOUR filters (if any) does this text trip? '' means none.
  function check(text){
    if(text == null) return '';
    const key = String(text);
    if(verdicts.has(key)) return verdicts.get(key);
    if(!compiled) compile();
    let hit = '';
    if(compiled.length){
      const n1 = clean(key), n2 = lettersOnly(n1);
      for(const c of compiled){
        if(c.re.test(c.onLetters ? n2 : n1)){ hit = c.kind; break; }
      }
    }
    if(verdicts.size > 3000) verdicts.clear();
    verdicts.set(key, hit);
    return hit;
  }

  function reset(){ compiled = null; verdicts.clear(); }
  function savePrefs(){ writeJSON(PREFS_KEY, prefs); reset(); }

  // Use this anywhere text from other people is shown. It returns the text itself, or a "Hidden" note with a Show button.
  function wrap(text){
    const key = String(text == null ? '' : text);
    const hit = check(key);
    if(!hit || revealed.has(key)) return key;
    const label = hit === 'custom' ? 'a word you hide' : hit === 'slur' ? 'a slur' : 'swearing';
    const box = document.createElement('span');
    box.className = 'hidden-text';
    box.appendChild(document.createTextNode('Hidden by your filter (' + label + ') '));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hidden-text__show';
    btn.textContent = 'Show';
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      revealed.add(key);
      box.replaceWith(document.createTextNode(key));
    });
    box.appendChild(btn);
    return box;
  }

  // Get the word lists (once a day) and re-draw the page if they changed.
  async function init(redraw){
    try {
      if(Date.now() - terms.at < 86400000 && terms.list.length) return;
      if(typeof sb === 'undefined') return;
      const { data, error } = await sb.rpc('filter_terms');
      if(error || !Array.isArray(data)) return;
      terms = { at: Date.now(), list: data.map(r => ({ kind: r.kind, pattern: r.pattern, compact: !!r.compact })) };
      writeJSON(TERMS_KEY, terms);
      reset();
      if(typeof redraw === 'function') redraw();
    } catch(e){ /* the filter just stays as it was */ }
  }

  // The card on the Settings page.
  function settingsCard(redraw){
    const row = (label, hint, key) => {
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = !!prefs[key]; box.style.cssText = 'margin:3px 10px 0 0;flex:none;';
      box.addEventListener('change', () => { prefs[key] = box.checked; savePrefs(); redraw(); });
      const text = document.createElement('span');
      const strong = document.createElement('b'); strong.textContent = label;
      const small = document.createElement('span'); small.style.cssText = 'display:block;font-size:12.5px;color:var(--parchment-dim);margin-top:2px;'; small.textContent = hint;
      text.append(strong, small);
      const lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:flex-start;line-height:1.45;margin:10px 0;cursor:pointer;';
      lab.append(box, text);
      return lab;
    };
    const card = el('div', { class: 'card' }, [
      el('h3', {}, 'What you see'),
      el('p', { style: 'font-size:13.5px;line-height:1.55;color:var(--parchment-dim);margin-bottom:6px;' },
        'Majlis doesn\'t censor anyone. These switches only change what YOU see. A hidden message shows a Show button, and nothing is deleted for anybody else. Saved on this device.'),
    ]);
    card.appendChild(row('Hide swearing', 'Messages with swear words are tucked away until you click Show.', 'swearing'));
    card.appendChild(row('Hide slurs', 'Messages with slurs are tucked away until you click Show.', 'slurs'));

    const area = document.createElement('textarea');
    area.placeholder = 'One word per line, or separated by commas';
    area.style.cssText = 'min-height:84px;width:100%;margin-top:6px;';
    area.value = prefs.words.join('\n');
    const status = document.createElement('span');
    status.style.cssText = 'font-size:12.5px;color:var(--parchment-dim);margin-left:10px;';
    status.textContent = savedNote;
    const field = el('div', { class: 'field', style: 'margin-top:14px;' }, [el('label', {}, 'Words you never want to see'), area]);
    const save = el('button', { class: 'btn secondary', style: 'margin-top:8px;', onclick: () => {
      const words = Array.from(new Set(area.value.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean))).slice(0, 100);
      prefs.words = words; savePrefs(); area.value = words.join('\n');
      savedNote = words.length ? 'Saved. Hiding ' + words.length + (words.length === 1 ? ' word.' : ' words.') : 'Saved. No custom words.';
      clearTimeout(noteTimer); noteTimer = setTimeout(() => { savedNote = ''; }, 6000);
      status.textContent = savedNote;
      redraw();   // the page redraws, and the note is shown again from savedNote
    } }, 'Save my words');
    field.appendChild(el('div', { style: 'display:flex;align-items:center;' }, [save, status]));
    card.appendChild(field);
    return card;
  }

  window.MajlisFilters = { wrap, check, init, settingsCard, prefs: () => prefs };
})();
