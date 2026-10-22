/* =====================================================================
   Majlis — your results, explored
   The sections under the three maps on the Compass page: every axis with how sure the test is about it (and the
   answers that pull against each other), a 3D cube and a constellation of everyone the AI placed around you, your
   figures through the ages, your closest parties, books to read, a side-by-side comparison with anyone, and short
   deep dives on one topic. Also the coloured ideology tags beside names and the guide's notes for you.
   Loaded before app.js. Nothing here runs until the page is up.
   ===================================================================== */

/* ---------- deep dives: 8 statements on one topic, scored on the test's own axes (see COMPASS_AXES) ---------- */
const RX_DIVES = [
  { key: 'work', title: 'Work and wealth', blurb: 'Unions, rents, profits and who should get what.', items: [
    ["Trade unions do more good than harm for ordinary workers.", {ex: -6, ey: -3}],
    ["Cutting taxes on businesses is the surest way to create jobs.", {ex: 6, ey: 4}],
    ["A four-day working week should be the legal standard.", {ex: -5, ey: -5}],
    ["Landlords should be free to charge whatever rent the market will pay.", {ex: 6, ey: 6}],
    ["Big fortunes are usually earned fairly and shouldn't be resented.", {ex: 7}],
    ["The state should guarantee a job to anyone who wants one.", {ex: -7, ey: -6}],
    ["Most regulations on small businesses should be scrapped.", {ey: 8}],
    ["Companies should be required by law to share their profits with their workers.", {ex: -7, ey: -4}],
  ] },
  { key: 'borders', title: 'Borders and belonging', blurb: 'Immigration, citizenship and national culture.', items: [
    ["Newcomers should have to learn the national language before they become citizens.", {as: -7}],
    ["A country is richer for having many cultures living side by side.", {as: 8, px: 3}],
    ["Refugees fleeing war should be welcomed, even if it costs the country money.", {as: 5, px: 6}],
    ["National traditions should be taught with pride in schools.", {as: -5, sx: -5, px: -3}],
    ["People should be free to live and work in any country they choose.", {px: 8, as: 5}],
    ["Holding two citizenships weakens loyalty to the country.", {px: -6, as: -4}],
    ["Holy days of minority religions should become public holidays too.", {as: 7}],
    ["Immigration should be kept low to protect the country's way of life.", {as: -8, px: -4}],
  ] },
  { key: 'tech', title: 'Technology and the future', blurb: 'AI, gene editing, surveillance and progress.', items: [
    ["Research into human-level artificial intelligence should continue at full speed.", {tc: 8}],
    ["Gene editing to prevent disease in unborn children should be allowed.", {tc: 7, sx: 2}],
    ["Some technologies are too dangerous to develop at all, whatever the benefits.", {tc: -7}],
    ["Governments should be able to read encrypted messages to fight crime.", {py: -7}],
    ["Nuclear power should be a big part of the fight against climate change.", {tc: 5}],
    ["Social media is doing more harm than good to young people.", {tc: -5, sx: -2}],
    ["People should be free to sell their personal data if they want to.", {ey: 5, sy: 5, tc: 3}],
    ["Facial-recognition cameras in public places make us safer and should be used widely.", {py: -6, tc: 3}],
  ] },
  { key: 'war', title: 'War and the world', blurb: 'Armies, alliances, intervention and international law.', items: [
    ["A strong army is the best guarantee of peace.", {ml: -7}],
    ["My country should cut military spending and spend the money at home.", {ml: 6}],
    ["Rich countries should stop genocide abroad, by force if they have to.", {ml: -4, px: 5}],
    ["International courts should be able to put any country's leaders on trial.", {px: 8}],
    ["Selling weapons to other countries should be banned.", {ml: 7}],
    ["My country should put its own interests first, even when its allies disagree.", {px: -7}],
    ["Military service should be compulsory for young people.", {ml: -6, sy: -4}],
    ["Nuclear weapons should be abolished, even if rival countries keep theirs.", {ml: 8}],
  ] },
  { key: 'faith', title: 'Religion and the state', blurb: 'Faith schools, holy days and the law.', items: [
    ["Religious schools should get the same public funding as other schools.", {rl: -6}],
    ["Laws should never be based on religious teachings.", {rl: 8}],
    ["A country is better off when most of its people practise a religion.", {rl: -7, sx: -3}],
    ["Religious symbols should be kept out of government offices and courts.", {rl: 7}],
    ["Blasphemy should be legal, however offensive it is.", {rl: 5, py: 4}],
    ["Religious leaders should speak out on political issues.", {rl: -5}],
    ["Schools should teach about all the world's religions, not just one.", {rl: 3, as: 4}],
    ["The main holy days of the national religion should stay public holidays.", {rl: -5, sx: -2}],
  ] },
  { key: 'power', title: 'Democracy and power', blurb: 'Who decides: voters, experts, leaders or regions.', items: [
    ["Important decisions should be made by experts rather than by voters.", {dm: -6}],
    ["Regions should be able to hold a vote on becoming independent.", {fd: 7, dm: 3}],
    ["Citizens should be able to force a referendum on any law by collecting signatures.", {dm: 7, fd: 3}],
    ["In a crisis, the leader should be able to rule by decree.", {dm: -8, py: -4}],
    ["Cities and regions should set most of their own taxes.", {fd: 8}],
    ["The police should have more powers to fight crime, even at some cost to privacy.", {py: -7}],
    ["Voting should be compulsory.", {dm: 3, py: -4}],
    ["Laws should be the same everywhere in the country.", {fd: -7}],
  ] },
  { key: 'planet', title: 'Nature and climate', blurb: 'Growth, carbon, cars and who pays.', items: [
    ["Climate change should be fought mainly with carbon prices and markets, not bans.", {ey: 6}],
    ["Economic growth should be given up if that's what it takes to protect nature.", {tc: -6, ex: -3}],
    ["Meat should be taxed to protect the climate.", {ey: -6}],
    ["New technology will solve climate change without us changing how we live.", {tc: 7}],
    ["New roads and airports should be built, even if they damage the countryside.", {tc: 5, ey: 3}],
    ["Rich countries should pay poorer ones for the damage their emissions have caused.", {px: 5, ex: -4}],
    ["Farmers should be paid with public money to look after wildlife.", {ey: -5}],
    ["New petrol and diesel cars should be banned from sale within ten years.", {ey: -7, tc: -2}],
  ] },
].map(t => Object.assign(t, { items: t.items.map(([q, w]) => ({ sec: 'dive-' + t.key, q, w, opts: LIKERT })) }));

/* ---------- what the page remembers between redraws ---------- */
const rx = { more: { loading: false, error: null }, cmp: { q: '', loading: false, error: null, them: null }, dive: null,
  cube: { a: -0.6, b: 0.42, drag: null, pick: null }, star: null, partyTab: 'active', conflicts: false, topSent: null };
const rxStore = (name) => 'majlis-' + name + '-' + (state.user && state.user.id || 'guest');
function rxLoad(name, fallback){ try { const v = JSON.parse(localStorage.getItem(rxStore(name)) || 'null'); return v == null ? fallback : v; } catch(e){ return fallback; } }
function rxSave(name, v){ try { localStorage.setItem(rxStore(name), JSON.stringify(v)); } catch(e){} }
const rxClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rxReduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RX_SVG = 'http://www.w3.org/2000/svg';
function rxSvg(tag, attrs){ const n = document.createElementNS(RX_SVG, tag); for(const k in attrs || {}) n.setAttribute(k, attrs[k]); return n; }

/* ---------- every axis, with its key ---------- */
const RX_MAP_AX = [['economic', 'x', 'ex'], ['economic', 'y', 'ey'], ['political', 'x', 'px'], ['political', 'y', 'py'], ['social', 'x', 'sx'], ['social', 'y', 'sy']];
function rxAxisRows(u){
  const rows = [];
  RX_MAP_AX.forEach(([m, c, key]) => {
    const p = u.compass && u.compass[m];
    if(!p) return;
    const d = COMPASS_DEFS[m], l = c === 'x' ? d.xLabels : d.yLabels;
    rows.push({ key, lo: l[0], hi: l[1], v: p[c], group: 'map' });
  });
  const ex = u.extraScores || {}, ph = u.philosophyAxes || {};
  Object.keys(DETAIL_AXES).forEach(k => { if(typeof ex[k] === 'number') rows.push({ key: k, lo: DETAIL_AXES[k][0], hi: DETAIL_AXES[k][1], v: ex[k], group: 'detail' }); });
  Object.keys(PHIL_AXES).forEach(k => { if(typeof ph[k] === 'number') rows.push({ key: k, lo: PHIL_AXES[k][0], hi: PHIL_AXES[k][1], v: ph[k], group: 'phil' }); });
  rows.forEach(r => { r.v = rxClamp(Math.round(r.v), 0, 100); });
  return rows;
}
function rxAxisName(key){
  const m = RX_MAP_AX.find(a => a[2] === key);
  if(m){ const d = COMPASS_DEFS[m[0]], l = m[1] === 'x' ? d.xLabels : d.yLabels; return l[0] + ' – ' + l[1]; }
  const l = DETAIL_AXES[key] || PHIL_AXES[key];
  return l ? l[0] + ' – ' + l[1] : key;
}

