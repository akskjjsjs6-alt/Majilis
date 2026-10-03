/* =====================================================================
   Majlis: Challenges and win/loss records.
   Challenges: call one person out (from their profile), or put an open challenge on the board.
   When someone accepts, the database starts a text debate between the two of them straight away.
   Records: wins, losses, last five results, and your head-to-head against whoever's profile you're on.
   All the rules (who can challenge whom, limits, privacy) live in the database functions, not here.
   ===================================================================== */
(function(){
  'use strict';

  const CH = { list: [], at: 0, loading: false, error: '' };
  const REC = {};   // user id -> { ready, loading, at, wins, losses, form, h2h }

  let nameCache = null, nameCacheAt = 0;   // the id->name map is rebuilt at most once a second, not once per row
  const idName = (id) => {
    try {
      if(!nameCache || Date.now() - nameCacheAt > 1000){ nameCache = idToUsernameMap(); nameCacheAt = Date.now(); }
      return nameCache[id] || null;
    } catch(e){ return null; }
  };
  const wrapText = (t) => (window.MajlisFilters ? MajlisFilters.wrap(t) : t);
  const randomTopic = () => (window.MajlisTopics ? MajlisTopics.at(Math.floor(Math.random() * 1e9)) : 'Is a hot dog a sandwich?');
  const isGuest = () => !state.user || state.user.isGuest || !state.user.id;

  /* ---------- win/loss records ---------- */
  function recordFor(person){
    const id = person && person.id;
    if(!id) return null;
    const old = REC[id];
    if(old && (old.loading || Date.now() - old.at < 60000)) return old.ready ? old : null;
    REC[id] = { loading: true, ready: !!(old && old.ready), at: Date.now(), wins: old ? old.wins : 0, losses: old ? old.losses : 0, form: old ? old.form : '', h2h: old ? old.h2h : null };
    const compare = !isGuest() && state.user.id !== id;
    Promise.all([
      sb.rpc('debate_record', { p_user: id }),
      compare ? sb.rpc('head_to_head', { p_other: id }) : Promise.resolve({ data: null }),
    ]).then(([a, b]) => {
      const row = (a.data && a.data[0]) || { wins: 0, losses: 0, form: '' };
      const h = b && b.data && b.data[0];
      REC[id] = { loading: false, ready: !a.error, at: Date.now(), wins: row.wins | 0, losses: row.losses | 0, form: row.form || '',
        h2h: h ? { my: h.my_wins | 0, their: h.their_wins | 0 } : null };
      if(state.tab === 'profile') render();
    }).catch(() => { REC[id].loading = false; });
    return REC[id].ready ? REC[id] : null;
  }

  // The big number on the profile: 12–5
  function recordStat(person){
    const r = recordFor(person);
    return r ? r.wins + '–' + r.losses : '…';
  }

  // The little line under the stats: win rate, last five, and you vs them.
  function recordRow(person){
    const r = recordFor(person);
    if(!r) return null;
    const total = r.wins + r.losses;
    const bits = [];
    if(!total){
      bits.push(el('span', { class: 'record-row__note' }, 'No decided debates yet.'));
    } else {
      bits.push(el('span', { class: 'record-row__note' }, Math.round(r.wins / total * 100) + '% win rate'));
      if(r.form){
        bits.push(el('span', { class: 'record-row__form', 'aria-label': 'Last results, newest first' },
          [el('span', { class: 'record-row__lbl' }, 'Last ' + r.form.length + ':')].concat(r.form.split('').map(ch => el('span', { class: 'rec-chip ' + (ch === 'W' ? 'is-w' : 'is-l') }, ch)))));
      }
    }
    if(r.h2h && (r.h2h.my + r.h2h.their) > 0){
      bits.push(el('span', { class: 'record-row__note' }, 'You ' + r.h2h.my + ' – ' + r.h2h.their + ' them'));
    }
    return el('div', { class: 'record-row' }, bits);
  }

  /* ---------- the challenges list ---------- */
  async function load(){
    if(CH.loading) return;
    CH.loading = true;
    const { data, error } = await sb.from('challenges').select('*').order('created_at', { ascending: false }).limit(200);
    CH.loading = false; CH.at = Date.now();
    CH.error = error ? 'Couldn\'t load challenges right now.' : '';
    CH.list = Array.isArray(data) ? data : [];
    // a challenge may come from someone who joined after this page loaded
    if(CH.list.some(c => !idName(c.challenger_id)) && typeof loadAllProfiles === 'function') await loadAllProfiles();
    if(state.tab === 'challenges') render();
  }

  async function post(topic, unranked, targetId){
    const { error } = await sb.rpc('create_challenge', { p_target: targetId || null, p_topic: topic, p_unranked: !!unranked });
    if(error){ alert(friendlyDbError(error, 'Couldn\'t send that challenge.')); return false; }
    await load();
    return true;
  }
  async function accept(id){
    if(isGuest()){ openAuth('signup'); return; }
    const { data, error } = await sb.rpc('accept_challenge', { p_id: id });
    if(error){ alert(friendlyDbError(error, 'Couldn\'t accept that challenge.')); await load(); return; }
    toast('Challenge accepted. Your debate is ready.');
    state.tab = 'debate';
    lastActiveDebateCheck = 0;
    await enterDebate(data);
    load();
  }
  async function decline(id){
    const { error } = await sb.rpc('decline_challenge', { p_id: id });
    if(error) alert(friendlyDbError(error, 'Couldn\'t decline that challenge.'));
    await load();
  }
  async function cancel(id){
    const { error } = await sb.rpc('cancel_challenge', { p_id: id });
    if(error) alert(friendlyDbError(error, 'Couldn\'t cancel that challenge.'));
    await load();
  }
  function openDebateTab(){
    lastActiveDebateCheck = 0;
    navigateWithLoading('debate');
    checkForActiveDebate();
  }

  /* ---------- the page ---------- */
  function row(c, actions){
    const name = idName(c.challenger_id) || 'a former member';
    const person = state.users[name];
    const when = timeAgo(Date.parse(c.created_at));
    return el('div', { class: 'card challenge' }, [
      avatarNode(person || name, 40),
      el('div', { class: 'challenge__main' }, [
        el('div', { class: 'challenge__topic' }, wrapText(c.topic)),
        el('div', { class: 'challenge__meta' }, [
          el('button', { class: 'user-link', type: 'button', onclick: () => viewProfile(name) }, '@' + name),
          ' · ' + when + (c.unranked ? ' · Unranked' : ' · Ranked'),
        ]),
      ]),
      el('div', { class: 'challenge__actions' }, actions),
    ]);
  }
  const section = (title, sub, items, emptyText) => {
    const box = el('div', { style: 'margin-top:26px;' }, [el('h3', { class: 'challenge__h' }, title)]);
    if(sub) box.appendChild(el('p', { class: 'field-caption', style: 'margin:-4px 0 12px;' }, sub));
    if(!items.length) box.appendChild(el('p', { class: 'empty-note' }, emptyText));
    else items.forEach(i => box.appendChild(i));
    return box;
  };

  function renderPage(){
    const wrap = el('div', {});
    wrap.appendChild(el('h2', { class: 'section-title' }, 'Challenges'));
    wrap.appendChild(el('p', { class: 'section-sub' }, 'Call someone out, or answer a call. When a challenge is accepted, the debate starts right away.'));
    if(Date.now() - CH.at > 15000 && !CH.loading) load();

    const now = Date.now(), me = state.user && state.user.id;
    const live = CH.list.filter(c => c.status === 'open' && Date.parse(c.expires_at) > now);

    // 1. put one out
    if(isGuest()){
      wrap.appendChild(el('div', { class: 'card' }, [
        el('h3', {}, 'Create an account to challenge people'),
        el('p', {}, 'You can read the open board below. To post a challenge or accept one, you need an account.'),
        el('button', { class: 'btn', onclick: () => openAuth('signup') }, 'Sign up'),
      ]));
    } else if(!state.user.placementTaken){
      wrap.appendChild(el('div', { class: 'card' }, [
        el('h3', {}, 'Take the placement assessment first'),
        el('p', {}, 'It sets your starting rank, then you can challenge people and accept challenges.'),
        el('button', { class: 'btn', onclick: () => navigateWithLoading('assessment') }, 'Go to Assessment'),
      ]));
    } else {
      const topicIn = draft('challenge-topic', el('input', { type: 'text', placeholder: 'What do you want to debate? e.g. Is a hot dog a sandwich?', maxlength: '120' }));
      const rankedBox = el('input', { type: 'checkbox', id: 'challenge-unranked', style: 'margin:0 8px 0 0;' });
      const err = el('div', { style: 'color:var(--wine);font-size:13px;min-height:16px;margin-top:6px;' });
      const card = el('div', { class: 'card' }, [
        el('h3', {}, 'Put out a challenge'),
        el('p', { class: 'field-caption', style: 'margin:0 0 10px;' }, 'It goes on the open board. Anyone can accept it, and the debate starts right away.'),
        el('div', { class: 'challenge__form' }, [topicIn, el('button', { class: 'btn secondary', type: 'button', onclick: () => { topicIn.value = randomTopic(); topicIn.dispatchEvent(new Event('input')); } }, 'Random topic')]),
        el('label', { for: 'challenge-unranked', style: 'display:flex;align-items:center;font-size:13px;margin:10px 0;cursor:pointer;' }, [rankedBox, 'Unranked (no points on the line)']),
        el('button', { class: 'btn', onclick: async () => {
          const t = topicIn.value.trim();
          if(t.length < 3){ err.textContent = 'Give your challenge a topic, at least a few words.'; return; }
          err.textContent = '';
          if(await post(t, rankedBox.checked, null)){ clearDrafts('challenge-topic'); topicIn.value = ''; render(); }
        } }, 'Post to the board'),
        err,
      ]);
      wrap.appendChild(card);
    }

    // 2. for you (direct)
    if(!isGuest()){
      const forMe = live.filter(c => c.target_id === me).map(c => row(c, [
        el('button', { class: 'btn', onclick: () => accept(c.id) }, 'Accept'),
        el('button', { class: 'btn secondary', onclick: () => decline(c.id) }, 'Decline'),
      ]));
      if(forMe.length) wrap.appendChild(section('Challenges for you', 'Someone picked you out. Accepting starts the debate right now.', forMe, ''));
    }

    // 3. the open board
    const board = live.filter(c => !c.target_id && c.challenger_id !== me).map(c => row(c, [
      el('button', { class: 'btn', onclick: () => accept(c.id) }, 'Accept'),
    ]));
    wrap.appendChild(section('Open board', 'Anyone can take these.', board, CH.loading && !CH.at ? 'Loading…' : 'No open challenges right now. Be the first to put one out.'));

    // 4. yours
    if(!isGuest()){
      const cutoff = now - 3 * 86400000;
      const mine = CH.list.filter(c => c.challenger_id === me && (c.status === 'open' ? Date.parse(c.expires_at) > now : (c.status === 'accepted' && Date.parse(c.created_at) > cutoff)))
        .map(c => {
          const target = c.target_id ? idName(c.target_id) : null;
          const acts = [];
          if(c.status === 'open') acts.push(el('span', { class: 'challenge__chip' }, target ? 'Waiting for @' + target : 'On the board'), el('button', { class: 'btn secondary', onclick: () => cancel(c.id) }, 'Cancel'));
          else acts.push(el('span', { class: 'challenge__chip is-done' }, 'Accepted'), el('button', { class: 'btn', onclick: openDebateTab }, 'Open debate'));
          return row(c, acts);
        });
      if(mine.length) wrap.appendChild(section('Your challenges', '', mine, ''));
    }
    if(CH.error) wrap.appendChild(el('p', { class: 'empty-note', style: 'margin-top:16px;' }, CH.error));
    return wrap;
  }

  /* ---------- challenge one person (from their profile) ---------- */
  function openModal(username){
    if(isGuest()){ openAuth('signup'); return; }
    const target = state.users[username];
    if(!target || !target.id) return;
    const old = document.getElementById('challenge-modal'); if(old) old.remove();
    const backdrop = el('div', { id: 'challenge-modal', style: 'position:fixed;inset:0;background:var(--modal-overlay);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px;' });
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if(e.target === backdrop) close(); });
    const topicIn = el('input', { type: 'text', placeholder: 'What do you want to debate?', maxlength: '120', style: 'width:100%;' });
    const unranked = el('input', { type: 'checkbox', id: 'challenge-modal-unranked', style: 'margin:0 8px 0 0;' });
    const err = el('div', { style: 'color:var(--wine);font-size:13px;min-height:16px;margin:6px 0;' });
    const send = el('button', { class: 'btn', type: 'button', onclick: async () => {
      const t = topicIn.value.trim();
      if(t.length < 3){ err.textContent = 'Give your challenge a topic, at least a few words.'; return; }
      send.disabled = true; err.textContent = '';
      const ok = await post(t, unranked.checked, target.id);
      send.disabled = false;
      if(ok){ close(); toast('Challenge sent to @' + username + '.'); }
    } }, 'Send challenge');
    backdrop.appendChild(el('div', { class: 'card modal-card', style: 'width:100%;max-width:420px;position:relative;' }, [
      el('button', { class: 'icon-btn', title: 'Close', type: 'button', style: 'position:absolute;top:14px;right:14px;width:32px;height:32px;', onclick: close }, icon('close', 16)),
      el('h3', {}, 'Challenge @' + username),
      el('p', { class: 'field-caption', style: 'margin:0 0 12px;' }, 'They get a notification and can accept or decline. If they accept, the debate starts right away.'),
      el('div', { class: 'field' }, [el('label', {}, 'Topic'), topicIn]),
      el('button', { class: 'btn secondary', type: 'button', style: 'margin-bottom:10px;', onclick: () => { topicIn.value = randomTopic(); } }, 'Random topic'),
      el('label', { for: 'challenge-modal-unranked', style: 'display:flex;align-items:center;font-size:13px;margin:6px 0;cursor:pointer;' }, [unranked, 'Unranked (no points on the line)']),
      err,
      el('div', { style: 'display:flex;gap:10px;' }, [send, el('button', { class: 'btn secondary', type: 'button', onclick: close }, 'Cancel')]),
    ]));
    document.body.appendChild(backdrop);
    topicIn.focus();
  }

  /* ---------- hooks used by the rest of the site ---------- */
  function onNotification(n){
    load();
    if(n && n.text) toast(n.text);
  }
  function openFromNotification(n){
    if(n && /accepted/i.test(n.text || '')) openDebateTab();
    else navigateWithLoading('challenges');
  }

  window.MajlisChallenges = { renderPage, load, openModal, recordStat, recordRow, onNotification, openFromNotification };
})();
