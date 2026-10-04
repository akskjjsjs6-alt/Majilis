/* =====================================================================
   Majlis — Update 26
   Motion of the day · streaks · the 30-day guide · badges · audience votes
   automatic-filter helpers · install as an app · the new-member tour
   Loaded before app.js. Nothing here runs app.js code until the page is up.
   ===================================================================== */

/* ---------- extra icons (merged into app.js's icon set) ---------- */
window.EXTRA_ICONS = {
  flame: '<path d="M12 3c1 3.5 4.5 5.2 4.5 9.5A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.5c0-2 1-3.3 2-4.3.2 1.5 1 2.4 2 2.8C11.2 8.5 11 5.6 12 3z"/><path d="M8 20h8"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M9 9h4M9 13h4"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6L7 10H4z"/><path d="M17 9a4 4 0 0 1 0 6"/><path d="M7 14l1 5h2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3h4l2 5M15.5 11 18 3h-4l-1.4 3.5"/>',
};

/* ---------- small helpers ---------- */
const utcDay = () => new Date().toISOString().slice(0, 10);
function toast(text, kind){
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' toast--' + kind : '');
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, 4200);
}
// After the filter refuses something, tell the moderators' log (the database re-checks it).
function automodNote(error, place, text){
  if(!error) return;
  if(error.hint === 'automod' || /isn't allowed on Majlis/.test(error.message || '')){
    sb.rpc('automod_log', { p_place: place, p_text: String(text || '').slice(0, 500) }).then(() => {}, () => {});
  }
}

/* =====================================================================
   MOTION OF THE DAY
   ===================================================================== */
const MOTIONS = [
  'Should voting be compulsory?', 'Should social media be banned for under-16s?', 'Is it ever right to break the law?',
  'Should school uniforms be scrapped?', 'Is free will an illusion?', 'Should the voting age be lowered to 16?',
  'Is it wrong to eat meat?', 'Should homework be abolished?', 'Can war ever be just?', 'Should zoos exist?',
  'Is lying ever the right thing to do?', 'Should billionaires exist?', 'Do we have a duty to help strangers in need?',
  'Should AI be allowed to make art?', 'Is democracy the best form of government?', 'Should the death penalty be abolished everywhere?',
  'Is it fair to judge historical figures by today\'s values?', 'Should university be free?', 'Does money buy happiness?',
  'Should countries keep nuclear weapons?', 'Is patriotism a virtue?', 'Should phones be banned in schools?',
  'Is it possible to be good without religion?', 'Should parents be able to read their children\'s messages?',
  'Is it better to be feared or loved as a leader?', 'Should rich countries accept more refugees?', 'Is censorship ever justified?',
  'Should exams be replaced by coursework?', 'Can a machine ever truly think?', 'Is it wrong to buy fast fashion?',
  'Should sport and politics be kept apart?', 'Is space exploration worth the money?', 'Should the monarchy be abolished?',
  'Is happiness the point of life?', 'Should influencers have to label every paid post?', 'Should cars be banned from city centres?',
  'Is it right to boycott companies over politics?', 'Should everyone get a universal basic income?', 'Are we responsible for what our ancestors did?',
  'Should video games count as a sport?', 'Is tradition worth keeping for its own sake?', 'Should animals have legal rights?',
  'Is it ever right to tell a white lie to a friend?', 'Should the internet be a human right?', 'Do the ends justify the means?',
  'Should schools teach philosophy from age 11?', 'Is cancel culture a form of accountability?', 'Should there be a maximum wage?',
  'Is it better to be a generalist than a specialist?', 'Should countries have a common world government?', 'Is ignorance ever bliss?',
  'Should tobacco be banned completely?', 'Can you separate the art from the artist?', 'Should the rich pay much higher taxes?',
  'Is it right to have children in a world facing climate change?', 'Should public transport be free?', 'Is anger ever useful in an argument?',
  'Should countries pay reparations for colonialism?', 'Is privacy dead?', 'Should we bring back extinct species?',
  'Is nationalism good for a country?', 'Should students grade their teachers?', 'Is it ever right to break a promise?',
  'Should genetic editing of humans be allowed?', 'Are humans naturally good?', 'Should music lyrics be censored?',
  'Is it more important to be kind or to be honest?', 'Should national service be compulsory?', 'Does religion do more good than harm?',
  'Should online anonymity be banned?', 'Is it wrong to waste food?', 'Should rich nations cancel poor nations\' debts?',
  'Is competition better than cooperation?', 'Should there be limits on free speech online?', 'Is a world without war possible?',
  'Should you always follow your conscience?', 'Should energy drinks be banned for teenagers?', 'Is it right to judge people by their intentions?',
  'Should countries close their borders in a pandemic?', 'Is the customer always right?', 'Should we colonise Mars?',
  'Is truth always better than comfort?', 'Should cheating in exams lead to expulsion?', 'Is it selfish to be rich?',
  'Should religious holidays be national holidays?', 'Is it okay to pirate content you can\'t afford?', 'Should the UN Security Council veto be scrapped?',
  'Is boredom good for you?', 'Should countries ban fossil fuel cars by 2035?', 'Is it ever right to disobey your parents?',
  'Should judges be elected?', 'Is it better to live in a city or the countryside?', 'Should children learn to code before they learn history?',
  'Is fame worth having?', 'Should plastic be banned?', 'Does social media make politics worse?', 'Should we trust experts?',
  'Is it wrong to keep pets?', 'Should all drugs be decriminalised?', 'Is the past worth studying if we can\'t change it?',
  'Should countries spend more on defence or on aid?', 'Is beauty in the eye of the beholder?', 'Should schools start later in the morning?',
  'Is it ever right to steal to feed your family?', 'Should we have a four-day school week?', 'Is it wrong to want to be remembered?',
  'Should hate speech be a crime?', 'Is it better to forgive or to seek justice?', 'Should countries share their vaccines for free?',
  'Is the pen mightier than the sword?', 'Should advertising to children be banned?', 'Is it right to protest by blocking roads?',
  'Should robots pay taxes?', 'Is a good argument more important than a good speaker?', 'Should everyone learn a second language?',
];
function motionDayNumber(){ return Math.floor(Date.now() / 86400000); }
function motionToday(){ return MOTIONS[(motionDayNumber() * 7 + 3) % MOTIONS.length]; }
function motionHoursLeft(){ return Math.max(1, Math.ceil((86400000 - (Date.now() % 86400000)) / 3600000)); }

const motion = { takes: [], loaded: false, loading: false, day: null, at: 0, error: '', side: 'for', editing: false };
async function loadMotion(force){
  if(motion.loading) return;
  if(!force && motion.loaded && motion.day === utcDay() && Date.now() - motion.at < 45000) return;
  motion.loading = true;
  const { data, error } = await sb.rpc('motion_feed', { p_day: null });
  motion.loading = false;
  if(error){ motion.error = 'Takes couldn\'t be loaded. (Has the Update 26 SQL been run?)'; return; }
  motion.error = '';
  motion.takes = (data || []).map(t => ({ id: t.id, userId: t.user_id, username: t.username, name: t.name, side: t.side, body: t.body,
    ts: new Date(t.created_at).getTime(), votes: Number(t.votes) || 0, voted: !!t.voted }));
  motion.loaded = true; motion.day = utcDay(); motion.at = Date.now();
}
function myTake(){ return state.user && state.user.id ? motion.takes.find(t => t.userId === state.user.id) : null; }