/* ---------- your answers, read back for the confidence and the contradiction check ---------- */
function rxDiveSaved(){ return rxLoad('dives', {}); }
function rxAnswers(withDives){
  let raw = [];
  try { raw = JSON.parse(localStorage.getItem(answersKey()) || '[]'); } catch(e){}
  const byQ = new Map(COMPASS_ITEMS.map(i => [i.q, i]));
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach(pair => {
    const item = byQ.get(pair && pair[0]);
    const j = item ? item.opts.findIndex(o => String(pair[1] || '').startsWith(o)) : -1;
    if(j >= 0) out.push({ item, j, v: POSITION_VALUE[j] });
  });
  if(withDives){
    const saved = rxDiveSaved();
    RX_DIVES.forEach(t => (saved[t.key] && saved[t.key].ans || []).forEach((j, i) => {
      if(t.items[i] && j >= 0 && j < 5) out.push({ item: t.items[i], j, v: POSITION_VALUE[j], dive: t.key });
    }));
  }
  return out;
}
// How sure the test is on each axis. Every statement you answered, on its own, would put you somewhere on the axis;
// when those spots agree (even all in the middle) the result is clear, when they're scattered it's mixed. Fewer
// statements make it less sure too. "margin" is the ± shown on the bar.
function rxConfidence(answers){
  const acc = {};
  answers.forEach(({ item, v }) => Object.keys(item.w).forEach(k => {
    const w = Math.abs(item.w[k]), p = 50 + 50 * v * Math.sign(item.w[k]);
    (acc[k] = acc[k] || []).push({ w, p });
  }));
  const out = {};
  Object.keys(acc).forEach(k => {
    const list = acc[k], W = list.reduce((n, x) => n + x.w, 0);
    if(!W) return;
    const mean = list.reduce((n, x) => n + x.w * x.p, 0) / W;
    const sd = Math.sqrt(list.reduce((n, x) => n + x.w * (x.p - mean) ** 2, 0) / W);
    const n = list.length, size = Math.sqrt(Math.min(1, n / 5));
    const conf = Math.round(100 * (1 - sd / 50) * size);
    out[k] = { conf, n, margin: Math.round(rxClamp(sd / Math.sqrt(n) * 1.6 + (1 - size) * 12, 3, 30)),
      word: conf >= 68 ? 'Clear' : conf >= 45 ? 'Fairly clear' : 'Mixed' };
  });
  return out;
}
// Pairs of answers that pull opposite ways: two statements worded from opposite ends of the same axis, on the same
// subject, and you agreed (or disagreed) with both. Sometimes that's a real nuance, so each can be kept as it is.
function rxConflicts(){
  const answers = rxAnswers(false).filter(a => Math.abs(a.v) >= 0.5);
  const kept = rxLoad('conflicts-ok', []);
  const main = (w) => Object.keys(w).sort((a, b) => Math.abs(w[b]) - Math.abs(w[a]))[0];
  const found = [];
  answers.forEach((A, i) => answers.slice(i + 1).forEach(B => {
    const k = main(A.item.w);
    if(A.item.sec !== B.item.sec || main(B.item.w) !== k) return;
    const wa = A.item.w[k], wb = B.item.w[k];
    if(Math.sign(wa) === Math.sign(wb) || Math.sign(A.v) !== Math.sign(B.v)) return;
    if(Math.abs(A.v) + Math.abs(B.v) < 1.5 || Math.min(Math.abs(wa), Math.abs(wb)) < 5) return;
    const id = (A.item.q + '|' + B.item.q).length + ':' + A.item.q.slice(0, 24) + B.item.q.slice(0, 24);
    if(kept.includes(id)) return;
    found.push({ A, B, k, id, score: (Math.abs(A.v) + Math.abs(B.v)) * Math.min(Math.abs(wa), Math.abs(wb)) });
  }));
  const used = new Set();
  return found.sort((a, b) => b.score - a.score).filter(c => {
    if(used.has(c.A.item.q) || used.has(c.B.item.q)) return false;
    used.add(c.A.item.q); used.add(c.B.item.q); return true;
  }).slice(0, 5);
}

/* ---------- the extra AI results: parties, the figures of each era, and books ---------- */
function rxMore(){
  const u = state.user;
  if(!u || !u.compass) return null;
  const sig = compassSig(u.compass);
  if(rx.more.data && rx.more.data.sig === sig) return rx.more.data;
  const saved = rxLoad('more', null);
  if(saved && saved.v === 1 && saved.sig === sig){ rx.more.data = saved; return saved; }
  return null;
}
async function rxFetchMore(){
  const u = state.user, m = savedCardMatches();
  if(!u || u.isGuest || !u.compass || !m || rx.more.loading) return;
  rx.more = { loading: true, error: null };
  render();
  const near = ['modern', 'historical'].flatMap(era => (m.leaders || []).filter(l => l.era === era).slice(0, 3)).map(l => l.name);
  try {
    const { data, error } = await sb.functions.invoke('ai-matches', { region: FN_REGION, body: Object.assign({ mode: 'more', near }, aiPersonBody(u)) });
    if(data && data.error) throw new Error(data.error);
    if(error || !data || !data.more) throw new Error(error ? (error.message || 'the server call failed') : 'no answer');
    const okPhoto = (p) => typeof p === 'string' && (p.startsWith('data:image/') || MATCH_PHOTO.test(p)) ? p : null;
    const more = { v: 1, sig: compassSig(u.compass), at: Date.now(),
      parties: (data.more.parties || []).filter(p => p && p.name && okPos(p.pos)),
      eras: (data.more.eras || []).filter(f => f && f.name && okPos(f.pos)).map(f => Object.assign(f, { photo: okPhoto(f.photo) || okPhoto(f.photoUrl) })),
      books: (data.more.books || []).filter(b => b && b.title && b.author) };
    rx.more = { loading: false, error: null, data: more };
    rxSave('more', more);
  } catch(e){
    console.warn('more results unavailable', e);
    rx.more = { loading: false, error: String(e && e.message || e).slice(0, 140) };
  }
  render();
}

/* ---------- small pieces ---------- */
const RX_KIND = { you: 'You', leader: 'Leader', nation: 'Nation', ideology: 'Ideology', party: 'Party', member: 'Majlis member', figure: 'Figure' };
const RX_KINDS = { leader: 'Leaders', nation: 'Nations', ideology: 'Ideologies', party: 'Parties', member: 'Others on Majlis' };
function rxRing(pct){
  const c = 2 * Math.PI * 44, off = c * (1 - rxClamp(pct || 0, 0, 100) / 100);
  return el('div',{class:'rx-ring', role:'img', 'aria-label': pct + '% match', html:'<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rx-ring__track" cx="50" cy="50" r="44"/>'
    + '<circle class="rx-ring__arc" cx="50" cy="50" r="44" style="stroke-dasharray:' + c.toFixed(1) + ';stroke-dashoffset:' + off.toFixed(1) + '"/></svg>'},
    el('div',{class:'rx-ring__in'},[el('b',{}, pct + '%'), el('small',{}, 'MATCH')]));
}
function rxFlag(code, name){
  if(!/^[a-z]{2}$/.test(code || '')) return el('span',{class:'rx-flag rx-flag--none'}, initialsOf(name || '?') || '?');
  const img = new Image();
  img.className = 'rx-flag'; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.loading = 'lazy';
  img.src = 'https://flagcdn.com/w80/' + code + '.png';
  img.onerror = () => img.replaceWith(el('span',{class:'rx-flag rx-flag--none'}, code.toUpperCase()));
  return img;
}
// The closeness of anyone with a position, across the three maps (as the server computes it).
function rxPct(pos){
  const me = state.user.compass;
  if(!okPos(pos)) return null;
  const d = Math.sqrt(['economic', 'political', 'social'].reduce((n, k) => n + (me[k].x - pos[k].x) ** 2 + (me[k].y - pos[k].y) ** 2, 0));
  return Math.max(0, Math.round(100 - d / 1.8));
}
function rxSection(id, kicker, title, sub, body){
  return el('section',{class:'rx-sec', id: 'rx-' + id},[
    el('div',{class:'kicker'}, kicker),
    el('h3',{class:'rx-sec__title'}, title),
    sub ? el('p',{class:'rx-sec__sub'}, sub) : null,
    body,
  ]);
}
function rxWaitNote(text, retry){
  return el('div',{class:'rx-wait' + (retry ? '' : ' is-loading')},[text, retry ? el('button',{class:'btn secondary rx-wait__btn', onclick: retry}, 'Try again') : null]);
}
// What the extra sections show while the AI is still working (or can't be reached).
function rxMoreGate(){
  if(!state.user || state.user.isGuest) return rxWaitNote('Sign in to see this part of your results.');
  if(!savedCardMatches()) return rxWaitNote('Your matches are being found. This part appears once your card is ready.');
  if(rx.more.error) return rxWaitNote('The AI couldn\'t be reached (' + rx.more.error + ').', () => { rx.more = { loading: false, error: null }; rxFetchMore(); });
  if(!rx.more.loading) setTimeout(rxFetchMore, 0);
  return rxWaitNote('The AI is finding your parties, your figures through history and your books…');
}