async function postTake(side, body, existing){
  if(!state.user || state.user.isGuest){ openAuth('signup'); return; }
  body = String(body || '').trim();
  if(body.length < 3){ toast('Say a little more — at least a few words.'); return; }
  const q = existing ? sb.from('daily_takes').update({ side, body }).eq('id', existing.id) : sb.from('daily_takes').insert({ side, body });
  const { error } = await q;
  if(error){ automodNote(error, 'motion', body); alert(friendlyDbError(error, 'Your take couldn\'t be posted.')); return; }
  delete state.drafts['motion-take'];
  motion.editing = false;
  await Promise.all([loadMotion(true), loadStreak(true)]);
  if(!existing) toast('Take posted — your streak is safe for today.', 'good');
  render();
}
async function deleteTake(t){
  if(!confirm('Delete your take for today?')) return;
  const { error } = await sb.from('daily_takes').delete().eq('id', t.id);
  if(error){ alert(friendlyDbError(error, 'Couldn\'t delete that.')); return; }
  await loadMotion(true); render();
}
async function toggleTakeVote(t){
  if(!state.user || state.user.isGuest){ openAuth('signup'); return; }
  if(t.userId === state.user.id) return;
  t.voted = !t.voted; t.votes += t.voted ? 1 : -1; render();
  const { error } = t.voted ? await sb.from('daily_take_votes').insert({ take_id: t.id })
                            : await sb.from('daily_take_votes').delete().eq('take_id', t.id).eq('user_id', state.user.id);
  if(error){ t.voted = !t.voted; t.votes += t.voted ? 1 : -1; render(); }
}
function debateTheMotion(text){
  if(!state.user || state.user.isGuest){ openAuth('signup'); return; }
  if(!state.user.placementTaken){ navigateWithLoading('assessment'); return; }
  navigateWithLoading('debate');
  return queueForMatch('Text', text, false);
}

function motionSplit(){
  const f = motion.takes.filter(t => t.side === 'for').length, a = motion.takes.filter(t => t.side === 'against').length;
  const total = f + a;
  return { f, a, total, pf: total ? Math.round(f / total * 100) : 50 };
}
function motionBar(){
  const s = motionSplit();
  return el('div',{class:'motion-bar', title: s.f + ' for · ' + s.a + ' against'},[
    el('div',{class:'motion-bar__for', style:'width:' + s.pf + '%;'}, s.total ? s.pf + '% for' : ''),
    el('div',{class:'motion-bar__against', style:'width:' + (100 - s.pf) + '%;'}, s.total ? (100 - s.pf) + '% against' : ''),
  ]);
}
function takeForm(existing){
  const wrap = el('div',{class:'take-form'});
  if(!motion.side || existing && !motion._sideSet){ motion.side = existing ? existing.side : (motion.side || 'for'); motion._sideSet = true; }
  const sides = el('div',{class:'take-sides'});
  [['for', 'For'], ['against', 'Against']].forEach(([k, label]) => sides.appendChild(el('button',{class:'take-side is-' + k + (motion.side === k ? ' is-on' : ''), type:'button',
    onclick:()=>{ motion.side = k; render(); }}, label)));
  wrap.appendChild(sides);
  const ta = draft('motion-take', el('textarea',{class:'take-input', maxlength:'400', placeholder:'Make your case in a few sentences (400 characters max)…'}), existing ? existing.body : undefined);
  const count = el('span',{class:'take-count'}, (ta.value.length) + '/400');
  ta.addEventListener('input', () => { count.textContent = ta.value.length + '/400'; });
  wrap.appendChild(ta);
  wrap.appendChild(el('div',{class:'take-form__foot'},[
    count,
    existing ? el('button',{class:'btn secondary', type:'button', onclick:()=>{ motion.editing = false; render(); }}, 'Cancel') : null,
    el('button',{class:'btn', type:'button', onclick:()=>postTake(motion.side, ta.value, existing)}, existing ? 'Save' : 'Post my take'),
  ]));
  return wrap;
}
function takeCard(t, compact){
  const mine = state.user && t.userId === state.user.id;
  return el('div',{class:'take' + (mine ? ' is-mine' : '') + ' is-' + t.side},[
    el('button',{class:'take__vote' + (t.voted ? ' is-on' : ''), type:'button', title: mine ? 'Your take' : (t.voted ? 'Remove your upvote' : 'Upvote this take'),
      onclick:()=>toggleTakeVote(t)}, [el('span',{class:'take__arrow'}, '▲'), el('b',{}, String(t.votes))]),
    el('div',{class:'take__main'},[
      el('div',{class:'take__who'},[ el('button',{class:'user-link', onclick:()=>viewProfile(t.username)}, t.name), badgeRow(t.username, 'xs'),
        el('span',{class:'take__side'}, t.side === 'for' ? 'For' : 'Against'), compact ? null : el('span',{class:'take__time'}, timeAgo(t.ts)) ]),
      el('div',{class:'take__body'}, t.body),
      mine && !compact ? el('div',{class:'take__tools'},[
        el('button',{class:'linkbtn', onclick:()=>{ motion.editing = true; motion._sideSet = false; render(); }}, 'Edit'),
        el('button',{class:'linkbtn', onclick:()=>deleteTake(t)}, 'Delete'),
      ]) : null,
    ]),
  ]);
}
// The card on the home page
function motionCard(){
  loadMotion().then(() => { if(state.tab === 'home' && motion.at && !motion._shownAt){ motion._shownAt = motion.at; render(); } });
  const text = motionToday(), mine = myTake();
  const card = el('section',{class:'motion-card'});
  card.appendChild(el('div',{class:'motion-card__top'},[
    el('span',{class:'eyebrow motion-card__eyebrow'}, [icon('megaphone', 14), 'Motion of the day']),
    el('span',{class:'motion-card__time'}, 'New motion in ' + motionHoursLeft() + 'h'),
  ]));
  card.appendChild(el('h3',{class:'motion-card__q'}, text));
  card.appendChild(motionBar());
  const s = motionSplit();
  card.appendChild(el('div',{class:'motion-card__meta'}, s.total ? s.total + (s.total === 1 ? ' take so far' : ' takes so far') : 'No takes yet — be the first.'));
  if(mine && !motion.editing) card.appendChild(takeCard(mine, true));
  else if(state.user && !state.user.isGuest) card.appendChild(takeForm(mine));
  const best = ['for', 'against'].map(side => motion.takes.filter(t => t.side === side && (!mine || t.id !== mine.id)).sort((x, y) => y.votes - x.votes)[0]).filter(Boolean);
  best.forEach(t => card.appendChild(takeCard(t, true)));
  card.appendChild(el('div',{class:'motion-card__actions'},[
    el('button',{class:'btn secondary', onclick:()=>navigateWithLoading('motion')}, ['All takes', icon('arrow', 14)]),
    el('button',{class:'btn secondary', onclick:()=>debateTheMotion(text)}, 'Debate it live'),
  ]));
  return card;
}
// The full page
function renderMotion(){
  loadMotion().then(() => { if(state.tab === 'motion' && motion.at !== motion._pageAt){ motion._pageAt = motion.at; render(); } });
  const wrap = el('div',{class:'motion-page'});
  const text = motionToday(), mine = myTake();
  wrap.appendChild(el('div',{class:'kicker'}, 'Motion of the day · ' + new Date().toLocaleDateString([], { weekday:'long', day:'numeric', month:'long' })));
  wrap.appendChild(el('h2',{class:'section-title motion-page__q'}, text));
  wrap.appendChild(el('p',{class:'section-sub'}, 'Everyone gets the same question for the day. Pick a side, make your case, and upvote the takes that make you think — even from the other side. A new motion arrives in ' + motionHoursLeft() + ' hours.'));
  wrap.appendChild(motionBar());
  if(motion.error) wrap.appendChild(el('p',{class:'field-caption warn'}, motion.error));
  const box = el('div',{class:'card motion-page__mine'});
  if(!state.user || state.user.isGuest){
    box.appendChild(el('p',{}, 'Create an account to post your take and start a streak.'));
    box.appendChild(el('button',{class:'btn', onclick:()=>openAuth('signup')}, 'Create an account'));
  } else if(mine && !motion.editing){
    box.appendChild(el('div',{class:'eyebrow'}, 'Your take'));
    box.appendChild(takeCard(mine));
  } else box.appendChild(takeForm(mine));
  wrap.appendChild(box);
  wrap.appendChild(el('div',{class:'hero__cta', style:'margin:14px 0 22px;'},[
    el('button',{class:'btn', onclick:()=>debateTheMotion(text)}, ['Debate it live', icon('arrow', 16)]),
  ]));
  const cols = el('div',{class:'motion-cols'});
  [['for', 'For'], ['against', 'Against']].forEach(([side, label]) => {
    const list = motion.takes.filter(t => t.side === side).sort((x, y) => y.votes - x.votes || x.ts - y.ts);
    const col = el('div',{class:'motion-col is-' + side},[el('div',{class:'motion-col__head'}, [label, el('span',{}, String(list.length))])]);
    if(!list.length) col.appendChild(el('p',{class:'empty-note'}, motion.loaded ? 'Nobody has argued this side yet.' : 'Loading…'));
    list.forEach(t => col.appendChild(takeCard(t)));
    cols.appendChild(col);
  });
  wrap.appendChild(cols);
  return wrap;
}

/* =====================================================================
   STREAKS
   ===================================================================== */
const streak = { current: 0, best: 0, today: false, at: 0 };
async function loadStreak(force){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  if(!force && Date.now() - streak.at < 60000) return;
  streak.at = Date.now();
  const { data, error } = await sb.rpc('streak_of', { uid: state.user.id });
  if(error || !data || !data[0]) return;
  const before = streak.current;
  streak.current = data[0].current_streak || 0; streak.best = data[0].best_streak || 0; streak.today = !!data[0].active_today;
  if(force && streak.current > before && before > 0) toast(streak.current + '-day streak! Keep it going tomorrow.', 'good');
  if(force) refreshMyBadges();
}
function streakChip(){
  if(!state.user || state.user.isGuest) return null;
  const n = streak.current;
  return el('span',{class:'streak-chip' + (streak.today ? ' is-lit' : ''), title: n ? (streak.today ? n + '-day streak — done for today.' : n + '-day streak — debate, read, post a take or do a guide lesson today to keep it.') : 'Start a streak: debate, read, post a take or do a guide lesson.'},
    [icon('flame', 14), String(n)]);
}

/* =====================================================================
   THE 30-DAY GUIDE
   ===================================================================== */
const guide = { done: {}, todayDone: false, loaded: false, open: null, answers: {}, saving: false };
async function loadGuide(){
  if(!state.user || state.user.isGuest || !state.user.id){ guide.loaded = true; return; }
  const { data, error } = await sb.from('guide_progress').select('day, quiz_score, completed_at');
  if(error){ guide.loaded = true; return; }
  guide.done = {}; guide.todayDone = false;
  (data || []).forEach(r => { guide.done[r.day] = { score: r.quiz_score, at: new Date(r.completed_at).getTime() }; if(new Date(r.completed_at).toISOString().slice(0, 10) === utcDay()) guide.todayDone = true; });
  guide.loaded = true;
}
function guideCount(){ return Object.keys(guide.done).length; }
function guideNext(){ for(let d = 1; d <= 30; d++) if(!guide.done[d]) return d; return null; }
function guideStatus(d){
  if(guide.done[d]) return 'done';
  const next = guideNext();
  if(d === next) return guide.todayDone ? 'tomorrow' : 'open';
  return 'locked';
}
function guideDays(){ return (window.MAJLIS_GUIDE && window.MAJLIS_GUIDE.days) || []; }

function renderGuide(){
  if(!guide.loaded) loadGuide().then(() => { if(state.tab === 'guide') render(); });
  const G = window.MAJLIS_GUIDE;
  if(!G) return el('p',{}, 'The guide is loading…');
  if(guide.open) return renderGuideLesson(guideDays()[guide.open - 1]);
  const wrap = el('div',{class:'guide'});
  const done = guideCount(), next = guideNext();
  const hero = el('section',{class:'guide-hero'});
  hero.appendChild(el('div',{class:'kicker'}, '30 days · 10 hours'));
  hero.appendChild(el('h2',{class:'section-title'}, ['Philosophy, Politics ', el('em',{}, '&'), ' Theology']));
  hero.appendChild(el('p',{class:'section-sub'}, G.blurb + ' One lesson unlocks each day — watch a 2–3 minute narrated video or read it in about 20 minutes, then a 3-question check.'));
  const pct = Math.round(done / 30 * 100);
  hero.appendChild(el('div',{class:'guide-progress'},[
    el('div',{class:'guide-progress__track'},[el('div',{class:'guide-progress__fill', style:'width:' + pct + '%;'})]),
    el('div',{class:'guide-progress__text'}, done + ' of 30 days · ' + (done === 30 ? 'finished!' : 'about ' + Math.round((30 - done) / 3) + ' hours to go')),
  ]));
  if(next){
    const st = guideStatus(next);
    hero.appendChild(el('div',{class:'hero__cta'},[
      el('button',{class:'btn', onclick:()=>openGuideDay(next)}, [st === 'tomorrow' ? 'Day ' + next + ' unlocks tomorrow — preview' : (done ? 'Continue: Day ' + next : 'Start Day 1'), icon('arrow', 16)]),
      streakChip(),
    ]));
  } else hero.appendChild(el('div',{class:'guide-done-banner'}, 'You finished all 30 days. Your Graduate badge is on your profile.'));
  wrap.appendChild(hero);
  ['Philosophy', 'Politics', 'Theology'].forEach((track, ti) => {
    const sec = el('section',{class:'guide-track'});
    sec.appendChild(el('div',{class:'guide-track__head'},[el('span',{class:'guide-track__num'}, 'Part ' + (ti + 1)), el('h3',{}, track), el('span',{class:'guide-track__days'}, 'Days ' + (ti * 10 + 1) + '–' + (ti * 10 + 10))]));
    const grid = el('div',{class:'guide-grid'});
    guideDays().filter(d => d.track === track).forEach(d => {
      const st = guideStatus(d.day);
      grid.appendChild(el('button',{class:'guide-day is-' + st, onclick:()=>openGuideDay(d.day)},[
        el('span',{class:'guide-day__n'}, st === 'done' ? '✓' : String(d.day)),
        el('span',{class:'guide-day__title'}, d.title),
        el('span',{class:'guide-day__state'}, st === 'done' ? 'Done · ' + guide.done[d.day].score + '/3' : st === 'open' ? 'Today' : st === 'tomorrow' ? 'Tomorrow' : 'Locked'),
      ]));
    });
    sec.appendChild(grid);
    wrap.appendChild(sec);
  });
  return wrap;
}
function guideMode(){ try { return localStorage.getItem('majlis-guide-mode') === 'read' ? 'read' : 'watch'; } catch(e){ return 'watch'; } }
function setGuideMode(m){ try { localStorage.setItem('majlis-guide-mode', m); } catch(e){} }
function openGuideDay(n){ guide.open = n; guide.answers[n] = guide.answers[n] || {}; render(); window.scrollTo(0, 0); }