/* ================= 1. ALL YOUR AXES, WITH CONFIDENCE ================= */
function rxAxesSection(){
  const u = state.user, rows = rxAxisRows(u), conf = rxConfidence(rxAnswers(true));
  const any = Object.keys(conf).length > 0;
  const head = { map: 'THE THREE MAPS', detail: 'POLICY AXES', phil: 'PHILOSOPHY' };
  const list = el('div',{class:'rx-axes'});
  let group = null;
  rows.forEach(r => {
    if(r.group !== group){ group = r.group; list.appendChild(el('div',{class:'rx-axes__group'}, head[group])); }
    const c = conf[r.key], hi = r.v >= 50, lean = Math.abs(r.v - 50);
    const side = lean < 5 ? 'Balanced' : (hi ? r.v : 100 - r.v) + '% ' + (hi ? r.hi : r.lo);
    const bar = el('div',{class:'rx-ax__bar'},[
      c ? el('i',{class:'rx-ax__band', style:'left:' + rxClamp(r.v - c.margin, 0, 100) + '%;right:' + (100 - rxClamp(r.v + c.margin, 0, 100)) + '%', title:'± ' + c.margin}) : null,
      el('i',{class:'rx-ax__mid'}),
      el('i',{class:'rx-ax__dot', style:'left:' + r.v + '%'}),
    ]);
    list.appendChild(el('div',{class:'rx-ax rx-ax--' + r.group + (lean < 5 ? ' is-mid' : '')},[
      el('div',{class:'rx-ax__top'},[
        el('span',{class:'rx-ax__end' + (!hi && lean >= 5 ? ' is-lean' : '')}, r.lo),
        el('b',{class:'rx-ax__val'}, side),
        el('span',{class:'rx-ax__end rx-ax__end--r' + (hi && lean >= 5 ? ' is-lean' : '')}, r.hi),
      ]),
      bar,
      c ? el('div',{class:'rx-ax__conf rx-conf--' + c.word.toLowerCase().replace(/ /g, '-'), title: 'From ' + c.n + ' statements'}, [el('i',{}), c.word + ' · ± ' + c.margin]) : null,
    ]));
  });
  const conflicts = any ? rxConflicts() : [];
  const check = el('div',{class:'rx-check'});
  if(any){
    check.appendChild(el('button',{class:'btn secondary', 'aria-expanded': String(rx.conflicts), onclick:()=>{ rx.conflicts = !rx.conflicts; render(); }},
      [rx.conflicts ? 'Hide the contradiction check' : 'Contradiction check', conflicts.length ? el('span',{class:'rx-badge'}, String(conflicts.length)) : null]));
    if(rx.conflicts){
      if(!conflicts.length) check.appendChild(el('p',{class:'rx-note'}, 'No contradictions found: none of your answers pull hard against each other.'));
      conflicts.forEach(cf => {
        const say = (a) => (a.v > 0 ? (a.v === 1 ? 'Strongly agreed' : 'Agreed') : (a.v === -1 ? 'Strongly disagreed' : 'Disagreed'));
        check.appendChild(el('div',{class:'rx-conflict'},[
          el('div',{class:'rx-conflict__axis'}, 'Both on ' + rxAxisName(cf.k)),
          el('div',{class:'rx-conflict__q'},[el('b',{}, say(cf.A) + ': '), cf.A.item.q]),
          el('div',{class:'rx-conflict__q'},[el('b',{}, say(cf.B) + ': '), cf.B.item.q]),
          el('p',{class:'rx-note'}, 'These two are worded from opposite ends of the same axis, so they cancel each other out. If that was on purpose, keep it; if not, a deep dive on the topic will sharpen this axis.'),
          el('div',{class:'rx-conflict__do'},[
            el('button',{class:'btn secondary', onclick:()=>{ const k = rxLoad('conflicts-ok', []); k.push(cf.id); rxSave('conflicts-ok', k.slice(-60)); render(); }}, 'That\'s on purpose'),
            el('button',{class:'linkbtn', onclick:()=>{ const t = rxDiveFor(cf.k); if(t){ rx.dive = { key: t.key, i: 0, ans: [] }; render(); setTimeout(() => { const n = document.getElementById('rx-dive'); if(n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); } }}, 'Do a deep dive'),
          ]),
        ]));
      });
    }
  }
  return rxSection('axes', 'EVERY AXIS', 'Your ' + rows.length + ' axes', any
    ? 'The shaded band is how sure the test is: narrow when your answers agree with each other, wide when they\'re mixed.'
    : 'How sure the test is on each axis shows here once you take (or retake) the test on this device.', el('div',{},[list, check]));
}
function rxDiveFor(key){ return RX_DIVES.find(t => t.items.some(i => Object.keys(i.w).sort((a, b) => Math.abs(i.w[b]) - Math.abs(i.w[a]))[0] === key)) || RX_DIVES[0]; }

/* ================= 2. THE 3D CUBE ================= */
// Economic left–right across, authoritarian–libertarian up, traditional–progressive in depth. Drag to turn it;
// it turns slowly on its own while you leave it alone.
function rxCubePoints(m){
  const pts = [];
  const add = (kind, name, pos, extra) => { if(okPos(pos)) pts.push(Object.assign({ kind, name, pos, pct: rxPct(pos) }, extra || {})); };
  compassCrowd().slice(0, 80).forEach(x => add('member', x.name || x.username, x.compass, { username: x.username }));
  if(m){
    (m.leaders || []).slice(0, 8).forEach(l => add('leader', l.name, l.pos, { era: l.era }));
    (m.countries || []).slice(0, 4).forEach(c => add('nation', c.name, c.pos));
    (m.ideologies || []).slice(0, 5).forEach(i => add('ideology', i.name, i.pos));
  }
  const more = rxMore();
  if(more) more.parties.filter(p => p.active).slice(0, 3).forEach(p => add('party', p.short || p.name, p.pos));
  add('you', 'You', state.user.compass);
  return pts;
}
function rxCubeSection(m){
  return rxSection('cube', 'IN THREE DIMENSIONS', 'Your political cube', 'Economics runs left to right, authority to liberty runs up, and tradition to progress runs front to back. Zoomed in around you, so the differences show; hollow rings sit further out.',
    rxCubeBody(m));
}
// The cube with its legend, zoom switch and caption; it redraws itself in place, so it also works inside the reveal.
function rxCubeBody(m){
  const pts = rxCubePoints(m);
  const box = el('div',{class:'rx-cube'});
  const svg = rxSvg('svg', { viewBox: '-1.85 -1.75 3.7 3.5', class: 'rx-cube__svg', role: 'img', 'aria-label': 'A 3D cube with you and your matches. Drag to turn it.' });
  box.appendChild(svg);
  const info = el('div',{class:'rx-cube__info', 'aria-live':'polite'});
  const C = [-1, 1];
  const corners = []; C.forEach(x => C.forEach(y => C.forEach(z => corners.push([x, y, z]))));
  const edges = [];
  corners.forEach((a, i) => corners.forEach((b, j) => { if(j > i && a.filter((v, k) => v !== b[k]).length === 1) edges.push([a, b]); }));
  const gEdges = rxSvg('g', { class: 'rx-cube__edges' }), gAxes = rxSvg('g', { class: 'rx-cube__axes' }), gDrop = rxSvg('g', { class: 'rx-cube__drops' }), gPts = rxSvg('g'), gLab = rxSvg('g', { class: 'rx-cube__labels' });
  svg.append(gEdges, gAxes, gDrop, gPts, gLab);
  const edgeEls = edges.map(() => gEdges.appendChild(rxSvg('line')));
  const axes = [[[-1.15, 0, 0], [1.15, 0, 0], 'Left', 'Right'], [[0, -1.15, 0], [0, 1.15, 0], 'Authoritarian', 'Libertarian'], [[0, 0, -1.15], [0, 0, 1.15], 'Traditional', 'Progressive']];
  const axisEls = axes.map(() => gAxes.appendChild(rxSvg('line')));
  const labEls = axes.flatMap(a => [a[2], a[3]].map(t => { const n = gLab.appendChild(rxSvg('text', { 'text-anchor': 'middle' })); n.textContent = t; return n; }));
  // Zoomed in, the cube is the space just around you (your matches all sit fairly near); out, it's the whole map.
  const me = state.user.compass, zoom = rx.cube.zoom !== false;
  const near = pts.filter(p => p.kind !== 'member' && p.kind !== 'you');
  // The zoom fits most of your matches (about two in three); the few further out sit on the cube's walls, as hollow rings.
  const devs = near.map(p => Math.max(Math.abs(p.pos.economic.x - me.economic.x), Math.abs(p.pos.political.y - me.political.y), Math.abs(p.pos.social.x - me.social.x))).sort((a, b) => a - b);
  const reach = zoom ? rxClamp((devs[Math.floor(devs.length * 0.65)] || 0) * 1.05, 10, 50) : 50;
  const c0 = zoom ? [me.economic.x, me.political.y, me.social.x] : [50, 50, 50];
  const named = new Set(near.slice().sort((a, b) => b.pct - a.pct).slice(0, 5).map(p => p.name));
  const P = pts.filter(p => !zoom || p.kind !== 'member' || [p.pos.economic.x - c0[0], p.pos.political.y - c0[1], p.pos.social.x - c0[2]].every(d => Math.abs(d) <= reach)).map(p => {
    const raw = [(p.pos.economic.x - c0[0]) / reach, (p.pos.political.y - c0[1]) / reach, (p.pos.social.x - c0[2]) / reach];
    const v = raw.map(x => rxClamp(x, -1, 1)), out = raw.some(x => Math.abs(x) > 1);
    const g = rxSvg('g', { class: 'rx-cube__pt rx-k--' + p.kind + (p.kind === 'you' || named.has(p.name) ? ' is-named' : '') + (out ? ' is-out' : ''), tabindex: p.kind === 'member' ? '-1' : '0' });
    const r = p.kind === 'you' ? 0.085 : p.kind === 'member' ? 0.028 : 0.055;
    const dot = g.appendChild(rxSvg('circle', { r }));
    const t = p.kind === 'member' ? null : g.appendChild(rxSvg('text', { 'text-anchor': 'middle' }));
    if(t) t.textContent = p.kind === 'you' ? 'You' : (p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name);
    const title = g.appendChild(rxSvg('title')); title.textContent = p.name + (p.kind === 'you' ? '' : ' · ' + RX_KIND[p.kind] + (p.pct != null ? ' · ' + p.pct + '%' : ''));
    const drop = gDrop.appendChild(rxSvg('line'));
    const pick = () => { rx.cube.pick = p.kind === 'you' ? null : p.name; showInfo(); paint(); };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pick(); } });
    gPts.appendChild(g);
    return { p, v, g, dot, t, drop, r };
  });
  function showInfo(){
    const hit = P.find(x => x.p.name === rx.cube.pick);
    info.replaceChildren(hit ? el('div',{},[el('b',{}, hit.p.name), ' · ' + RX_KIND[hit.p.kind] + (hit.p.pct != null ? ' · ' + hit.p.pct + '% match' : ''),
      hit.p.username ? el('button',{class:'linkbtn', onclick:()=>viewProfile(hit.p.username)}, ' Open profile') : null])
      : el('span',{}, 'Drag to turn the cube. Tap a dot to see who it is.'));
  }
  const proj = (v) => {
    const { a, b } = rx.cube;
    const x1 = v[0] * Math.cos(a) + v[2] * Math.sin(a), z1 = -v[0] * Math.sin(a) + v[2] * Math.cos(a);
    const y1 = v[1] * Math.cos(b) - z1 * Math.sin(b), z2 = v[1] * Math.sin(b) + z1 * Math.cos(b);
    const s = 3.6 / (3.6 + z2);
    return { x: x1 * s, y: -y1 * s, z: z2, s };
  };
  const set = (n, o) => { for(const k in o) n.setAttribute(k, typeof o[k] === 'number' ? o[k].toFixed(3) : o[k]); };
  function paint(){
    edges.forEach(([A, B], i) => { const p = proj(A), q = proj(B); set(edgeEls[i], { x1: p.x, y1: p.y, x2: q.x, y2: q.y, opacity: (0.55 - (p.z + q.z) / 8).toFixed(2) }); });
    axes.forEach(([A, B], i) => {
      const p = proj(A), q = proj(B);
      set(axisEls[i], { x1: p.x, y1: p.y, x2: q.x, y2: q.y });
      set(labEls[i * 2], { x: p.x, y: p.y + 0.03 }); set(labEls[i * 2 + 1], { x: q.x, y: q.y + 0.03 });
    });
    P.forEach(o => {
      const q = proj(o.v), f = proj([o.v[0], -1, o.v[2]]);
      o.z = q.z;
      set(o.dot, { cx: q.x, cy: q.y, r: o.r * q.s });
      if(o.t) set(o.t, { x: q.x, y: q.y - o.r * q.s - 0.05 });
      set(o.drop, { x1: q.x, y1: q.y, x2: f.x, y2: f.y });
      o.g.classList.toggle('is-pick', o.p.name === rx.cube.pick);
      o.g.style.opacity = (0.95 - Math.max(0, q.z) * 0.25).toFixed(2);
    });
    P.slice().sort((A, B) => B.z - A.z).forEach(o => gPts.appendChild(o.g));
  }
  // Drag to turn (mouse, finger or pen); the arrow keys turn it too.
  svg.addEventListener('pointerdown', (e) => { rx.cube.drag = { x: e.clientX, y: e.clientY, a: rx.cube.a, b: rx.cube.b, at: Date.now() }; svg.setPointerCapture && svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', (e) => {
    const d = rx.cube.drag; if(!d) return;
    rx.cube.a = d.a + (e.clientX - d.x) / 120; rx.cube.b = rxClamp(d.b + (e.clientY - d.y) / 160, -1.2, 1.2); paint();
  });
  const end = () => { if(rx.cube.drag) rx.cube.idleFrom = Date.now(); rx.cube.drag = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.setAttribute('tabindex', '0');
  svg.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
    if(!step) return;
    e.preventDefault(); rx.cube.a += step[0]; rx.cube.b = rxClamp(rx.cube.b + step[1], -1.2, 1.2); rx.cube.idleFrom = Date.now(); paint();
  });
  let mounted = false, last = 0, born = Date.now();
  const tick = (t) => {
    if(svg.isConnected) mounted = true; else if(mounted || Date.now() - born > 120000) return;   // gone, or never shown (a skipped reveal scene)
    // Turns by itself only while it's on screen and left alone.
    const r = mounted && svg.getBoundingClientRect(), seen = r && r.bottom > 0 && r.top < window.innerHeight;
    if(seen && !rxReduced() && !rx.cube.drag && Date.now() - (rx.cube.idleFrom || 0) > 2500){ rx.cube.a += Math.min(50, t - (last || t)) / 6000; paint(); }
    last = t;
    requestAnimationFrame(tick);
  };
  paint(); showInfo(); requestAnimationFrame(tick);
  const legend = el('div',{class:'rx-legend'}, ['you', 'leader', 'nation', 'ideology', 'party', 'member'].filter(k => pts.some(p => p.kind === k))
    .map(k => el('span',{},[el('i',{class:'rx-k rx-k--' + k}), k === 'you' ? 'You' : RX_KINDS[k]])));
  const zoomBtn = el('button',{type:'button', class:'rx-chip rx-cube__zoom', 'aria-pressed': String(zoom), onclick:()=>{ rx.cube.zoom = !zoom; body.replaceWith(rxCubeBody(m)); }}, zoom ? 'Show the whole map' : 'Zoom in around you');
  const body = el('div',{class:'rx-cube-body'},[el('div',{class:'rx-cube__top'},[legend, zoomBtn]), box, info]);
  return body;
}