function renderGuideLesson(d){
  const wrap = el('div',{class:'guide-lesson'});
  const st = guideStatus(d.day);
  const guestLocked = (!state.user || state.user.isGuest) && d.day > 1;
  wrap.appendChild(el('button',{class:'linkbtn', onclick:()=>{ guide.open = null; if(window.MajlisGuidePlayer) window.MajlisGuidePlayer.stopAll(); render(); }}, '← All 30 days'));
  const vidMin = window.MajlisGuidePlayer && window.MajlisGuidePlayer.minutesFor(d.day);
  const mode = vidMin ? guideMode() : 'read';
  wrap.appendChild(el('div',{class:'guide-lesson__tags'},[el('span',{class:'guide-pill is-' + d.track.toLowerCase()}, d.track),
    el('span',{}, 'Day ' + d.day + ' of 30 · ' + (mode === 'watch' ? vidMin + '-minute video' : 'about 20 minutes'))]));
  wrap.appendChild(el('h2',{class:'section-title'}, d.title));
  wrap.appendChild(el('p',{class:'guide-lesson__hook'}, d.hook));
  if(st === 'locked' || guestLocked){
    wrap.appendChild(el('div',{class:'card guide-lock'},[
      el('p',{}, guestLocked ? 'Create an account to unlock the rest of the guide and save your progress.' : 'Finish Day ' + (d.day - 1) + ' first — one new lesson unlocks each day.'),
      guestLocked ? el('button',{class:'btn', onclick:()=>openAuth('signup')}, 'Create an account') : el('button',{class:'btn secondary', onclick:()=>openGuideDay(guideNext())}, 'Go to Day ' + guideNext()),
    ]));
    return wrap;
  }
  if(vidMin){
    const seg = el('div',{class:'guide-mode', role:'tablist', 'aria-label':'How do you want to learn today?'});
    [['watch', 'Watch', vidMin + ' min · with voice'], ['read', 'Read', 'about 20 min']].forEach(([m, label, sub]) => {
      seg.appendChild(el('button',{type:'button', role:'tab', 'aria-selected': String(mode === m), class:'guide-mode__opt' + (mode === m ? ' is-on' : ''),
        onclick:()=>{ if(mode === m) return; setGuideMode(m); if(m === 'read' && window.MajlisGuidePlayer) window.MajlisGuidePlayer.stopAll(); render(); }},
        [icon(m === 'watch' ? 'video' : 'book', 16), el('span',{class:'guide-mode__lbl'}, label), el('span',{class:'guide-mode__sub'}, sub)]));
    });
    wrap.appendChild(seg);
  }
  const sourceBox = el('div',{class:'guide-box guide-box--source'},[el('div',{class:'eyebrow'}, 'Read the source · 5 min'), el('div',{class:'guide-source__title'}, d.source.title), el('div',{class:'guide-source__by'}, d.source.author), el('p',{}, d.source.read)]);
  if(mode === 'watch'){
    const p = window.MajlisGuidePlayer.playerFor(d, {
      onDebate: () => debateTheMotion(d.debate),
      onQuiz: () => { const q = document.getElementById('guide-quiz'); if(q) q.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      onEnd: () => { const q = document.getElementById('guide-quiz'); if(q) q.classList.add('is-pulse'); },
    });
    if(p) wrap.appendChild(p.el);
    wrap.appendChild(el('details',{class:'guide-box guide-more'},[
      el('summary',{}, 'Key ideas, thinkers and the source'),
      el('div',{class:'eyebrow'}, 'Key ideas'), el('ul',{}, d.keyIdeas.map(k => el('li',{}, k))),
      el('div',{class:'eyebrow'}, 'Thinkers'), el('ul',{class:'guide-thinkers'}, d.thinkers.map(k => el('li',{}, k))),
      sourceBox,
    ]));
  } else {
    if(window.MajlisGuidePlayer) window.MajlisGuidePlayer.stopAll();
    const body = el('div',{class:'guide-lesson__body'});
    d.body.forEach(p => body.appendChild(el('p',{}, p)));
    wrap.appendChild(body);
    wrap.appendChild(el('div',{class:'guide-box guide-box--ideas'},[el('div',{class:'eyebrow'}, 'Key ideas'), el('ul',{}, d.keyIdeas.map(k => el('li',{}, k)))]));
    wrap.appendChild(el('div',{class:'guide-two'},[
      el('div',{class:'guide-box'},[el('div',{class:'eyebrow'}, 'Thinkers'), el('ul',{class:'guide-thinkers'}, d.thinkers.map(k => el('li',{}, k)))]),
      sourceBox,
    ]));
  }
  wrap.appendChild(el('div',{class:'guide-box guide-box--think'},[el('div',{class:'eyebrow'}, 'Think about it'), el('p',{}, d.question)]));

  // quiz
  const ans = guide.answers[d.day] = guide.answers[d.day] || {};
  const quiz = el('div',{class:'guide-quiz', id:'guide-quiz'},[el('div',{class:'eyebrow'}, 'Quick check')]);
  d.quiz.forEach((q, qi) => {
    const picked = ans[qi];
    const qbox = el('div',{class:'guide-q'},[el('div',{class:'guide-q__text'}, (qi + 1) + '. ' + q.q)]);
    const opts = el('div',{class:'guide-q__opts'});
    q.options.forEach((o, oi) => {
      let cls = 'guide-opt';
      if(picked != null){ if(oi === q.answer) cls += ' is-right'; else if(oi === picked) cls += ' is-wrong'; else cls += ' is-dim'; }
      opts.appendChild(el('button',{class:cls, type:'button', onclick:()=>{ if(ans[qi] == null){ ans[qi] = oi; render(); } }}, o));
    });
    qbox.appendChild(opts);
    if(picked != null) qbox.appendChild(el('p',{class:'guide-q__why'}, (picked === q.answer ? 'Right. ' : 'Not quite. ') + q.why));
    quiz.appendChild(qbox);
  });
  wrap.appendChild(quiz);

  const answered = d.quiz.every((q, qi) => ans[qi] != null);
  const score = d.quiz.reduce((n, q, qi) => n + (ans[qi] === q.answer ? 1 : 0), 0);
  const foot = el('div',{class:'guide-finish'});
  if(guide.done[d.day]){
    foot.appendChild(el('div',{class:'guide-finish__done'}, '✓ Day ' + d.day + ' complete · best quiz score ' + guide.done[d.day].score + '/3'));
  } else if(st === 'tomorrow'){
    foot.appendChild(el('div',{class:'guide-finish__done is-wait'}, 'You\'ve done today\'s lesson. You can read ahead — Day ' + d.day + ' can be completed tomorrow.'));
  } else {
    const btn = el('button',{class:'btn', type:'button', onclick: async () => {
      if(!state.user || state.user.isGuest){ openAuth('signup'); return; }
      const { data, error } = await sb.rpc('complete_guide_day', { p_day: d.day, p_score: score });
      if(error){ alert(friendlyDbError(error, 'Your progress couldn\'t be saved.')); return; }
      await loadGuide(); await loadStreak(true);
      toast('Day ' + d.day + ' complete — ' + (Number(data) || guideCount()) + ' of 30.', 'good');
      render();
    }}, answered ? 'Complete Day ' + d.day + ' (' + score + '/3)' : 'Answer the 3 questions to finish');
    btn.disabled = !answered;
    foot.appendChild(btn);
  }
  wrap.appendChild(foot);
  wrap.appendChild(el('div',{class:'guide-box guide-box--debate'},[
    el('div',{class:'eyebrow'}, 'Now argue it'),
    el('div',{class:'guide-debate__q'}, d.debate),
    el('button',{class:'btn secondary', onclick:()=>debateTheMotion(d.debate)}, ['Debate this', icon('arrow', 14)]),
  ]));
  const nav = el('div',{class:'guide-nav'});
  if(d.day > 1) nav.appendChild(el('button',{class:'btn secondary', onclick:()=>openGuideDay(d.day - 1)}, '← Day ' + (d.day - 1)));
  if(d.day < 30 && (guide.done[d.day] || guideStatus(d.day + 1) !== 'locked')) nav.appendChild(el('button',{class:'btn secondary', onclick:()=>openGuideDay(d.day + 1)}, 'Day ' + (d.day + 1) + ' →'));
  wrap.appendChild(nav);
  return wrap;
}

/* =====================================================================
   BADGES — like Discord: each family shows only your highest tier
   ===================================================================== */
const TIER_COLORS = ['#c47f45', '#a9b6c0', '#e3b341', '#2fd38a', '#6fd3ff', '#c58bff'];
const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Emerald', 'Diamond', 'Mythic'];
const BADGE_FAMILIES = [
  { key: 'streak', stat: 'streak_best', icon: 'flame', tiers: [[3, 'Spark'], [7, 'Flame'], [14, 'Blaze'], [30, 'Inferno'], [60, 'Wildfire'], [100, 'Phoenix']], desc: n => n + '-day streak' },
  { key: 'wins', stat: 'wins', icon: 'trophy', tiers: [[1, 'First Win'], [10, 'Contender'], [25, 'Champion'], [50, 'Grandmaster'], [100, 'Legend']], desc: n => n === 1 ? 'Won a ranked debate' : n + ' ranked wins' },
  { key: 'upsets', stat: 'upsets', icon: 'bolt', tiers: [[1, 'Giant Slayer'], [5, 'Underdog'], [15, 'Kingslayer']], desc: n => n === 1 ? 'Beat a higher-ranked debater' : 'Beat higher-ranked debaters ' + n + ' times' },
  { key: 'books', stat: 'books', icon: 'book', tiers: [[1, 'Reader'], [5, 'Bookworm'], [10, 'Scholar'], [25, 'Librarian'], [50, 'Polymath']], desc: n => 'Finished ' + n + (n === 1 ? ' book' : ' books') },
  { key: 'guide', stat: 'guide', icon: 'scroll', tiers: [[10, 'Student'], [20, 'Thinker'], [30, 'Graduate']], desc: n => n >= 30 ? 'Finished the 30-day guide' : n + ' days of the guide' },
  { key: 'takes', stat: 'takes', icon: 'megaphone', tiers: [[7, 'Voice'], [30, 'Orator'], [100, 'Tribune']], desc: n => 'Argued ' + n + ' motions of the day' },
];
function computeBadges(s){
  const out = [];
  if(!s) return out;
  if(s.role === 'mod') out.push({ key: 'role', name: 'Moderator', icon: 'shield', color: '#6fd3ff', desc: 'Keeps Majlis civil', tier: 8 });
  BADGE_FAMILIES.forEach(f => {
    const n = Number(s[f.stat]) || 0;
    let ti = -1; f.tiers.forEach(([min], i) => { if(n >= min) ti = i; });
    if(ti < 0) return;
    const colorIdx = f.tiers.length >= 5 ? ti : Math.min(5, ti * 2 + 1);   // short families still reach the rare colours
    const nextT = f.tiers[ti + 1];
    out.push({ key: f.key, name: f.tiers[ti][1], icon: f.icon, color: TIER_COLORS[colorIdx], tierName: TIER_NAMES[colorIdx], tier: ti,
      desc: f.desc(f.tiers[ti][0]), next: nextT ? 'Next: ' + nextT[1] + ' — ' + f.desc(nextT[0]).toLowerCase() : 'Top tier' });
  });
  return out;
}
const badgeCache = {};   // userId -> { at, stats, list }
let badgeQueue = new Set(), badgeTimer = null;
function requestBadges(ids){
  ids.filter(Boolean).forEach(id => { const c = badgeCache[id]; if(!c || Date.now() - c.at > 300000) badgeQueue.add(id); });
  if(!badgeQueue.size || badgeTimer) return;
  badgeTimer = setTimeout(async () => {
    const batch = [...badgeQueue].slice(0, 60); badgeQueue = new Set([...badgeQueue].slice(60)); badgeTimer = null;
    batch.forEach(id => { badgeCache[id] = badgeCache[id] || { at: Date.now(), list: [] }; badgeCache[id].at = Date.now(); });
    const { data, error } = await sb.rpc('badge_stats', { p_users: batch });
    if(error) return;
    let changed = false;
    (data || []).forEach(s => {
      const list = computeBadges(s), old = badgeCache[s.user_id];
      if(!old || JSON.stringify((old.list || []).map(b => b.key + b.tier)) !== JSON.stringify(list.map(b => b.key + b.tier))) changed = true;
      badgeCache[s.user_id] = { at: Date.now(), stats: s, list };
    });
    if(changed) render();
    if(badgeQueue.size) requestBadges([]);
  }, 120);
}
function badgeSvg(b, size){
  return el('span',{class:'badge-ico', style:'--b:' + b.color + ';width:' + size + 'px;height:' + size + 'px;', html:
    `<svg width="${Math.round(size * .66)}" height="${Math.round(size * .66)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${(window.EXTRA_ICONS[b.icon] || ICON_PATHS[b.icon] || '')}</svg>`});
}
// size: 'xs' (next to names), 'lg' (profile)
function badgeRow(username, size){
  const u = state.users[username] || (state.user && username === state.currentUser ? state.user : null);
  const id = u && u.id;
  if(!id) return null;
  const c = badgeCache[id];
  if(!c || Date.now() - c.at > 300000) requestBadges([id]);
  const list = (c && c.list) || [];
  if(!list.length) return size === 'lg' ? el('p',{class:'badge-empty'}, username === state.currentUser ? 'No badges yet — win a debate, finish a book or keep a 3-day streak to earn your first.' : 'No badges yet.') : null;
  if(size === 'lg'){
    return el('div',{class:'badge-shelf'}, list.map(b => el('div',{class:'badge-big', title: b.desc + (b.next ? ' · ' + b.next : '')},[
      badgeSvg(b, 34), el('div',{},[el('div',{class:'badge-big__name'}, b.name), el('div',{class:'badge-big__desc'}, (b.tierName ? b.tierName + ' · ' : '') + b.desc)]),
    ])));
  }
  return el('span',{class:'badge-row'}, list.slice(0, 5).map(b => { const n = badgeSvg(b, 17); n.title = b.name + ' — ' + b.desc; return n; }));
}
// Your own badges: a toast when you earn a new one.
async function refreshMyBadges(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  const { data, error } = await sb.rpc('badge_stats', { p_users: [state.user.id] });
  if(error || !data || !data[0]) return;
  const list = computeBadges(data[0]);
  badgeCache[state.user.id] = { at: Date.now(), stats: data[0], list };
  const key = 'majlis-badges:' + state.user.id;
  let seen = null; try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){}
  const now = list.map(b => b.key + ':' + b.tier);
  if(seen){ list.filter(b => !seen.includes(b.key + ':' + b.tier) && b.key !== 'role').forEach(b => toast('New badge: ' + b.name + ' — ' + b.desc, 'badge')); }
  try { localStorage.setItem(key, JSON.stringify(now)); } catch(e){}
}

/* =====================================================================
   AUDIENCE VOTES (live audio and video debates)
   ===================================================================== */
const votes = {};   // debateId -> { counts: {userId: n}, mine: userId|null, at }
async function loadVotes(debateId){
  if(!debateId) return;
  const { data, error } = await sb.rpc('debate_vote_counts', { p_debate: debateId });
  if(error) return;
  const v = { counts: {}, mine: null, at: Date.now() };
  (data || []).forEach(r => { v.counts[r.pick_id] = Number(r.votes) || 0; if(r.mine) v.mine = r.pick_id; });
  const old = votes[debateId];
  votes[debateId] = v;
  if(!old || JSON.stringify(old.counts) !== JSON.stringify(v.counts) || old.mine !== v.mine) render();
}
async function castVote(debateId, username){
  if(!state.user || state.user.isGuest){ openAuth('signup'); return; }
  const u = state.users[username]; if(!u || !u.id) return;
  const { data, error } = await sb.rpc('vote_debate', { p_debate: debateId, p_pick: u.id });
  if(error){ alert(friendlyDbError(error, 'Your vote couldn\'t be counted.')); return; }
  const v = { counts: {}, mine: u.id, at: Date.now() };
  (data || []).forEach(r => { v.counts[r.pick_id] = Number(r.votes) || 0; });
  votes[debateId] = v;
  try { if(watch.ch) watch.ch.send({ type: 'broadcast', event: 'vote', payload: { at: Date.now() } }); } catch(e){}
  render();
}
function voteSplit(debateId, a, b){
  const v = votes[debateId] || { counts: {} };
  const ida = state.users[a] && state.users[a].id, idb = state.users[b] && state.users[b].id;
  const na = v.counts[ida] || 0, nb = v.counts[idb] || 0, total = na + nb;
  return { na, nb, total, pa: total ? Math.round(na / total * 100) : 50, ida, idb, mine: v.mine };
}
function audiencePanel(debateId, a, b, canVote){
  if(!votes[debateId] || Date.now() - votes[debateId].at > 8000) loadVotes(debateId);
  const s = voteSplit(debateId, a, b);
  const box = el('div',{class:'audience'});
  box.appendChild(el('div',{class:'audience__head'},[el('span',{class:'eyebrow'}, 'Audience vote'),
    el('span',{class:'audience__total'}, s.total ? s.total + (s.total === 1 ? ' vote' : ' votes') : 'No votes yet')]));
  if(canVote){
    box.appendChild(el('div',{class:'audience__picks'}, [[a, s.ida, s.na], [b, s.idb, s.nb]].map(([name, id, n]) => el('button',{class:'audience__pick' + (s.mine && s.mine === id ? ' is-mine' : ''), type:'button', onclick:()=>castVote(debateId, name)},[
      avatarNode(name, 28), el('span',{class:'audience__name'}, name), el('span',{class:'audience__pct'}, s.total ? Math.round(n / s.total * 100) + '%' : '—'),
    ]))));
    box.appendChild(el('p',{class:'field-caption'}, s.mine ? 'You can change your vote until the debate ends.' : 'Who\'s arguing better? Tap to vote — you can change it until the end.'));
  }
  box.appendChild(el('div',{class:'audience__bar'},[
    el('div',{class:'audience__a', style:'width:' + s.pa + '%;'}, s.total ? a + ' ' + s.pa + '%' : ''),
    el('div',{class:'audience__b', style:'width:' + (100 - s.pa) + '%;'}, s.total ? (100 - s.pa) + '% ' + b : ''),
  ]));
  return box;
}
// On the verdict page: the audience next to the AI judge.
function audienceVerdict(debate){
  if(!debate || (debate.mode !== 'Audio' && debate.mode !== 'Video')) return null;
  if(!votes[debate.id]) loadVotes(debate.id);
  const [a, b] = debate.participants || [];
  const s = voteSplit(debate.id, a, b);
  if(!s.total) return null;
  const leader = s.na === s.nb ? null : (s.na > s.nb ? a : b);
  return el('div',{class:'card audience-verdict'},[
    el('div',{class:'eyebrow'}, 'Audience verdict'),
    el('h3',{}, leader ? leader + ' won the crowd' : 'The crowd was split'),
    el('p',{class:'field-caption'}, s.total + (s.total === 1 ? ' person' : ' people') + ' voted while watching live.' + (debate.verdict && debate.verdict.winner && leader ? (debate.verdict.winner === leader ? ' The AI judge agreed.' : ' The AI judge disagreed.') : '')),
    el('div',{class:'audience__bar'},[
      el('div',{class:'audience__a', style:'width:' + s.pa + '%;'}, a + ' ' + s.pa + '%'),
      el('div',{class:'audience__b', style:'width:' + (100 - s.pa) + '%;'}, (100 - s.pa) + '% ' + b),
    ]),
  ]);
}