/* ================= 3. THE CONSTELLATION ================= */
// You in the middle. Every leader, nation, ideology and party the AI placed around you is a star: the closer its
// views, the nearer it sits; up is more libertarian than you, right is further right economically.
function rxStars(m){
  const more = rxMore(), list = [];
  const add = (kind, o, extra) => { if(o && okPos(o.pos)) list.push(Object.assign({ kind, name: o.name, pos: o.pos, pct: rxPct(o.pos), photo: o.photo, code: o.code, flag: o.flag, symbol: o.symbol, note: o.why || o.blurb || o.label || '' }, extra || {})); };
  (m.leaders || []).forEach(l => add('leader', l, { sub: l.era === 'modern' ? 'Modern leader' : 'Historical leader' }));
  (m.countries || []).forEach(c => add('nation', c, { sub: 'Nation today' }));
  (m.oldCountries || []).forEach(c => add('nation', c, { sub: 'Historical state' }));
  (m.ideologies || []).forEach(i => add('ideology', i, { sub: 'Ideology' }));
  if(more) more.parties.forEach(p => add('party', p, { name: p.short || p.name, full: p.name, sub: (p.active ? 'Party · ' : 'Historical party · ') + p.country, note: p.blurb }));
  const me = state.user.compass;
  const hi = Math.max(...list.map(s => s.pct)), lo = Math.min(...list.map(s => s.pct));
  list.forEach((s, i) => {
    const dx = s.pos.economic.x - me.economic.x, dy = s.pos.political.y - me.political.y;
    const ang = Math.abs(dx) + Math.abs(dy) < 2 ? (i * 2.39996) : Math.atan2(dy, dx);
    const r = 13 + (hi === lo ? 0.5 : (hi - s.pct) / (hi - lo)) * 31;   // the nearest just outside you, the furthest near the edge
    s.x = 50 + r * Math.cos(ang); s.y = 50 - r * Math.sin(ang);
  });
  // Nudge stars apart so none sit on top of each other.
  for(let it = 0; it < 40; it++) list.forEach((a, i) => list.slice(i + 1).forEach(b => {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
    if(d < 8.5){ const k = (8.5 - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
  }));
  list.forEach(s => { s.x = rxClamp(s.x, 4, 96); s.y = rxClamp(s.y, 4, 96); });
  return list.sort((a, b) => b.pct - a.pct);
}
function rxConstellationSection(m){
  if(!m) return rxSection('stars', 'YOUR CONSTELLATION', 'Everyone around you', null, rxMoreGate());
  const body = rxSkyBody(m);
  return body ? rxSection('stars', 'YOUR CONSTELLATION', 'Everyone around you', 'The closer a star, the closer its views to yours. Tap one to see who it is.', body) : null;
}
// The sky with its legend and the card for the picked star; picking a star redraws it in place (page or reveal).
function rxSkyBody(m){
  const stars = rxStars(m);
  if(!stars.length) return null;
  const sky = el('div',{class:'rx-sky'});
  // A few fixed background stars (the same every time).
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for(let i = 0; i < 46; i++) sky.appendChild(el('i',{class:'rx-sky__bg', style:'left:' + (rnd() * 100).toFixed(1) + '%;top:' + (rnd() * 100).toFixed(1) + '%;animation-delay:' + (rnd() * 4).toFixed(2) + 's;--s:' + (1 + rnd() * 1.6).toFixed(1) + 'px'}));
  sky.appendChild(el('span',{class:'rx-sky__ax rx-sky__ax--t'}, 'More libertarian'));
  sky.appendChild(el('span',{class:'rx-sky__ax rx-sky__ax--b'}, 'More authoritarian'));
  sky.appendChild(el('span',{class:'rx-sky__ax rx-sky__ax--l'}, 'Further left'));
  sky.appendChild(el('span',{class:'rx-sky__ax rx-sky__ax--r'}, 'Further right'));
  [16, 30, 44].forEach(r => sky.appendChild(el('i',{class:'rx-sky__orbit', style:'width:' + r * 2 + '%;height:' + r * 2 + '%'})));
  const lines = stars.slice(0, 6).map(s => '<line x1="50" y1="50" x2="' + s.x.toFixed(1) + '" y2="' + s.y.toFixed(1) + '"/>').join('');
  sky.appendChild(el('span',{class:'rx-sky__lines', html:'<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + lines + '</svg>'}));
  const sel = stars.find(s => s.name === rx.star) || stars[0];
  stars.forEach((s, i) => sky.appendChild(el('button',{type:'button', class:'rx-star rx-k--' + s.kind + (s === sel ? ' is-on' : '') + (i < 6 ? ' is-named' : ''),
    style:'left:' + s.x.toFixed(1) + '%;top:' + s.y.toFixed(1) + '%;--z:' + (0.7 + s.pct / 140).toFixed(2) + ';animation-delay:' + (i * 0.07).toFixed(2) + 's',
    'aria-label': s.name + ', ' + s.sub + ', ' + s.pct + '% match', onclick:()=>{ rx.star = s.name; body.replaceWith(rxSkyBody(m)); }},
    [el('i',{class:'rx-star__dot'}), el('span',{class:'rx-star__name'}, s.name)])));
  sky.appendChild(el('div',{class:'rx-sky__you'}, el('b',{}, 'You')));
  const pic = sel.kind === 'leader' ? portraitNode(sel.name, sel.photo) : sel.kind === 'nation' ? (sel.code ? rxFlag(sel.code, sel.name) : sel.flag ? el('img',{class:'rx-flag', src: sel.flag, alt:''}) : rxFlag('', sel.name))
    : sel.kind === 'ideology' ? ideologyEmblem(sel.name, sel.symbol) : rxFlag(sel.code, sel.name);
  const card = el('div',{class:'rx-starcard'},[
    el('div',{class:'rx-starcard__pic'}, pic),
    el('div',{class:'rx-starcard__body'},[el('div',{class:'rx-starcard__kind'}, sel.sub), el('b',{}, sel.full || sel.name), sel.note ? el('p',{}, sel.note) : null]),
    el('div',{class:'rx-starcard__pct'}, sel.pct + '%'),
  ]);
  const legend = el('div',{class:'rx-legend'}, ['leader', 'nation', 'ideology', 'party'].filter(k => stars.some(s => s.kind === k)).map(k => el('span',{},[el('i',{class:'rx-k rx-k--' + k}), RX_KINDS[k]])));
  const body = el('div',{class:'rx-sky-body'},[legend, sky, card]);
  return body;
}

/* ================= 4. TIMELINE BY ERA ================= */
const RX_ERAS = [['antiquity', 'Antiquity', 'Until 476'], ['middle', 'Middle Ages', '476 to 1500'], ['early', 'Early modern', '1500 to 1800'],
  ['c19', '19th century', '1800 to 1900'], ['c20', '20th century', '1900 to 2000'], ['c21', '21st century', 'Since 2000']];
function rxTimelineSection(){
  const more = rxMore();
  if(!more) return rxSection('timeline', 'THROUGH THE AGES', 'Your ideological timeline', null, rxMoreGate());
  const rows = RX_ERAS.map(([key, name, span]) => ({ key, name, span, figs: more.eras.filter(f => f.era === key).slice(0, 2) })).filter(r => r.figs.length);
  if(!rows.length) return null;
  rows.forEach(r => { r.avg = Math.round(r.figs.reduce((n, f) => n + f.pct, 0) / r.figs.length); });
  const best = rows.slice().sort((a, b) => b.avg - a.avg)[0];
  const line = el('ol',{class:'rx-tl'}, rows.map(r => el('li',{class:'rx-tl__row' + (r === best ? ' is-best' : '')},[
    el('div',{class:'rx-tl__era'},[el('b',{}, r.name), el('small',{}, r.span)]),
    el('div',{class:'rx-tl__figs'}, r.figs.map(f => el('div',{class:'rx-tl__fig', title: f.label},[
      portraitNode(f.name, f.photo),
      el('div',{},[el('b',{}, f.name), el('small',{}, [f.years, f.label].filter(Boolean).join(' · '))]),
      el('em',{}, f.pct + '%'),
    ]))),
  ])));
  const hero = el('div',{class:'rx-hero'},[
    el('div',{class:'rx-hero__pics'}, best.figs.map(f => portraitNode(f.name, f.photo))),
    el('div',{class:'rx-hero__text'},[el('div',{class:'kicker'}, 'YOUR MOST COMPATIBLE ERA'), el('b',{class:'rx-hero__name'}, best.name), el('small',{}, best.span)]),
    rxRing(best.avg),
  ]);
  return rxSection('timeline', 'THROUGH THE AGES', 'Your ideological timeline', 'The two figures from each age whose views sit nearest yours.', el('div',{},[line, hero]));
}

/* ================= 5. CLOSEST PARTIES ================= */
function rxPartiesSection(){
  const more = rxMore();
  if(!more) return rxSection('parties', 'AT THE BALLOT BOX', 'Parties closest to you', null, rxMoreGate());
  const tabs = [['active', 'Active today'], ['historical', 'Historical']].filter(([k]) => more.parties.some(p => p.active === (k === 'active')));
  if(!tabs.length) return null;
  if(!tabs.some(([k]) => k === rx.partyTab)) rx.partyTab = tabs[0][0];
  const list = more.parties.filter(p => p.active === (rx.partyTab === 'active'));
  const top = list[0];
  const seg = el('div',{class:'rx-tabs', role:'group', 'aria-label':'Which parties'}, tabs.map(([k, label]) => el('button',{type:'button', class:'rx-tabs__b' + (k === rx.partyTab ? ' is-on' : ''), 'aria-pressed': String(k === rx.partyTab), onclick:()=>{ rx.partyTab = k; render(); }}, label)));
  const hero = el('div',{class:'rx-hero'},[
    el('div',{class:'rx-hero__pics'}, rxFlag(top.code, top.country)),
    el('div',{class:'rx-hero__text'},[el('div',{class:'kicker'}, top.active ? 'YOUR CLOSEST PARTY' : 'YOUR CLOSEST PARTY IN HISTORY'),
      el('b',{class:'rx-hero__name'}, top.name + (top.short && top.short !== top.name ? ' (' + top.short + ')' : '')), el('small',{}, top.country), top.blurb ? el('p',{}, top.blurb) : null]),
    rxRing(top.pct),
  ]);
  const rest = el('div',{class:'rx-rows'}, list.slice(1).map(p => el('div',{class:'rx-row'},[
    rxFlag(p.code, p.country),
    el('div',{class:'rx-row__main'},[el('b',{}, p.name + (p.short && p.short !== p.name ? ' (' + p.short + ')' : '')), el('small',{}, p.country + (p.blurb ? ' · ' + p.blurb : ''))]),
    el('em',{}, p.pct + '%'),
  ])));
  return rxSection('parties', 'AT THE BALLOT BOX', 'Parties closest to you', null, el('div',{},[seg, hero, rest]));
}

/* ================= 6. BOOKS, AND YOUR READING LIST ================= */
const rxToRead = () => rxLoad('toread', []);
const rxBookKey = (b) => (b.title + '|' + b.author).toLowerCase();
function rxAddToRead(b){
  const list = rxToRead();
  if(list.some(x => rxBookKey(x) === rxBookKey(b))) return;
  list.unshift({ title: b.title, author: b.author, year: b.year || null, why: b.why || '', at: Date.now() });
  rxSave('toread', list.slice(0, 60));
  if(window.toast) toast('Added "' + b.title + '" to your reading list');
  render();
}
function rxRemoveToRead(b){ rxSave('toread', rxToRead().filter(x => rxBookKey(x) !== rxBookKey(b))); render(); }
function rxBooksSection(){
  const more = rxMore();
  if(!more) return rxSection('books', 'FURTHER READING', 'Books for you', null, rxMoreGate());
  if(!more.books.length) return null;
  const onList = new Set(rxToRead().map(rxBookKey));
  const grid = el('div',{class:'rx-books'}, more.books.map((b, i) => {
    const has = onList.has(rxBookKey(b));
    return el('div',{class:'rx-book'},[
      el('div',{class:'rx-book__n'}, String(i + 1).padStart(2, '0')),
      el('b',{class:'rx-book__title'}, b.title),
      el('div',{class:'rx-book__by'}, b.author + (b.year ? ' · ' + (b.year < 0 ? -b.year + ' BC' : b.year) : '')),
      b.why ? el('p',{class:'rx-book__why'}, b.why) : null,
      el('button',Object.assign({class:'btn rx-book__btn' + (has ? ' secondary' : ''), onclick:()=>rxAddToRead(b)}, has ? { disabled: 'disabled' } : {}), has ? 'On your reading list ✓' : '+ Add to reading list'),
    ]);
  }));
  const n = rxToRead().length;
  return rxSection('books', 'FURTHER READING', 'Books for you', 'One work by each of the figures nearest you, and a few classics on your worldview.',
    el('div',{},[grid, n ? el('button',{class:'linkbtn rx-gotolist', onclick:()=>navigateWithLoading('reading')}, 'Your reading list has ' + n + ' book' + (n === 1 ? '' : 's') + ' ›') : null]));
}
// On the Reading page: the books you saved, each one tap from being logged.
function rxReadingListCard(){
  const list = rxToRead();
  if(!list.length) return null;
  return el('div',{class:'card rx-toread'},[
    el('h3',{}, 'Your reading list'),
    el('p',{class:'field-caption', style:'margin:-6px 0 12px;'}, 'Books you saved from your results. Start one to log it below.'),
    ...list.map(b => el('div',{class:'book-row rx-toread__row'},[
      el('div',{style:'flex:1;min-width:200px;'},[el('div',{class:'book-title'}, b.title), el('div',{class:'book-meta'}, b.author + (b.why ? ' · ' + b.why : ''))]),
      el('div',{class:'rx-toread__do'},[
        el('button',{class:'btn', onclick:()=>{
          state.drafts['book-title'] = b.title; state.drafts['book-author'] = b.author;
          render();
          setTimeout(() => { const f = document.querySelector('[data-key="book-pages"]'); if(f){ f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus({ preventScroll: true }); } }, 60);
        }}, 'Start it'),
        el('button',{class:'linkbtn', onclick:()=>rxRemoveToRead(b)}, 'Remove'),
      ]),
    ])),
  ]);
}

/* ================= 7. COMPARE WITH ANYONE ================= */
// A Majlis member is compared from their saved results; anyone or anything else is placed by the AI.
async function rxCompare(query){
  const q = String(query || '').trim();
  if(q.length < 2) return;
  rx.cmp = { q, loading: true, error: null, them: null };
  render();
  const handle = q.replace(/^@/, '').toLowerCase();
  const member = Object.values(state.users).find(x => x.compass && !x.isGuest && !x.hiddenStats && (String(x.username).toLowerCase() === handle || String(x.name || '').toLowerCase() === handle));
  if(member){
    rx.cmp = { q, loading: false, error: null, them: { kind: 'member', name: member.name || member.username, username: member.username, pos: member.compass,
      detail: member.extraScores || {}, phil: member.philosophyAxes || {}, summary: member.ideologies ? ['economic', 'political', 'social'].map(k => member.ideologies[k] && member.ideologies[k].label).filter(Boolean).join(' · ') : '' } };
    return render();
  }
  if(!state.user || state.user.isGuest){ rx.cmp = { q, loading: false, error: 'Sign in to compare with people, countries and ideologies outside Majlis.', them: null }; return render(); }
  const maps = {};
  ['economic', 'political', 'social'].forEach(k => { const d = COMPASS_DEFS[k]; maps[k] = { xl: d.xLabels[0], xr: d.xLabels[1], yb: d.yLabels[0], yt: d.yLabels[1] }; });
  try {
    const { data, error } = await sb.functions.invoke('ai-matches', { region: FN_REGION, body: { mode: 'place', query: q, maps } });
    if(data && data.error) throw new Error(data.error);
    if(error || !data || !data.place || !okPos(data.place.pos)) throw new Error(error ? (error.message || 'the server call failed') : 'no answer');
    const p = data.place;
    const photo = [p.photo, p.photoUrl].find(x => typeof x === 'string' && (x.startsWith('data:image/') || MATCH_PHOTO.test(x))) || null;
    rx.cmp = { q, loading: false, error: null, them: { kind: p.kind, name: p.name, pos: p.pos, detail: p.detail || {}, phil: {}, summary: p.summary || '', code: p.code || '', photo } };
  } catch(e){
    rx.cmp = { q, loading: false, error: String(e && e.message || e).slice(0, 160), them: null };
  }
  render();
}
function rxCompareSection(m){
  const input = draft('rx-cmp', el('input',{type:'text', placeholder:'A person, country, party, ideology or @member…', maxlength:'80', 'aria-label':'Who to compare with',
    onkeydown:(e)=>{ if(e.key === 'Enter'){ e.preventDefault(); rxCompare(input.value); } }}));
  const go = el('button',{class:'btn', onclick:()=>rxCompare(input.value)}, rx.cmp.loading ? 'Placing…' : 'Compare');
  const picks = [];
  if(m){
    const lm = leaderFor(m, 'modern'), lh = leaderFor(m, 'historical');
    [lm, lh, (m.countries || [])[0], (m.ideologies || [])[0]].filter(Boolean).forEach(x => picks.push(x.name));
  }
  const far = compassCrowd().map(x => ({ x, d: rxPct(x.compass) })).sort((a, b) => a.d - b.d)[0];
  if(far) picks.push('@' + far.x.username);
  ['Plato', 'Karl Marx', 'Switzerland'].forEach(n => { if(picks.length < 7 && !picks.includes(n)) picks.push(n); });
  const chips = el('div',{class:'rx-chips'}, picks.map(n => el('button',{type:'button', class:'rx-chip', onclick:()=>{ state.drafts['rx-cmp'] = n; rxCompare(n); }}, n)));
  const out = el('div',{class:'rx-cmp__out', 'aria-live':'polite'});
  if(rx.cmp.loading) out.appendChild(rxWaitNote('Placing ' + rx.cmp.q + ' on the maps…'));
  else if(rx.cmp.error) out.appendChild(el('div',{class:'rx-wait'}, rx.cmp.error));
  else if(rx.cmp.them) out.appendChild(rxCompareResult(rx.cmp.them));
  return rxSection('compare', 'SIDE BY SIDE', 'Compare with anyone', 'Pick any person, country, party or ideology, or a Majlis member, and see axis by axis where you meet and where you split.',
    el('div',{},[el('div',{class:'rx-cmp__bar'},[input, go]), chips, out]));
}
function rxCompareResult(t){
  const me = state.user, mine = rxAxisRows(me);
  const theirs = {};
  RX_MAP_AX.forEach(([m, c, key]) => { theirs[key] = t.pos[m][c]; });
  Object.assign(theirs, t.detail || {}, t.phil || {});
  const rows = mine.filter(r => typeof theirs[r.key] === 'number').map(r => Object.assign({}, r, { t: rxClamp(Math.round(theirs[r.key]), 0, 100) }))
    .map(r => Object.assign(r, { gap: Math.abs(r.v - r.t) }));
  const pct = rxPct(t.pos), agree = rows.filter(r => r.gap <= 15).length;
  const split = rows.slice().sort((a, b) => b.gap - a.gap)[0], close = rows.slice().sort((a, b) => a.gap - b.gap)[0];
  const pole = (r, v) => Math.abs(v - 50) < 5 ? 'the middle' : (v >= 50 ? r.hi : r.lo);
  const pic = t.kind === 'member' ? avatarNode(t.username, 46) : t.kind === 'person' ? portraitNode(t.name, t.photo) : t.kind === 'country' ? rxFlag(t.code, t.name) : ideologyEmblem(t.name, null);
  const fpMe = rvFingerprint(rvFpValues(me.compass), ['var(--neon)', 'var(--accent)'], 'rx-fp');
  const fpThem = rvFingerprint(rvFpValues(t.pos), ['var(--gold)', 'var(--danger)'], 'rx-fp');
  return el('div',{class:'rx-cmp'},[
    el('div',{class:'rx-hero'},[
      el('div',{class:'rx-hero__pics'}, pic),
      el('div',{class:'rx-hero__text'},[el('div',{class:'kicker'}, 'YOU AND ' + (t.kind === 'member' ? '@' + t.username : RX_KIND[t.kind] || t.kind).toUpperCase()), el('b',{class:'rx-hero__name'}, t.name),
        t.summary ? el('p',{}, t.summary) : null, el('small',{}, 'You agree on ' + agree + ' of ' + rows.length + ' axes.')]),
      pct != null ? rxRing(pct) : null,
    ]),
    split && close ? el('p',{class:'rx-cmp__sum'},[
      'You split most on ', el('b',{}, rxAxisName(split.key)), ' (you lean ' + pole(split, split.v) + ', they lean ' + pole(split, split.t) + '), and you\'re closest on ', el('b',{}, rxAxisName(close.key)), '.']) : null,
    el('div',{class:'rx-legend'},[el('span',{},[el('i',{class:'rx-k rx-k--you'}), 'You']), el('span',{},[el('i',{class:'rx-k rx-k--them'}), t.name])]),
    el('div',{class:'rx-cmp__rows'}, rows.map(r => el('div',{class:'rx-crow' + (r.gap <= 15 ? ' is-close' : r.gap >= 40 ? ' is-far' : '')},[
      el('div',{class:'rx-crow__top'},[el('span',{}, r.lo), el('em',{}, r.gap <= 15 ? 'Close' : r.gap >= 40 ? 'Far apart' : r.gap + ' apart'), el('span',{}, r.hi)]),
      el('div',{class:'rx-crow__bar'},[
        el('i',{class:'rx-crow__gap', style:'left:' + Math.min(r.v, r.t) + '%;width:' + r.gap + '%'}),
        el('i',{class:'rx-crow__dot rx-crow__dot--them', style:'left:' + r.t + '%', title: t.name + ': ' + r.t}),
        el('i',{class:'rx-crow__dot rx-crow__dot--you', style:'left:' + r.v + '%', title:'You: ' + r.v}),
      ]),
    ]))),
    el('div',{class:'rx-cmp__prints'},[
      el('figure',{},[fpMe.node, el('figcaption',{},[el('b',{}, 'You'), el('code',{}, fpMe.code)])]),
      el('figure',{},[fpThem.node, el('figcaption',{},[el('b',{}, t.name), el('code',{}, fpThem.code)])]),
    ]),
  ]);
}

/* ================= 8. TOPIC DEEP DIVES ================= */
function rxDiveScores(t, ans){
  const sum = {}, max = {};
  ans.forEach((j, i) => { const it = t.items[i]; if(!it || j < 0) return; Object.keys(it.w).forEach(k => { sum[k] = (sum[k] || 0) + POSITION_VALUE[j] * it.w[k]; max[k] = (max[k] || 0) + Math.abs(it.w[k]); }); });
  const out = {};
  Object.keys(max).forEach(k => { if(max[k] >= 5) out[k] = rxClamp(Math.round(50 + 50 * sum[k] / max[k]), 0, 100); });
  return out;
}
function rxDiveSection(){
  const saved = rxDiveSaved();
  const body = el('div',{});
  const d = rx.dive, t = d && RX_DIVES.find(x => x.key === d.key);
  if(t && d.i < t.items.length){
    const it = t.items[d.i];
    const answer = (j) => { d.ans[d.i] = j; d.i++; if(d.i >= t.items.length){ const s = rxDiveSaved(); s[t.key] = { at: Date.now(), ans: d.ans.slice() }; rxSave('dives', s); } render(); };
    body.appendChild(el('div',{class:'rx-dive'},[
      el('div',{class:'rx-dive__head'},[el('b',{}, t.title), el('span',{}, (d.i + 1) + ' of ' + t.items.length),
        el('button',{class:'linkbtn', onclick:()=>{ rx.dive = null; render(); }}, 'Stop')]),
      el('div',{class:'rx-dive__track'}, el('i',{style:'width:' + Math.round(d.i / t.items.length * 100) + '%'})),
      el('div',{class:'rx-dive__q'}, it.q),
      el('div',{class:'rx-dive__opts'}, it.opts.map((o, j) => el('button',{type:'button', class:'rx-dive__opt' + (d.ans[d.i] === j ? ' is-on' : ''), onclick:()=>answer(j)}, o))),
      d.i ? el('button',{class:'linkbtn', onclick:()=>{ d.i--; render(); }}, '‹ Back') : null,
    ]));
    return rxSection('dive', 'TOPIC DEEP DIVES', 'Go deeper on one topic', null, body);
  }
  if(t){
    // Just finished: how this topic moves you, axis by axis, against the full test.
    const scores = rxDiveScores(t, saved[t.key] ? saved[t.key].ans : d.ans), mine = rxAxisRows(state.user);
    body.appendChild(el('div',{class:'rx-dive rx-dive--done'},[
      el('div',{class:'rx-dive__head'},[el('b',{}, t.title + ': your result'), el('button',{class:'linkbtn', onclick:()=>{ rx.dive = null; render(); }}, 'Back to topics')]),
      ...Object.keys(scores).map(k => {
        const r = mine.find(x => x.key === k), v = scores[k], name = rxAxisName(k).split(' – ');
        const diff = r ? v - r.v : null;
        return el('div',{class:'rx-crow'},[
          el('div',{class:'rx-crow__top'},[el('span',{}, name[0]), el('em',{}, diff == null ? v + '%' : Math.abs(diff) < 6 ? 'Same as your test' : Math.abs(diff) + ' points more ' + (diff > 0 ? name[1] : name[0])), el('span',{}, name[1])]),
          el('div',{class:'rx-crow__bar'},[
            r ? el('i',{class:'rx-crow__dot rx-crow__dot--test', style:'left:' + r.v + '%', title:'Full test: ' + r.v}) : null,
            el('i',{class:'rx-crow__dot rx-crow__dot--you', style:'left:' + v + '%', title:'This topic: ' + v}),
          ]),
        ]);
      }),
      el('p',{class:'rx-note'}, 'Filled dot: this topic. Hollow dot: your full test. Your answers here also make the confidence bands above more precise.'),
    ]));
    return rxSection('dive', 'TOPIC DEEP DIVES', 'Go deeper on one topic', null, body);
  }
  body.appendChild(el('div',{class:'rx-topics'}, RX_DIVES.map(x => {
    const done = saved[x.key];
    return el('button',{type:'button', class:'rx-topic' + (done ? ' is-done' : ''), onclick:()=>{ rx.dive = { key: x.key, i: done ? x.items.length : 0, ans: done ? done.ans.slice() : [] }; render(); }},[
      el('b',{}, x.title), el('span',{}, x.blurb), el('small',{}, done ? 'Done · see your result' : x.items.length + ' statements · 2 min'),
    ]);
  })));
  const redo = Object.keys(saved).length ? el('button',{class:'linkbtn', onclick:()=>{ rxSave('dives', {}); render(); }}, 'Clear my deep-dive answers') : null;
  return rxSection('dive', 'TOPIC DEEP DIVES', 'Go deeper on one topic', 'Eight quick statements on one subject sharpen the axes it touches, without retaking the whole test.', el('div',{},[body, redo]));
}

/* ================= THE WHOLE BLOCK, WITH ITS OWN CONTENTS BAR ================= */
function rxSections(){
  const u = state.user;
  if(!u || !u.compass) return null;
  const m = savedCardMatches();
  if(m) rxSyncTopIdeology(m);
  const parts = [
    ['axes', 'Axes', rxAxesSection], ['cube', '3D cube', () => rxCubeSection(m)], ['stars', 'Constellation', () => rxConstellationSection(m)],
    ['timeline', 'Timeline', rxTimelineSection], ['parties', 'Parties', rxPartiesSection], ['books', 'Books', rxBooksSection],
    ['compare', 'Compare', () => rxCompareSection(m)], ['dive', 'Deep dives', rxDiveSection],
  ].map(([id, label, f]) => {
    let node = null;
    try { node = f(); } catch(e){ console.warn('results section ' + id + ' failed', e); }
    return node ? { id, label, node } : null;
  }).filter(Boolean);
  const nav = el('nav',{class:'rx-nav', 'aria-label':'Your results'}, parts.map(p => el('button',{type:'button', class:'rx-nav__b', onclick:()=>{
    const n = document.getElementById('rx-' + p.id); if(n) n.scrollIntoView({ behavior: rxReduced() ? 'auto' : 'smooth', block: 'start' }); }}, p.label)));
  return el('div',{class:'rx'},[
    el('div',{class:'rx__head'},[el('div',{class:'kicker'}, 'EXPLORE YOUR RESULTS'), el('h2',{class:'section-title'}, 'Everything else your answers say')]),
    nav, ...parts.map(p => p.node),
  ]);
}

// At the top of the Compass page, so the sections below the maps are one tap away.
const RX_JUMPS = [['cube', '3D cube'], ['stars', 'Constellation'], ['axes', 'All axes'], ['timeline', 'Timeline'], ['parties', 'Parties'], ['books', 'Books'], ['compare', 'Compare'], ['dive', 'Deep dives']];
function rxJump(id){
  const n = document.getElementById('rx-' + id) || document.querySelector('.rx');
  if(n) n.scrollIntoView({ behavior: rxReduced() ? 'auto' : 'smooth', block: 'start' });
}
function rxJumpBar(){
  if(!state.user || !state.user.compass) return null;
  return el('div',{class:'rx-jump'},[
    el('div',{class:'rx-jump__text'},[el('b',{}, 'Explore your results'), el('span',{}, 'The 3D cube, your constellation, timeline, parties, books and more are below the maps.')]),
    el('div',{class:'rx-jump__chips'}, RX_JUMPS.map(([id, label]) => el('button',{type:'button', class:'rx-chip' + (id === 'cube' || id === 'stars' ? ' is-hot' : ''), onclick:()=>rxJump(id)}, label))),
  ]);
}
// Opens the Compass page (if needed) and scrolls to a section once it's drawn.
function rxOpenSection(id){
  state.showCard = false;
  if(state.tab !== 'compass'){ state.tab = 'compass'; }
  render();
  setTimeout(() => rxJump(id), 120);
}

/* ================= THE CUBE AND THE CONSTELLATION IN THE RESULTS REVEAL ================= */
function rvCubeScene(m){
  if(!state.user || !state.user.compass) return null;
  return { title: 'Your political cube', ms: 2600, node: el('div',{class:'rv-scene'},[el('div',{class:'rv-scene__in rx rx--rv'},[
    el('div',{class:'rv-head'},[el('h2',{class:'rv-title'}, rvWords('Your political cube', 0, 90)),
      el('p',{class:'rv-sub rv-sub--head rv-in', style:'--d:300ms'}, 'Economics across, authority to liberty up, tradition to progress in depth. Drag to turn it.')]),
    el('div',{class:'rv-in rv-in--zoom', style:'--d:400ms'}, rxCubeBody(m)),
  ])]) };
}
function rvSkyScene(m){
  if(!m) return null;
  const body = rxSkyBody(m);
  if(!body) return null;
  return { title: 'Your constellation', ms: 2600, node: el('div',{class:'rv-scene'},[el('div',{class:'rv-scene__in rx rx--rv'},[
    el('div',{class:'rv-head'},[el('h2',{class:'rv-title'}, rvWords('Your constellation', 0, 90)),
      el('p',{class:'rv-sub rv-sub--head rv-in', style:'--d:300ms'}, 'Everyone the AI placed around you. The closer a star, the closer its views. Tap one.')]),
    el('div',{class:'rv-in rv-in--zoom', style:'--d:400ms'}, body),
  ])]) };
}

/* ================= IDEOLOGY TAGS BESIDE NAMES ================= */
// Each ideology gets its own colour from its name (the same name is always the same colour). Cyan is kept for the
// Founder and Co-founder tags, so hues near it are skipped.
function rxHue(name){
  let h = 0;
  for(const ch of String(name).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [];
  for(let d = 0; d < 360; d += 10) if(d < 160 || d > 215) hues.push(d);
  return hues[h % hues.length];
}
function ideologyTag(name, kind){
  return el('span',{class:'ideo-tag ideo-tag--' + kind, style:'--ih:' + rxHue(name),
    title: kind === 'majlis' ? 'Majlis compass: ' + name : 'Closest ideology: ' + name}, '[' + name.toUpperCase() + ']');
}
// full: both tags (profiles); otherwise just one, the named ideology when there is one.
function ideologyTags(u, full){
  if(!u || u.isGuest || !u.placementTaken) return null;
  const majlis = u.ideologies && u.ideologies.economic && u.ideologies.economic.label;
  const named = u.topIdeology;
  if(!full){ const n = named || majlis; return n ? ideologyTag(n, named ? 'named' : 'majlis') : null; }
  return [majlis ? ideologyTag(majlis, 'majlis') : null, named ? ideologyTag(named, 'named') : null];
}
// Your closest ideology is saved with your account (once per result) so others see your tag.
function rxSyncTopIdeology(m){
  const u = state.user, top = m && m.ideologies && m.ideologies[0] && m.ideologies[0].name;
  if(!u || u.isGuest || !u.id || !top || rx.topSent === top) return;
  rx.topSent = top;
  const clean = String(top).replace(/[^\p{L}\s'.,()&/-]/gu, '').trim().slice(0, 50);
  if(!clean || u.topIdeology === clean) return;
  u.topIdeology = clean;
  if(state.users[u.username]) state.users[u.username].topIdeology = clean;
  sb.rpc('save_top_ideology', { p_name: clean }).then(({ error }) => { if(error) console.warn('save_top_ideology failed', error); });
}

/* ================= THE 30-DAY GUIDE, FOR YOU ================= */
// Each lesson's axis, and who stands at each end of it. The note says which side your results put you on and asks
// you to make the best case for the other.
const RX_GUIDE = {
  1: ['C', 'people who are sure they already know', 'Socrates and his questions'],
  2: ['K', 'gut feeling and intuition', 'step-by-step logic'],
  4: ['C', 'certainty', 'Descartes\' method of doubt'],
  5: ['M', 'the view that the mind is more than the brain', 'the view that the mind is the brain'],
  6: ['W', 'free will', 'determinism'],
  7: ['M', 'a soul that stays the same', 'Locke\'s memory-based view of the self'],
  8: ['E', 'duty-based ethics', 'Bentham and Mill'],
  9: ['E', 'Kant and duty', 'judging by consequences'],
  10: ['V', 'meaning that is given to us', 'Sartre and Camus, who say we make our own'],
  11: ['py', 'Hobbes and a strong state', 'Locke and limited government'],
  12: ['dm', 'Plato\'s rule by the wise', 'rule by the people'],
  13: ['ex', 'Rawls', 'Nozick'],
  14: ['py', 'a state that guides people to the good life', 'Mill\'s harm principle'],
  15: ['ey', 'Marx and the welfare state', 'Adam Smith and free markets'],
  16: ['dm', 'democracy\'s critics', 'democracy\'s defenders'],
  17: ['px', 'national sovereignty', 'universal human rights'],
  18: ['as', 'one shared national culture', 'many cultures side by side'],
  19: ['ml', 'the realists, who prepare for war', 'the peacemakers'],
  20: ['py', 'limits on dangerous speech', 'free speech for all'],
  21: ['rl', 'the believer\'s view from inside', 'the outsider\'s view'],
  22: ['M', 'Leibniz and God as the reason for everything', 'the universe as a brute fact'],
  23: ['K', 'Paley\'s design argument', 'Hume and Darwin'],
  24: ['rl', 'the theodicies that defend God', 'the argument from evil'],
  25: ['K', 'al-Ghazali', 'Ibn Rushd'],
  27: ['V', 'morality grounded in God', 'morality made by people'],
  29: ['rl', 'religion shaping the state', 'secularism'],
  30: ['rl', 'believers', 'atheists and sceptics'],
};
function rxGuideNote(day){
  const u = state.user, link = RX_GUIDE[day];
  if(!u || !u.compass || !link) return null;
  const r = rxAxisRows(u).find(x => x.key === link[0]);
  if(!r) return null;
  const lean = r.v - 50, pct = Math.abs(lean) + 50;
  if(Math.abs(lean) < 6) return { side: 'middle', text: 'Your results put you in the middle on ' + r.lo + ' – ' + r.hi + '. Today you\'ll meet ' + link[1] + ' and ' + link[2] + ': notice which one pulls you, and why.' };
  const mine = lean < 0 ? link[1] : link[2], other = lean < 0 ? link[2] : link[1];
  return { side: lean < 0 ? 'lo' : 'hi', text: 'You lean ' + (lean < 0 ? r.lo : r.hi) + ' (' + pct + '%), so you\'ll probably side with ' + mine + '. Your challenge today: make the strongest case you can for ' + other + '.' };
}
// The three lessons that test your firmest views.
function rxGuidePicks(){
  const u = state.user;
  if(!u || !u.compass) return [];
  const rows = rxAxisRows(u);
  return Object.keys(RX_GUIDE).map(Number).map(day => { const r = rows.find(x => x.key === RX_GUIDE[day][0]); return r ? { day, s: Math.abs(r.v - 50) } : null; })
    .filter(Boolean).sort((a, b) => b.s - a.s || a.day - b.day).filter((x, i, all) => all.findIndex(y => RX_GUIDE[y.day][0] === RX_GUIDE[x.day][0]) === i).slice(0, 3).map(x => x.day);
}