/* =====================================================================
   AUTOMATIC FILTER — the moderators' view (a tab on the Reports page)
   ===================================================================== */
const automod = { hits: [], terms: [], loaded: false, error: '', status: 'open', mild: false };
async function loadAutomod(){
  const [h, t] = await Promise.all([sb.rpc('mod_automod_hits', { p_status: automod.status, p_mild: automod.mild }), sb.from('automod_terms').select('pattern, action, compact, note').order('action').order('note')]);
  automod.error = h.error ? friendlyDbError(h.error, 'Couldn\'t load the auto-filter log.') + ' (Run the Update 27 SQL if you haven\'t yet.)' : '';
  automod.hits = (h.data || []); automod.terms = (t.data || []); automod.loaded = true;
  if(automod.status === 'open' && !h.error) state.flagsOpen = automod.hits.filter(x => x.severity === 'serious').length;
}
async function flagAction(h, action){
  if(action === 'remove' && !confirm('Delete this ' + flagWhere(h.tbl).toLowerCase() + ' for everyone?')) return;
  const { error } = await sb.rpc('mod_review_flag', { p_id: h.id, p_action: action });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t do that.')); return; }
  if(action === 'remove'){
    if(h.tbl === 'forum_posts') state.forum = state.forum.filter(p => String(p.id) !== String(h.row_id));
    if(h.tbl === 'forum_replies') state.forum.forEach(p => { p.replies = p.replies.filter(r => String(r.id) !== String(h.row_id)); });
    if(h.tbl === 'wiki_articles') state.wiki = state.wiki.filter(w => String(w.id) !== String(h.row_id));
  }
  await loadAutomod(); render();
}
async function flagSuspend(h, hours){
  const r = prompt('Suspend @' + h.username + ' for ' + (hours / 24) + ' day' + (hours === 24 ? '' : 's') + '?\n\nReason (they will see this):', h.reason ? 'Auto-filter: ' + h.reason : '');
  if(r === null) return;
  const { error } = await sb.rpc('mod_suspend', { p_user: h.user_id, p_hours: hours, p_reason: r.trim() || null });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t suspend them.')); return; }
  toast('@' + h.username + ' is suspended.', 'good');
  await loadAutomod(); render();
}
async function flagWarn(h){
  const text = prompt('Warning to send @' + h.username + ':', 'Please keep it civil — that language isn\'t welcome on Majlis.');
  if(text === null) return;
  const { error } = await sb.rpc('mod_warn', { p_user: h.user_id, p_text: text.trim() });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t send that warning.')); return; }
  toast('Warning sent.', 'good');
}
function flagWhere(tbl){
  return { forum_posts: 'Forum thread', forum_replies: 'Forum reply', messages: 'Direct message', debate_messages: 'Debate message',
    wiki_articles: 'Wiki article', daily_takes: 'Motion take', profiles: 'Name or bio', guilds: 'Guild name' }[tbl] || 'Post';
}
function openFlag(h){
  if(h.tbl === 'forum_posts' || h.tbl === 'forum_replies'){
    const post = h.tbl === 'forum_posts' ? state.forum.find(p => String(p.id) === String(h.row_id)) : state.forum.find(p => p.replies.some(r => String(r.id) === String(h.row_id)));
    if(post){ state.forumOpenThread = post.id; navigateWithLoading('forum'); return; }
  }
  if(h.tbl === 'wiki_articles'){ navigateWithLoading('wiki'); return; }
  if(h.tbl === 'daily_takes'){ navigateWithLoading('motion'); return; }
  if(h.username) viewProfile(h.username);
}
function renderAutomodTab(){
  if(!automod.loaded) loadAutomod().then(() => { if(state.tab === 'reports') render(); });
  const wrap = el('div',{class:'automod'});
  wrap.appendChild(el('p',{class:'section-sub'}, 'The auto-filter never blocks or changes anything — every message goes through as written. When something matches the list it\'s flagged here with a link, so you can decide: remove it, warn or suspend the person, or dismiss the flag. Serious = slurs, threats and "kill yourself"-type messages; mild = ordinary swearing.'));
  const bar = el('div',{class:'report-tabs'});
  [['open', 'To review'], ['removed', 'Removed'], ['dismissed', 'Dismissed'], ['all', 'All']].forEach(([k, label]) =>
    bar.appendChild(el('button',{class:'report-tab' + (automod.status === k ? ' is-on' : ''), onclick: async () => { automod.status = k; await loadAutomod(); render(); }}, label)));
  const mild = el('input',{type:'checkbox'}); mild.checked = automod.mild;
  mild.addEventListener('change', async () => { automod.mild = mild.checked; await loadAutomod(); render(); });
  bar.appendChild(el('label',{class:'automod-mild'},[mild, ' Include mild swearing']));
  wrap.appendChild(bar);
  if(automod.error) wrap.appendChild(el('p',{class:'field-caption warn'}, automod.error));
  const list = el('div',{class:'card'});
  if(!automod.hits.length) list.appendChild(el('div',{class:'report-empty'},[el('div',{class:'report-empty__tick'}, '✓'), el('p',{}, automod.status === 'open' ? 'Nothing flagged right now.' : 'Nothing here yet.')]));
  automod.hits.forEach(h => {
    const susp = typeof suspendedLabel === 'function' ? suspendedLabel(h.suspended_until) : '';
    const item = el('div',{class:'automod-hit' + (h.status !== 'open' ? ' is-closed' : '')});
    item.appendChild(el('div',{class:'automod-hit__top'},[
      el('span',{class:'automod-sev is-' + h.severity}, h.severity === 'serious' ? 'Serious' : 'Mild'),
      el('span',{class:'automod-hit__reason'}, h.reason || ''),
      el('span',{class:'automod-hit__meta'}, [flagWhere(h.tbl) + ' by ', el('button',{class:'user-link', onclick:()=>viewProfile(h.username)}, '@' + (h.username || 'unknown')), ' · ' + timeAgo(new Date(h.created_at).getTime())]),
      Number(h.user_hits) > 1 ? el('span',{class:'automod-repeat'}, Number(h.user_hits) + ' serious flags in 30 days') : null,
      susp ? el('span',{class:'badge report-badge--susp'}, susp) : null,
    ]));
    item.appendChild(el('div',{class:'automod-hit__text' + (h.severity === 'serious' ? ' is-hidden' : ''), title: h.severity === 'serious' ? 'Hover or tap to show' : '', onclick:(e)=>e.currentTarget.classList.remove('is-hidden')}, h.excerpt || ''));
    const acts = el('div',{class:'report-item__actions'});
    if(h.status === 'open'){
      acts.appendChild(el('button',{class:'linkbtn', onclick:()=>openFlag(h)}, 'Open'));
      if(!['profiles', 'guilds'].includes(h.tbl)) acts.appendChild(el('button',{class:'linkbtn is-danger', onclick:()=>flagAction(h, 'remove')}, 'Remove'));
      acts.appendChild(el('button',{class:'linkbtn', onclick:()=>flagWarn(h)}, 'Warn'));
      if(!susp){ acts.appendChild(el('button',{class:'linkbtn is-danger', onclick:()=>flagSuspend(h, 24)}, 'Suspend 1 day')); acts.appendChild(el('button',{class:'linkbtn is-danger', onclick:()=>flagSuspend(h, 168)}, '7 days')); }
      acts.appendChild(el('button',{class:'linkbtn', onclick:()=>flagAction(h, 'dismiss')}, 'Dismiss — it\'s fine'));
    } else acts.appendChild(el('span',{class:'report-item__closed'}, (h.status === 'removed' ? 'Removed' : 'Dismissed') + (h.reviewer ? ' by @' + h.reviewer : '')));
    item.appendChild(acts);
    list.appendChild(item);
  });
  wrap.appendChild(list);

  const terms = el('div',{class:'card'},[el('h3',{}, 'What gets flagged'), el('p',{class:'field-caption'}, 'Words are matched whole and catch look-alike spellings (n1ce → nice). Nothing is ever blocked or changed — these only decide what shows up above.')]);
  const pat = el('input',{type:'text', placeholder:'word or pattern'}), act = el('select',{},[el('option',{value:'block'}, 'Serious'), el('option',{value:'mask'}, 'Mild')]);
  terms.appendChild(el('div',{class:'automod-add'},[pat, act, el('button',{class:'btn secondary', onclick: async () => {
    const p = pat.value.trim().toLowerCase(); if(!p) return;
    const { error } = await sb.from('automod_terms').insert({ pattern: p, action: act.value, compact: act.value === 'block' && p.length >= 5, note: act.value === 'block' ? 'added by a moderator' : 'swearing' });
    if(error){ alert(friendlyDbError(error, 'Couldn\'t add that.')); return; }
    await loadAutomod(); render();
  }}, 'Add')]));
  const tl = el('div',{class:'automod-terms'});
  automod.terms.forEach(t => tl.appendChild(el('span',{class:'automod-term is-' + t.action, title: (t.action === 'block' ? 'Serious' : 'Mild') + (t.note ? ' · ' + t.note : '')},[
    el('code',{}, t.pattern), el('button',{class:'linkbtn', title:'Remove', onclick: async () => {
      if(!confirm('Stop flagging this?')) return;
      const { error } = await sb.from('automod_terms').delete().eq('pattern', t.pattern);
      if(error){ alert(friendlyDbError(error, 'Couldn\'t remove that.')); return; }
      await loadAutomod(); render();
    }}, '×')])));
  terms.appendChild(el('details',{},[el('summary',{}, 'Show the list (' + automod.terms.length + ')'), tl]));
  wrap.appendChild(terms);
  return wrap;
}

/* =====================================================================
   INSTALL AS AN APP
   ===================================================================== */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; try { render(); } catch(err){} });
window.addEventListener('appinstalled', () => { deferredInstall = null; try { toast('Majlis is installed — find it on your home screen.', 'good'); render(); } catch(e){} });
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function installApp(){
  if(deferredInstall){ deferredInstall.prompt(); const r = await deferredInstall.userChoice.catch(() => null); deferredInstall = null; render(); return r; }
  installHelp = true; render();
}
let installHelp = false;
function installCard(){
  if(isStandalone()) return el('div',{class:'card install-card is-done'},[el('h3',{}, 'Installed'), el('p',{}, 'You\'re using the Majlis app. It updates itself.')]);
  const card = el('div',{class:'card install-card'});
  card.appendChild(el('h3',{}, [icon('download', 18), ' Get the Majlis app']));
  card.appendChild(el('p',{}, 'Add Majlis to your home screen. It opens full-screen with its own icon, like any other app — no app store needed.'));
  if(deferredInstall) card.appendChild(el('button',{class:'btn', onclick: installApp}, 'Install Majlis'));
  if(isIOS() || installHelp || !deferredInstall){
    card.appendChild(el('ol',{class:'install-steps'}, isIOS() ? [
      el('li',{}, ['Open Majlis in ', el('b',{}, 'Safari'), '.']),
      el('li',{}, ['Tap the ', el('b',{}, 'Share'), ' button (the square with an arrow).']),
      el('li',{}, ['Choose ', el('b',{}, 'Add to Home Screen'), ', then ', el('b',{}, 'Add'), '.']),
    ] : [
      el('li',{}, ['Android (Chrome): tap the ', el('b',{}, '⋮ menu'), ' → ', el('b',{}, 'Install app'), ' or ', el('b',{}, 'Add to Home screen'), '.']),
      el('li',{}, ['Computer (Chrome or Edge): click the ', el('b',{}, 'install icon'), ' at the right of the address bar.']),
    ]));
  }
  return card;
}
// A small one-time prompt on phones
function installNudge(){
  if(isStandalone() || window.innerWidth > 820) return null;
  let dismissed = false; try { dismissed = localStorage.getItem('majlis-install-nudge') === '1'; } catch(e){}
  if(dismissed) return null;
  return el('div',{class:'install-nudge'},[
    el('span',{class:'install-nudge__icon'}, icon('download', 18)),
    el('span',{class:'install-nudge__text'}, 'Put Majlis on your home screen'),
    el('button',{class:'btn', onclick:()=>{ if(deferredInstall) installApp(); else navigateWithLoading('settings'); }}, deferredInstall ? 'Install' : 'How'),
    el('button',{class:'install-nudge__x', 'aria-label':'Dismiss', onclick:()=>{ try { localStorage.setItem('majlis-install-nudge', '1'); } catch(e){} render(); }}, '×'),
  ]);
}
if('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

/* =====================================================================
   THE NEW-MEMBER TOUR (about 30 seconds)
   ===================================================================== */
const TOUR_STEPS = [
  { title: 'Welcome to Majlis', text: 'A 30-second tour. Majlis is where you read, think and argue — and get better at all three.' },
  { tab: 'debate', title: 'Debate anyone', text: 'Text, audio or video. You\'re matched with someone who disagrees with you, and an AI judge reads every word and names a winner.' },
  { tab: 'majlis', title: 'The Majlis', text: 'Voice-only rooms with a new geopolitics topic every 25 minutes. Sit on a cushion to speak, or just listen.' },
  { tab: 'motion', title: 'Motion of the day', text: 'One question for everyone, every day. Pick a side, make your case, and upvote the best takes.' },
  { tab: 'guide', title: 'The 30-day guide', text: '20 minutes a day of philosophy, politics and theology. Ten hours that make you a sharper debater.' },
  { tab: 'reading', title: 'Your reading log', text: 'Log books as you read them. Finished books earn reading points — and badges.' },
  { sel: '.sidebar__account .acct, .tabbar__item[data-tab="menu"]', title: 'Streaks and badges', text: 'Do something each day to grow your streak. Badges level up as you go — your best tier replaces the last one, like on Discord.' },
  { title: 'You\'re all set', text: 'Start with the placement assessment: it maps your views and sets your starting rank.', final: true },
];
const tour = { on: false, i: 0, node: null };
function tourTarget(step){
  const sels = step.sel ? step.sel.split(',') : step.tab ? ['.sidenav__item[data-tab="' + step.tab + '"]', '.tabbar__item[data-tab="' + step.tab + '"]'] : [];
  for(const s of sels){
    const nodes = [...document.querySelectorAll(s.trim())];
    const n = nodes.find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(x).visibility !== 'hidden'; });
    if(n) return n;
  }
  return null;
}
function startTour(){
  closeTour(true);
  tour.on = true; tour.i = 0;
  tour.node = document.createElement('div'); tour.node.className = 'tour';
  document.body.appendChild(tour.node);
  tour.keys = (e) => { if(e.key === 'Escape') closeTour(); if(e.key === 'ArrowRight') tourGo(1); if(e.key === 'ArrowLeft') tourGo(-1); };
  document.addEventListener('keydown', tour.keys);
  tour.resize = () => paintTour(); window.addEventListener('resize', tour.resize);
  paintTour();
}
function tourGo(d){ tour.i = Math.max(0, Math.min(TOUR_STEPS.length - 1, tour.i + d)); paintTour(); }
function closeTour(silent){
  if(!tour.node) return;
  tour.node.remove(); tour.node = null; tour.on = false;
  document.removeEventListener('keydown', tour.keys); window.removeEventListener('resize', tour.resize);
  if(!silent && state.user && state.user.id){ try { localStorage.setItem('majlis-tour:' + state.user.id, '1'); } catch(e){} }
}
function paintTour(){
  if(!tour.node) return;
  const step = TOUR_STEPS[tour.i], target = tourTarget(step);
  tour.node.innerHTML = '';
  tour.node.classList.toggle('is-center', !target);
  const spot = document.createElement('div'); spot.className = 'tour__spot';
  const card = el('div',{class:'tour__card', role:'dialog', 'aria-label': step.title},[
    el('div',{class:'tour__step'}, (tour.i + 1) + ' / ' + TOUR_STEPS.length),
    el('div',{class:'tour__title'}, step.title),
    el('p',{class:'tour__text'}, step.text),
    el('div',{class:'tour__dots'}, TOUR_STEPS.map((s, i) => el('span',{class:'tour__dot' + (i === tour.i ? ' is-on' : '')}))),
    el('div',{class:'tour__actions'}, step.final ? [
      el('button',{class:'btn secondary', onclick:()=>closeTour()}, 'Explore first'),
      el('button',{class:'btn', onclick:()=>{ closeTour(); navigateWithLoading(state.user && state.user.placementTaken ? 'debate' : 'assessment'); }}, state.user && state.user.placementTaken ? 'Find a debate' : 'Take the assessment'),
    ] : [
      el('button',{class:'linkbtn', onclick:()=>closeTour()}, 'Skip tour'),
      tour.i ? el('button',{class:'btn secondary', onclick:()=>tourGo(-1)}, 'Back') : null,
      el('button',{class:'btn', onclick:()=>tourGo(1)}, tour.i ? 'Next' : 'Show me'),
    ]),
  ]);
  if(target){
    target.scrollIntoView({ block: 'nearest' });
    const r = target.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    tour.node.appendChild(spot);
    tour.node.appendChild(card);
    const cw = Math.min(330, innerWidth - 32);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight || 220;
    let left = r.right + 18, top = r.top + r.height / 2 - ch / 2;
    if(left + cw > innerWidth - 16){ left = Math.max(16, Math.min(innerWidth - cw - 16, r.left + r.width / 2 - cw / 2)); top = r.top - ch - 18; if(top < 16) top = r.bottom + 18; }
    card.style.left = left + 'px'; card.style.top = Math.max(16, Math.min(innerHeight - ch - 16, top)) + 'px';
  } else tour.node.appendChild(card);
}
function maybeStartTour(){
  if(tour.on || !state.user || state.user.isGuest || !state.user.id || state.user.placementTaken) return;
  let done = false; try { done = localStorage.getItem('majlis-tour:' + state.user.id) === '1'; } catch(e){}
  if(done) return;
  setTimeout(() => { if(!tour.on && state.user && !state.user.isGuest) startTour(); }, 900);
}

/* ---------- everything a signed-in person needs, loaded once after login ---------- */
async function loadExtrasForUser(){
  if(!state.user || state.user.isGuest) return;
  await Promise.all([loadStreak(true), loadGuide(), loadMotion(true)]);
  refreshMyBadges();
  if(canModerate()) refreshOpenReportCount().then(render);
  try { refreshIceServers(); } catch(e){}
  render();
  maybeStartTour();
}

// Keep the audience bar fresh while watching or streaming (in case a vote broadcast was missed).
setInterval(() => {
  try {
    if(state.tab === 'watch' && watch && watch.id) loadVotes(watch.id);
    else if(live && live.broadcasting && live.debate && state.tab === 'debate') loadVotes(live.debate);
  } catch(e){}
}, 7000);

// App shortcuts (long-press the icon): ?tab=motion / debate / guide
window.addEventListener('load', () => {
  const t = new URLSearchParams(location.search).get('tab');
  if(t && ['motion', 'debate', 'guide', 'reading', 'majlis'].includes(t)){
    const go = () => { try { if(typeof navigateWithLoading === 'function' && state && state.user){ navigateWithLoading(t); history.replaceState(null, '', location.pathname); return; } } catch(e){} setTimeout(go, 300); };
    setTimeout(go, 600);
  }
});
