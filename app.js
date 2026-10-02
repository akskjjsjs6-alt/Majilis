/* ================= SUPABASE ================= */
const SUPABASE_URL = 'https://bsgairwtzawuzjzdnutb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZ2Fpcnd0emF3dXpqemRudXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDIxMTksImV4cCI6MjEwNDYxODExOX0.aDY44XKxWa03ACqbm5ZPKQ0C0rtkMYoL0CJCSkbTdls';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Calls the secure-actions edge function (anything that awards points runs there, not in the browser).
// Returns { data } on success or { error: '<message for the user>' }.
// Run server functions in Seoul, next to the database, so their database calls are instant
// (by default they run near the visitor and every database call crosses the world).
const FN_REGION = 'ap-northeast-2';

// Server functions "fall asleep" when idle and take 1–3 s to wake. Nudge them awake just before
// they're likely to be needed (opening Reading, Debate or the Assessment), at most every few minutes.
let lastWarm = 0;
function warmFunctions(){
  if(Date.now() - lastWarm < 4 * 60 * 1000) return;
  lastWarm = Date.now();
  sb.functions.invoke('secure-actions', { body: { action: 'ping' }, region: FN_REGION }).catch(() => {});
}

async function callSecure(action, payload){
  try {
    const { data, error } = await sb.functions.invoke('secure-actions', { body: { action, ...payload }, region: FN_REGION });
    if(error){
      let message = 'Something went wrong — please try again.';
      let needLink = false;
      try { const body = await error.context.json(); if(body && body.error) message = body.error; needLink = !!(body && body.needLink); } catch(e) {}
      return { error: message, needLink };
    }
    if(data && data.error) return { error: data.error };
    return { data };
  } catch(e){
    console.warn('secure-actions call failed', e);
    return { error: 'Couldn\'t reach the server — check your connection and try again.' };
  }
}

// Copy one row of profiles_public onto a local user object.
// Private profiles come back with their stats set to null by the database (see the migration),
// so `hiddenStats` tells the UI to show the "this profile is private" card.
function applyProfileRow(p){
  if(!state.users[p.username]) state.users[p.username] = makeNewUserProfile(p.username, false);
  const u = state.users[p.username];
  u.id = p.id;
  u.name = p.name || p.username;
  u.bio = p.bio || '';
  u.avatar = p.avatar_url || null;
  u.isGuest = false;
  u.role = p.role || 'member';
  u.settings = {
    profileVisibility: p.profile_visibility || 'public',
    showOnLeaderboard: p.show_on_leaderboard !== false,
    allowFollowers: p.allow_followers !== false,
  };
  u.hiddenStats = p.reading_elo === null && p.debate_points === null && p.placement_taken === null;
  u.readingElo = p.reading_elo || 0;
  u.readingPoints = p.reading_points || 0;
  u.pagesRead = p.pages_read || 0;
  u.booksFinished = p.books_finished || 0;
  u.debatePoints = p.debate_points || 0;
  u.insightPoints = p.insight_points || 0;
  u.placementTaken = !!p.placement_taken;
  u.debateRank = u.placementTaken ? rankFromPoints(u.debatePoints) : null;
  u.fallacyStats = Object.assign({ adHominem:0, strawman:0, goalpostShift:0, falseEquivalency:0, total:0 }, p.fallacy_stats || {});
  if(p.placement_taken){
    u.compass = {
      economic: { x: p.compass_economic_x ?? 50, y: p.compass_economic_y ?? 50 },
      political: { x: p.compass_political_x ?? 50, y: p.compass_political_y ?? 50 },
      social: { x: p.compass_social_x ?? 50, y: p.compass_social_y ?? 50 },
    };
    u.ideologies = {
      economic: { label: p.ideology_economic_label || deriveQuadrantIdeology('economic', u.compass.economic), reasoning: '' },
      political: { label: p.ideology_political_label || deriveQuadrantIdeology('political', u.compass.political), reasoning: '' },
      social: { label: p.ideology_social_label || deriveQuadrantIdeology('social', u.compass.social), reasoning: '' },
    };
    u.archetype = p.archetype || 'Not yet determined';
  } else {
    u.compass = null; u.ideologies = null; u.archetype = null;
  }
  u.religion = p.religion || null;
  u.denomination = p.denomination || null;
  // AI rivals: retired ones leave the leaderboard and search.
  u.isAi = !!p.is_ai;
  u.aiRetired = !!p.ai_retired;
  if(u.aiRetired) u.settings.showOnLeaderboard = false;
  return u;
}

// Fetch every real (non-guest) account's public profile info so members,
// wiki authors, etc. can be shown even if you've never logged in as them.
async function loadAllProfiles(){
  try {
    const { data, error } = await sb.from('profiles_public').select('*');
    if(error || !data){ if(error) console.warn('loadAllProfiles failed', error); return; }
    data.forEach(applyProfileRow);
    if(state.user && !state.user.isGuest && state.users[state.currentUser]) state.user = state.users[state.currentUser];
  } catch(e){ console.warn('loadAllProfiles failed', e); }
}

// Refresh just the signed-in user's row (after earning points, changing settings, etc.)
async function refreshMyProfile(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  const { data, error } = await sb.from('profiles_public').select('*').eq('id', state.user.id).maybeSingle();
  if(error || !data){ if(error) console.warn('refreshMyProfile failed', error); return; }
  const email = state.user.email;
  state.user = applyProfileRow(data);
  state.user.email = email;
}

// Turn an OAuth display name / email into a username the database will accept
// (starts with a letter, 3–20 letters/numbers/underscores).
function usernameBaseFrom(raw){
  let base = String(raw || '').replace(/[^a-zA-Z0-9_]/g,'');
  if(!/^[a-zA-Z]/.test(base)) base = 'u' + base;
  base = base.slice(0, 16);
  if(base.length < 3) base = (base + 'user').slice(0, 16);
  return base;
}

// Load (or attach) the profile belonging to a Supabase auth session.
async function loadCurrentUserProfile(authUser){
  try {
    let { data: profile, error } = await sb.from('profiles_public').select('*').eq('id', authUser.id).maybeSingle();
    if(error){ console.warn('loadCurrentUserProfile failed', error); return; }
    if(!profile){
      // First-time OAuth login (Google/Discord) — no profile row yet, so create one automatically.
      const meta = authUser.user_metadata || {};
      const base = usernameBaseFrom(meta.user_name || meta.full_name || meta.name || (authUser.email ? authUser.email.split('@')[0] : 'user'));
      let candidate = base, attempt = 0;
      while(attempt < 50){
        const { data: existing } = await sb.from('profiles_public').select('username').ilike('username', candidate).maybeSingle();
        if(!existing) break;
        attempt++; candidate = base + attempt;
      }
      const { error: insErr } = await sb.from('profiles').insert({ id: authUser.id, username: candidate, name: candidate });
      if(insErr){ console.warn('auto-provision profile failed', insErr); return; }
      ({ data: profile } = await sb.from('profiles_public').select('*').eq('id', authUser.id).maybeSingle());
      if(!profile) return;
    }
    const u = applyProfileRow(profile);
    u.email = authUser.email;
    state.currentUser = profile.username;
    state.user = u;
  } catch(e){ console.warn('loadCurrentUserProfile failed', e); }
}

// Pull every wiki article from Supabase (shared by everyone) into state.wiki.
async function loadWikiFromSupabase(){
  try {
    const { data, error } = await sb.from('wiki_articles').select('*').order('created_at', { ascending: false });
    if(error || !data) return;
    const idToUsername = {};
    Object.values(state.users).forEach(u => { if(u.id) idToUsername[u.id] = u.username; });
    state.wiki = data.map(a => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      body: a.body,
      author: idToUsername[a.author_id] || 'Unknown',
      authorId: a.author_id,
    }));
  } catch(e){ console.warn('loadWikiFromSupabase failed', e); }
}

// Pull follows/blocks/notifications/DMs from Supabase into local state so the
// existing render code (which reads state.user.following, state.dms, etc.) keeps working unchanged.
let contentChannel = null;

// Forum and wiki are public, so this subscription runs for everyone (including guests),
// not just logged-in users — new posts/articles/replies show up live for anyone browsing.
// Applies the incoming row directly instead of re-fetching, to minimize lag.
function subscribeToContent(){
  if(contentChannel) return;
  contentChannel = sb.channel('public-content')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts' }, (payload) => {
      const idToUsername = idToUsernameMap();
      const p = payload.new;
      if(state.forum.some(x=>x.id===p.id)) return;
      state.forum.unshift({
        id: p.id, title: p.title, author: idToUsername[p.author_id] || 'Unknown', authorId: p.author_id,
        category: p.category, createdAt: new Date(p.created_at).getTime(), views: p.views||0, body: p.body, replies: [],
      });
      if(!idToUsername[p.author_id]) ensureAuthor(p.author_id);
      render();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'forum_posts' }, (payload) => {
      state.forum = state.forum.filter(x=>x.id !== payload.old.id);
      if(state.forumOpenThread === payload.old.id) state.forumOpenThread = null;
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_replies' }, (payload) => {
      const idToUsername = idToUsernameMap();
      const r = payload.new;
      const post = state.forum.find(x=>x.id===r.post_id);
      if(!post || post.replies.some(x=>x.id===r.id)) return;
      post.replies.push({ id: r.id, author: idToUsername[r.author_id] || 'Unknown', authorId: r.author_id, body: r.body, createdAt: new Date(r.created_at).getTime() });
      if(!idToUsername[r.author_id]) ensureAuthor(r.author_id);
      render();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'forum_replies' }, (payload) => {
      state.forum.forEach(post => { post.replies = post.replies.filter(x=>x.id !== payload.old.id); });
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wiki_articles' }, (payload) => {
      const idToUsername = idToUsernameMap();
      const a = payload.new;
      if(state.wiki.some(x=>x.id===a.id)) return;
      state.wiki.unshift({ id: a.id, title: a.title, summary: a.summary, body: a.body, author: idToUsername[a.author_id] || 'Unknown', authorId: a.author_id });
      render();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'wiki_articles' }, (payload) => {
      state.wiki = state.wiki.filter(x=>x.id !== payload.old.id);
      render();
    })
    .subscribe();
}

let inboxChannel = null;

// Live-updates DMs and notifications the moment they arrive, no refresh needed.
// Applies the incoming row directly instead of re-fetching everything, to minimize lag.
function subscribeToInbox(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  if(inboxChannel){ sb.removeChannel(inboxChannel); inboxChannel = null; }
  inboxChannel = sb.channel('inbox-'+state.user.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'to_id=eq.'+state.user.id }, async (payload) => {
      const m = payload.new;
      if(!idToUsernameMap()[m.from_id]) await loadAllProfiles();   // sender joined after this page loaded
      const idToUsername = idToUsernameMap();
      const fromName = idToUsername[m.from_id], toName = idToUsername[m.to_id];
      if(!fromName || !toName) return;
      const key = dmKey(fromName, toName);
      state.dms[key] = state.dms[key] || { messages: [] };
      if(state.dms[key].messages.some(x=>x.id===m.id)) return;
      state.dms[key].messages.push({ id: m.id, from: fromName, text: m.text, ts: new Date(m.created_at).getTime(), read: m.read });
      render();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'from_id=eq.'+state.user.id }, (payload) => {
      const m = payload.new;
      Object.values(state.dms).forEach(conv => {
        const msg = conv.messages.find(x=>x.id===m.id);
        if(msg) msg.read = m.read;
      });
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.'+state.user.id }, async (payload) => {
      const n = payload.new;
      if(n.from_id && !idToUsernameMap()[n.from_id]) await loadAllProfiles();
      const idToUsername = idToUsernameMap();
      state.user.notifications = state.user.notifications || [];
      if(state.user.notifications.some(x=>x.id===n.id)) return;
      state.user.notifications.unshift({ id: n.id, read: n.read, ts: new Date(n.created_at).getTime(), type: n.type, text: n.text, from: idToUsername[n.from_id] || null });
      render();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'follows', filter: 'following_id=eq.'+state.user.id }, async () => {
      await loadSocialData();
      render();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'follows' }, async () => {
      await loadSocialData();
      render();
    })
    .subscribe();
}

function stopInboxSubscription(){
  if(inboxChannel){ sb.removeChannel(inboxChannel); inboxChannel = null; }
}

async function loadSocialData(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  const me = state.user.id;
  // All four requests go out at the same time (was one after another).
  const [{ data: follows }, { data: blocks }, { data: notifs }, { data: msgs }] = await Promise.all([
    sb.from('follows').select('follower_id, following_id'),
    sb.from('blocks').select('blocker_id, blocked_id').eq('blocker_id', me),
    sb.from('notifications').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(200),
    sb.from('messages').select('*').or('from_id.eq.'+me+',to_id.eq.'+me).order('created_at', { ascending: true }),
  ]);
  const idToUsername = idToUsernameMap();

  Object.values(state.users).forEach(u => { u.following = []; u.followers = []; });
  (follows||[]).forEach(f=>{
    const followerName = idToUsername[f.follower_id], followingName = idToUsername[f.following_id];
    if(followerName && state.users[followerName]) state.users[followerName].following.push(followingName);
    if(followingName && state.users[followingName]) state.users[followingName].followers.push(followerName);
  });

  state.user.blocked = (blocks||[]).map(b => idToUsername[b.blocked_id]).filter(Boolean);

  state.user.notifications = (notifs||[]).map(n => ({
    id: n.id, read: n.read, ts: new Date(n.created_at).getTime(),
    type: n.type, text: n.text, from: idToUsername[n.from_id] || null,
  }));

  state.dms = {};
  (msgs||[]).forEach(m=>{
    const fromName = idToUsername[m.from_id], toName = idToUsername[m.to_id];
    if(!fromName || !toName) return;
    const key = dmKey(fromName, toName);
    state.dms[key] = state.dms[key] || { messages: [] };
    state.dms[key].messages.push({ id: m.id, from: fromName, text: m.text, ts: new Date(m.created_at).getTime(), read: m.read });
  });
}

// Pull every forum thread + its replies from Supabase (shared by everyone).
async function loadForumFromSupabase(){
  try {
    const idToUsername = {};
    Object.values(state.users).forEach(u => { if(u.id) idToUsername[u.id] = u.username; });
    const [{ data: posts, error }, { data: replies }] = await Promise.all([
      sb.from('forum_posts').select('*').order('created_at', { ascending: false }),
      sb.from('forum_replies').select('*').order('created_at', { ascending: true }),
    ]);
    if(error || !posts) return;
    state.forum = posts.map(p => ({
      id: p.id,
      title: p.title,
      author: idToUsername[p.author_id] || 'Unknown',
      authorId: p.author_id,
      category: p.category,
      createdAt: new Date(p.created_at).getTime(),
      views: p.views || 0,
      body: p.body,
      replies: (replies||[]).filter(r => r.post_id === p.id).map(r => ({
        id: r.id,
        author: idToUsername[r.author_id] || 'Unknown',
        authorId: r.author_id,
        body: r.body,
        createdAt: new Date(r.created_at).getTime(),
      })),
    }));
  } catch(e){ console.warn('loadForumFromSupabase failed', e); }
}

// Pull the current user's logged books from Supabase.
async function loadMyBooks(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  try {
    const { data, error } = await sb.from('books').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false });
    if(error || !data) return;
    state.user.books = data.map(b => ({
      id: b.id != null ? String(b.id) : null,
      title: b.title, author: b.author, pages: b.pages, pagesRead: b.pages_read,
      status: b.status, leaning: b.leaning, eloWorth: b.elo_worth, points: b.points,
      verified: !!b.work_key, note: b.difficulty_note || '',
    }));
  } catch(e){ console.warn('loadMyBooks failed', e); }
}

function canModerate(){
  return !!(state.user && (state.user.role === 'admin' || state.user.role === 'mod'));
}

async function deleteWikiArticle(id){
  if(!confirm('Delete this article? This can\'t be undone.')) return;
  const { error } = await sb.from('wiki_articles').delete().eq('id', id);
  if(error){ alert('Could not delete that article.'); return; }
  state.wiki = state.wiki.filter(w => w.id !== id);
  render();
}

async function deleteForumPost(id){
  if(!confirm('Delete this thread and all its replies? This can\'t be undone.')) return;
  const { error } = await sb.from('forum_posts').delete().eq('id', id);
  if(error){ alert('Could not delete that thread.'); return; }
  state.forumOpenThread = null;
  state.forum = state.forum.filter(p => p.id !== id);
  render();
}

async function deleteForumReply(id){
  if(!confirm('Delete this reply?')) return;
  const { error } = await sb.from('forum_replies').delete().eq('id', id);
  if(error){ alert('Could not delete that reply.'); return; }
  state.forum.forEach(post => { post.replies = post.replies.filter(r => r.id !== id); });
  render();
}

/* ================= STATE ================= */
function makeNewUserProfile(username, isGuest){
  return {
    username,
    isGuest: !!isGuest,
    name: username,
    readingElo: 0,
    readingPoints: 0,
    debatePoints: 0,
    insightPoints: 0,
    compass: null,
    archetype: null,
    ideologies: null,
    fallacyStats: { adHominem:0, strawman:0, goalpostShift:0, falseEquivalency:0, total:0 },
    pagesRead: 0,
    booksFinished: 0,
    debateRank: null,
    placementTaken: false,
    books: [],
    debateHistory: [],
    activeDebateId: null,
    avatar: null,
    bio: '',
    role: 'member',
    following: [],
    followers: [],
    blocked: [],
    notifications: [],
    settings: {
      profileVisibility: 'public',   // 'public' | 'private'
      showOnLeaderboard: true,
      allowFollowers: true,
    },
  };
}

const state = {
  tab: 'home',
  authMode: 'login',
  showAuth: false,
  exploreOpen: false,
  mobileNavOpen: false,
  theme: (()=>{ try { return localStorage.getItem('majlis-theme') || 'dark'; } catch(e){ return 'dark'; } })(),
  cookieConsent: localStorage.getItem('cookieConsent') === 'true',
  searchQuery: '',
  searchResults: null,
  loading: false,
  showPassword: false,
  currentUser: null,
  users: {},
  user: null,
  viewingProfile: null,
  quiz: {
    active: false,
    section: 'philosophy',
    index: 0,
    answers: [],
  },
  forumPage: 1,
  forumSort: 'new',
  forumOpenThread: null,
  debateQueue: { Text: [], Audio: [], Video: [] },
  debates: {},
  forum: [],
  wiki: [],
  dms: {},          // conversationKey -> { messages: [{from,text,ts}] }
  reports: [],       // only loaded for moderators
  reportsFilter: 'open', reportsOpenCount: 0, reportsError: '',
  memberSearch: '',
  activeDM: null,    // username of currently open conversation
  drafts: {},        // unsent text in forms, keyed by data-key — survives re-renders
  readingNotice: null, // result of the last book you logged
  bookNeedsLink: null, // { title } when the catalogue didn't know the book and a link is needed
};

// Initialize Theme
document.documentElement.setAttribute('data-theme', state.theme);

/* ================= PERSISTENCE =================
   Everything that matters now lives in Supabase. The only things kept in the
   browser are the theme and cookie-banner choice. Older versions of the app
   stored a big copy of every user in localStorage — clean that up. */
try { localStorage.removeItem('majlis_state_v1'); } catch(e) {}

const THEMES = ['dark', 'light', 'mint', 'glass', 'esports', 'retro'];
function setTheme(name) {
  state.theme = THEMES.includes(name) ? name : 'dark';
  try { localStorage.setItem('majlis-theme', state.theme); } catch(e) {}
  document.documentElement.setAttribute('data-theme', state.theme);
  render();
}
// The quick sun/moon button flips between dark and light (Retro is picked in Settings).
function toggleTheme() { setTheme(state.theme === 'dark' ? 'light' : 'dark'); }
const THEME_LABELS = [['dark','Neon'],['light','Light'],['mint','Mint'],['glass','Glass'],['esports','Esports'],['retro','Retro']];

// The glowing M in the home hero, and the faint giant M behind the page (Update 15).
const M_PATH = 'M 55,140 L 55,60 L 100,105 L 145,60 L 145,140';
function neonM(cls){
  return el('div',{class:cls, 'aria-hidden':'true', html:
    `<svg viewBox="40 45 120 110" fill="none"><path d="${M_PATH}" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>`});
}

function acceptCookies() {
  state.cookieConsent = true;
  localStorage.setItem('cookieConsent', 'true');
  render();
}

function startGuestSession(){
  const username = 'Guest'+Math.floor(1000+Math.random()*9000);
  state.users[username] = makeNewUserProfile(username, true);
  state.currentUser = username;
  state.user = state.users[username];
  state.showAuth = false;
}

async function logout(){
  await sb.auth.signOut();
  stopInboxSubscription();
  stopDebatePolling();
  if(debateChannel){ sb.removeChannel(debateChannel); debateChannel = null; }
  teardownVideoCall();
  // Forget the signed-in user's private data (DMs, notifications, books) before showing the guest view.
  state.dms = {};
  state.debates = {};
  state.reports = [];
  state.drafts = {};
  state.activeDM = null;
  state.viewingProfile = null;
  state.tab = 'home';
  startGuestSession();
  await loadAllProfiles();
  render();
}

/* ================= FOLLOW / FRIENDS / SETTINGS ================= */
function isFollowing(username){
  return !!(state.user.following || []).includes(username);
}

function areFriends(usernameA, usernameB){
  const a = state.users[usernameA], b = state.users[usernameB];
  if(!a || !b) return false;
  return (a.following||[]).includes(usernameB) && (b.following||[]).includes(usernameA);
}

async function toggleFollow(targetUsername){
  if(state.user.isGuest){ alert('Create an account to follow people.'); return; }
  if(targetUsername === state.currentUser) return;
  const target = state.users[targetUsername];
  if(!target || !target.id){ alert('That account isn\'t available yet.'); return; }
  if(isBlocked(targetUsername)){
    alert('You can\'t follow this user.');
    return;
  }
  const me = state.currentUser;
  const setFollowing = (on) => {
    state.user.following = (state.user.following||[]).filter(u=>u!==targetUsername);
    target.followers = (target.followers||[]).filter(u=>u!==me);
    if(on){ state.user.following.push(targetUsername); target.followers.push(me); }
  };
  const wasFollowing = isFollowing(targetUsername);
  // Show the change instantly; undo it if the database says no.
  setFollowing(!wasFollowing);
  render();
  const { error } = wasFollowing
    ? await sb.from('follows').delete().eq('follower_id', state.user.id).eq('following_id', target.id)
    : await sb.from('follows').insert({ follower_id: state.user.id, following_id: target.id });
  if(error){
    setFollowing(wasFollowing);
    render();
    alert(friendlyDbError(error, 'That didn\'t go through — please try again.'));
  }
}

// Messages raised by our database triggers are written for humans — show them.
// Anything else (constraint names, SQL errors) gets a generic fallback.
function friendlyDbError(error, fallback){
  const msg = error && error.message ? String(error.message) : '';
  if(error && error.code === 'P0001' && msg) return msg;
  // Show the technical reason too, so problems can be reported and fixed.
  return msg ? fallback + ' (' + (error.code ? error.code + ': ' : '') + msg.slice(0, 160) + ')' : fallback;
}

/* ================= NOTIFICATIONS ================= */
// Notifications are created by database triggers when someone follows or messages you.
function unreadNotifCount(){
  return (state.user.notifications || []).filter(n=>!n.read).length;
}

async function markAllNotifsRead(){
  if(state.user.isGuest || !state.user.id) return;
  const unread = (state.user.notifications||[]).filter(n => !n.read);
  unread.forEach(n=>{ n.read = true; });
  render();
  const { error } = await sb.from('notifications').update({ read: true }).eq('user_id', state.user.id).eq('read', false);
  if(error){ unread.forEach(n=>{ n.read = false; }); render(); alert('Couldn\'t mark notifications as read — please try again.'); }
}

async function markNotifRead(n){
  if(n.read) return;
  n.read = true;
  if(!state.user.isGuest && state.user.id && n.id){
    const { error } = await sb.from('notifications').update({ read: true }).eq('id', n.id);
    if(error) console.warn('Could not mark notification read', error);
  }
}

/* ================= BLOCK / REPORT ================= */
function isBlocked(username){
  return !!(state.user.blocked || []).includes(username);
}

async function toggleBlock(targetUsername, skipConfirm){
  if(state.user.isGuest){ alert('Create an account to block people.'); return; }
  if(targetUsername === state.currentUser) return;
  const target = state.users[targetUsername];
  if(!target || !target.id){ alert('That account isn\'t available yet.'); return; }
  if(isBlocked(targetUsername)){
    const { error } = await sb.from('blocks').delete().eq('blocker_id', state.user.id).eq('blocked_id', target.id);
    if(error){ alert('Couldn\'t unblock — please try again.'); return; }
    state.user.blocked = (state.user.blocked||[]).filter(u=>u!==targetUsername);
  } else {
    if(!skipConfirm && !confirm('Block '+target.name+'? They won\'t be able to follow or message you, and you\'ll stop following each other.')) return;
    // The database removes the follows in both directions when a block is created.
    const { error } = await sb.from('blocks').insert({ blocker_id: state.user.id, blocked_id: target.id });
    if(error){ alert(friendlyDbError(error, 'Couldn\'t block this user — please try again.')); return; }
    state.user.blocked = state.user.blocked || [];
    if(!state.user.blocked.includes(targetUsername)) state.user.blocked.push(targetUsername);
    state.user.following = (state.user.following||[]).filter(u=>u!==targetUsername);
    state.user.followers = (state.user.followers||[]).filter(u=>u!==targetUsername);
    target.followers = (target.followers||[]).filter(u=>u!==state.currentUser);
    target.following = (target.following||[]).filter(u=>u!==state.currentUser);
  }
  render();
}

/* ---------- Reporting ----------
   Anyone signed in can report a person from where it happened: their profile, a debate, a forum thread
   or reply, your messages, the Majlis, a live stream or a wiki article. The database attaches the actual
   words as evidence (so reports can't be faked), stops duplicates, and limits people to 15 reports a day. */
const REPORT_CATEGORIES = [
  ['harassment', 'Harassment or bullying'], ['hate', 'Hate or slurs'], ['threats', 'Threats or violence'],
  ['sexual', 'Sexual or inappropriate'], ['spam', 'Spam or scams'], ['cheating', 'Cheating or alt accounts'],
  ['impersonation', 'Pretending to be someone'], ['selfharm', 'Worried about their safety'], ['other', 'Something else'],
];
const REPORT_WHERE = { profile: 'Their profile', debate: 'A debate', forum_post: 'A forum thread', forum_reply: 'A forum reply',
  message: 'Your messages', majlis: 'The Majlis', stream: 'A live stream', wiki: 'A wiki article' };

// Old callers: reportUser(name) still works and reports the profile.
function reportUser(targetUsername, ctx){ openReport(targetUsername, ctx); }

function openReport(targetUsername, ctx = {}){
  if(!state.user || state.user.isGuest){ alert('Create an account to report people.'); return; }
  const target = state.users[targetUsername];
  if(!target || !target.id || targetUsername === state.currentUser) return;
  closeReport();
  const type = ctx.type || 'profile';
  const f = { category: null, details: '', block: false, sending: false };
  const back = el('div',{class:'report-modal', id:'report-modal', onclick:(e)=>{ if(e.target === back) closeReport(); }});
  const box = el('div',{class:'report-box', role:'dialog', 'aria-modal':'true', 'aria-label':'Report ' + target.name});
  back.appendChild(box);

  const paint = () => {
    box.innerHTML = '';
    box.appendChild(el('div',{class:'report-box__head'},[
      avatarNode(targetUsername, 40),
      el('div',{},[ el('div',{class:'report-box__title'}, 'Report ' + target.name), el('div',{class:'report-box__sub'}, '@' + targetUsername + ' · reports are private — they won\'t know it was you') ]),
      el('button',{class:'report-box__x', 'aria-label':'Close', onclick: closeReport}, '×'),
    ]));
    box.appendChild(el('div',{class:'report-box__label'}, 'What\'s going on?'));
    box.appendChild(el('div',{class:'report-cats'}, REPORT_CATEGORIES.map(([k, label]) =>
      el('button',{class:'report-cat' + (f.category === k ? ' is-on' : ''), type:'button', onclick:()=>{ f.category = k; paint(); }}, label))));
    if(f.category === 'selfharm'){
      box.appendChild(el('p',{class:'report-box__care'}, 'Thank you for looking out for them. Moderators will check in. If someone is in immediate danger, contact your local emergency number straight away.'));
    }
    const details = el('textarea',{class:'report-box__details', maxlength:'1000', placeholder: f.category === 'other' ? 'Tell moderators what happened (needed for "Something else")' : 'Anything else moderators should know? (optional)'});
    details.value = f.details;
    details.addEventListener('input', () => { f.details = details.value; });
    box.appendChild(details);
    box.appendChild(el('div',{class:'report-box__evidence'},[
      el('div',{class:'report-box__label'}, 'We\'ll include'),
      el('div',{class:'report-box__where'}, (REPORT_WHERE[type] || 'Their profile') + (type === 'message' ? ' — their latest messages to you' : type === 'debate' ? ' — what they said in it' : '')),
      ctx.preview ? el('div',{class:'report-box__quote'}, String(ctx.preview).slice(0, 220)) : null,
    ]));
    if(!isBlocked(targetUsername)){
      const cb = el('input',{type:'checkbox'}); cb.checked = f.block; cb.addEventListener('change', () => { f.block = cb.checked; });
      box.appendChild(el('label',{class:'report-box__block'},[cb, ' Also block ' + target.name]));
    }
    if(f.error) box.appendChild(el('p',{class:'field-caption warn'}, f.error));
    const sendBtn = el('button',{class:'btn wine', type:'button', onclick: send}, f.sending ? 'Sending…' : 'Send report');
    sendBtn.disabled = !f.category || f.sending;
    box.appendChild(el('div',{class:'report-box__actions'},[ el('button',{class:'btn secondary', type:'button', onclick: closeReport}, 'Cancel'), sendBtn ]));
    setTimeout(() => { const d = box.querySelector('textarea'); if(d && document.activeElement === document.body) d.focus({ preventScroll: true }); }, 0);
  };
  const send = async () => {
    if(!f.category || f.sending) return;
    if(f.category === 'other' && !f.details.trim()){ f.error = 'Please say a little about what happened.'; paint(); return; }
    f.sending = true; f.error = ''; paint();
    const row = { target_id: target.id, reason: f.details.trim().slice(0, 1000), category: f.category, context_type: type,
      context_id: ctx.id != null ? String(ctx.id) : null, snippet: ctx.preview ? String(ctx.preview).slice(0, 300) : null };
    const { error } = await sb.from('reports').insert(row);
    f.sending = false;
    if(error){ f.error = friendlyDbError(error, 'Your report couldn\'t be sent — please try again.'); paint(); return; }
    if(f.block && !isBlocked(targetUsername)) await toggleBlock(targetUsername, true);
    box.innerHTML = '';
    box.appendChild(el('div',{class:'report-box__done'},[
      el('div',{class:'report-box__tick'}, '✓'),
      el('div',{class:'report-box__title'}, 'Thanks — your report was sent'),
      el('p',{}, 'A moderator will review it. You\'ll get a notification when they have.' + (f.block ? ' You\'ve also blocked ' + target.name + '.' : '')),
      el('button',{class:'btn', type:'button', onclick: closeReport}, 'Done'),
    ]));
  };
  back._keys = (e) => { if(e.key === 'Escape') closeReport(); };
  document.addEventListener('keydown', back._keys);
  document.body.appendChild(back);
  paint();
}
function closeReport(){
  const m = document.getElementById('report-modal');
  if(m){ document.removeEventListener('keydown', m._keys); m.remove(); }
}

/* ---------- Moderation (moderators and admins only; the database checks this too) ---------- */
async function loadReports(){
  if(!canModerate()) { state.reports = []; return; }
  const filter = state.reportsFilter === 'automod' ? 'open' : (state.reportsFilter || 'open');
  const { data, error } = await sb.rpc('mod_list_reports', { p_status: filter });
  if(error){ console.warn('loadReports failed', error); state.reportsError = friendlyDbError(error, 'Reports couldn\'t be loaded.'); return; }
  state.reportsError = '';
  state.reports = (data || []).map(r => ({
    id: r.id, status: r.status, reason: r.reason || '', ts: new Date(r.created_at).getTime(), category: r.category,
    ctxType: r.context_type, ctxId: r.context_id, snippet: r.snippet || '', action: r.action, note: r.mod_note, resolver: r.resolver,
    resolvedTs: r.resolved_at ? new Date(r.resolved_at).getTime() : null,
    by: r.reporter || 'Unknown', target: r.target || 'Unknown', targetId: r.target_id, targetName: r.target_name || r.target,
    targetRole: r.target_role, targetIsAi: !!r.target_is_ai, suspendedUntil: r.target_suspended_until, suspendReason: r.target_suspend_reason,
    targetOpen: Number(r.target_open) || 0, targetTotal: Number(r.target_total) || 0,
  }));
  if(filter === 'open') state.reportsOpenCount = state.reports.length;
}
async function refreshOpenReportCount(){
  if(!canModerate()) return;
  const [{ data, error }, f] = await Promise.all([sb.rpc('mod_list_reports', { p_status: 'open' }), sb.rpc('mod_flag_count')]);
  if(!error) state.reportsOpenCount = (data || []).length;
  if(!f.error && typeof f.data === 'number') state.flagsOpen = f.data;
}
async function modReview(ids, status, action, note){
  if(!ids.length) return;
  const { error } = await sb.rpc('mod_review_reports', { p_ids: ids, p_status: status, p_action: action || 'none', p_note: note || null });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t update those reports.')); return; }
  await loadReports(); render();
}
function suspendedLabel(until){
  if(!until) return '';
  const d = new Date(until);
  if(String(until).startsWith('infinity') || isNaN(d.getTime()) || d.getFullYear() > 9000) return 'Suspended permanently';
  if(d.getTime() <= Date.now()) return '';
  return 'Suspended until ' + d.toLocaleString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
async function modSuspend(g, hours){
  const label = hours === 0 ? 'Lift the suspension on ' + g.targetName + '?' : hours < 0 ? 'Suspend ' + g.targetName + ' permanently?' : 'Suspend ' + g.targetName + ' for ' + (hours % 24 === 0 ? (hours / 24) + ' day' + (hours === 24 ? '' : 's') : hours + ' hours') + '?';
  let reason = '';
  if(hours !== 0){
    const r = prompt(label + '\n\nReason (they will see this):', g.reports[0] ? (REPORT_CATEGORIES.find(c => c[0] === g.reports[0].category) || ['', ''])[1] : '');
    if(r === null) return;
    reason = r.trim();
  } else if(!confirm(label)) return;
  const { error } = await sb.rpc('mod_suspend', { p_user: g.targetId, p_hours: hours, p_reason: reason || null });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t change that suspension.')); return; }
  const open = g.reports.filter(r => r.status === 'open').map(r => r.id);
  if(hours !== 0 && open.length) await modReview(open, 'resolved', 'suspended', reason);
  else { await loadReports(); render(); }
}
async function modWarn(g){
  const text = prompt('Warning to send ' + g.targetName + ' (they\'ll get it as a notification):', 'Please keep it civil — attack the argument, not the person.');
  if(text === null) return;
  const { error } = await sb.rpc('mod_warn', { p_user: g.targetId, p_text: text.trim() });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t send that warning.')); return; }
  const open = g.reports.filter(r => r.status === 'open').map(r => r.id);
  if(open.length) await modReview(open, 'resolved', 'warned', text.trim());
  else alert('Warning sent.');
}
async function modRemoveContent(r){
  if(!confirm('Remove this ' + (REPORT_WHERE[r.ctxType] || 'content').toLowerCase().replace(/^(a |your |the )/, '') + ' for everyone? This can\'t be undone.')) return;
  const { error } = await sb.rpc('mod_remove_content', { p_type: r.ctxType, p_id: r.ctxId });
  if(error){ alert(friendlyDbError(error, 'Couldn\'t remove that.')); return; }
  if(r.ctxType === 'forum_post') state.forum = state.forum.filter(p => String(p.id) !== String(r.ctxId));
  if(r.ctxType === 'forum_reply') state.forum.forEach(p => { p.replies = p.replies.filter(x => String(x.id) !== String(r.ctxId)); });
  if(r.ctxType === 'wiki') state.wiki = state.wiki.filter(w => String(w.id) !== String(r.ctxId));
  await modReview([r.id], 'resolved', 'content_removed');
}
function openReportContext(r){
  if(r.ctxType === 'forum_post' || r.ctxType === 'forum_reply'){
    const post = r.ctxType === 'forum_post' ? state.forum.find(p => String(p.id) === String(r.ctxId)) : state.forum.find(p => p.replies.some(x => String(x.id) === String(r.ctxId)));
    if(post){ state.forumOpenThread = post.id; navigateWithLoading('forum'); return; }
    alert('That post has already been removed.'); return;
  }
  if(r.ctxType === 'wiki'){ navigateWithLoading('wiki'); return; }
  viewProfile(r.target);
}

// Your own suspension, if any (shown as a banner; the database enforces it either way).
async function loadMyModerationStatus(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  const { data, error } = await sb.rpc('my_moderation_status');
  if(error){ return; }
  const row = (data || [])[0];
  state.user.suspendedUntil = row ? row.suspended_until : null;
  state.user.suspendReason = row ? row.suspend_reason : null;
}
function suspensionBanner(){
  if(!state.user || !state.user.suspendedUntil) return null;
  const label = suspendedLabel(state.user.suspendedUntil);
  if(!label) return null;
  return el('div',{class:'suspended-banner', role:'status'},[
    el('strong',{}, label.replace('Suspended', 'Your account is suspended') + '.'),
    ' You can still read, but you can\'t post, message or debate' + (state.user.suspendReason ? '. Reason: ' + state.user.suspendReason : '') + '.',
  ]);
}

/* ================= MUTUALS ================= */
function getMutuals(username){
  if(username === state.currentUser) return [];
  const them = state.users[username];
  if(!them) return [];
  const myFollowing = state.user.following || [];
  const theirFollowers = them.followers || [];
  return myFollowing.filter(u => theirFollowers.includes(u) && u !== state.currentUser);
}

/* ================= DIRECT MESSAGES ================= */
function dmKey(a, b){ return [a,b].sort().join('::'); }

function getConversation(username){
  const key = dmKey(state.currentUser, username);
  return (state.dms[key] && state.dms[key].messages) || [];
}

function myConversations(){
  return Object.keys(state.dms)
    .filter(k => k.split('::').includes(state.currentUser))
    .map(k => {
      const parts = k.split('::');
      const other = parts[0] === state.currentUser ? parts[1] : parts[0];
      const msgs = state.dms[k].messages || [];
      return { other, key: k, lastMsg: msgs[msgs.length-1] || null };
    })
    .filter(c => state.users[c.other])
    .sort((a,b) => (b.lastMsg ? b.lastMsg.ts : 0) - (a.lastMsg ? a.lastMsg.ts : 0));
}

function hasUnreadDM(username){
  const msgs = getConversation(username);
  return msgs.some(m => m.from === username && !m.read);
}

function totalUnreadDMs(){
  return myConversations().filter(c => hasUnreadDM(c.other)).length;
}

async function openDM(username){
  state.activeDM = username;
  const target = state.users[username];
  const unread = getConversation(username).filter(m => m.from === username && !m.read);
  unread.forEach(m => { m.read = true; });
  navigateWithLoading('messages');   // open the conversation straight away
  if(unread.length && target && target.id && state.user && state.user.id){
    const { error } = await sb.from('messages').update({ read: true }).eq('to_id', state.user.id).eq('from_id', target.id).eq('read', false);
    if(error) console.warn('Could not mark messages read', error);
  }
}

async function sendDM(toUsername, text){
  const trimmed = (text||'').trim();
  if(!trimmed) return false;
  if(state.user.isGuest){ alert('Create an account to send messages.'); return false; }
  if(isBlocked(toUsername)){ alert('You can\'t message this user.'); return false; }
  const target = state.users[toUsername];
  if(!target || !target.id){ alert('That account isn\'t available yet.'); return false; }
  // Show the message immediately (slightly faded while it sends).
  const key = dmKey(state.currentUser, toUsername);
  state.dms[key] = state.dms[key] || { messages: [] };
  const local = { id: 'pending-' + Date.now(), from: state.currentUser, text: trimmed, ts: Date.now(), read: false, pending: true };
  state.dms[key].messages.push(local);
  render();
  // The database rejects blocked conversations and creates the recipient's notification.
  const { data, error } = await sb.from('messages').insert({ from_id: state.user.id, to_id: target.id, text: trimmed }).select('id, created_at').single();
  if(error){
    state.dms[key].messages = state.dms[key].messages.filter(m => m !== local);
    render();
    automodNote(error, 'message', trimmed);
    alert(friendlyDbError(error, 'That message couldn\'t be sent.'));
    return false;
  }
  local.id = data.id; local.ts = new Date(data.created_at).getTime(); local.pending = false;
  render();
  if(target.isAi && !target.aiRetired) requestRivalDm(toUsername);
  return true;
}

const rivalDmTyping = {};
async function requestRivalDm(username){
  const target = state.users[username];
  if(!target || !target.isAi || rivalDmTyping[username]) return;
  rivalDmTyping[username] = true;
  render();
  let res;
  try { res = await callSecure('rival_dm', { rivalId: target.id }); }
  finally { rivalDmTyping[username] = false; }
  const m = res && res.data && res.data.message;
  if(m){
    const key = dmKey(state.currentUser, username);
    state.dms[key] = state.dms[key] || { messages: [] };
    if(!state.dms[key].messages.some(x => x.id === m.id)){
      state.dms[key].messages.push({ id: m.id, from: username, text: m.text, ts: new Date(m.created_at).getTime(), read: state.activeDM === username });
    }
  }
  render();
}

function viewProfile(username){
  state.viewingProfile = (username === state.currentUser) ? null : username;
  navigateWithLoading('profile');
}

function goToOwnProfile(){
  state.viewingProfile = null;
  navigateWithLoading('profile');
}

const SETTING_COLUMNS = {
  profileVisibility: 'profile_visibility',
  showOnLeaderboard: 'show_on_leaderboard',
  allowFollowers: 'allow_followers',
};

async function updateSetting(key, value){
  const previous = (state.user.settings || {})[key];
  state.user.settings = state.user.settings || {};
  state.user.settings[key] = value;
  render();
  if(state.user.isGuest || !state.user.id) return;
  const { error } = await sb.from('profiles').update({ [SETTING_COLUMNS[key]]: value }).eq('id', state.user.id);
  if(error){
    state.user.settings[key] = previous;
    alert('That setting couldn\'t be saved — please try again.');
    render();
  }
}

async function updateDisplayName(newName){
  const trimmed = (newName || '').trim().slice(0, 40);
  const name = trimmed || state.user.username;
  const previous = state.user.name;
  state.user.name = name;
  delete state.drafts['settings-name'];
  render();
  if(!state.user.isGuest && state.user.id){
    const { error } = await sb.from('profiles').update({ name }).eq('id', state.user.id);
    if(error){ state.user.name = previous; render(); alert('Your name couldn\'t be saved — please try again.'); }
  }
}

async function updateBio(newBio){
  const bio = (newBio || '').trim().slice(0,280);
  const previous = state.user.bio;
  state.user.bio = bio;
  delete state.drafts['settings-bio'];
  render();
  if(!state.user.isGuest && state.user.id){
    const { error } = await sb.from('profiles').update({ bio }).eq('id', state.user.id);
    if(error){ state.user.bio = previous; render(); alert('Your bio couldn\'t be saved — please try again.'); }
  }
}

// Crop to a 200×200 square in the browser, then upload to the "avatars" storage bucket.
function cropToSquareJpeg(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const size = 200;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2, sy = (img.height - minSide) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        canvas.getContext('2d').drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('encode failed')), 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function avatarPath(){ return state.user.id + '/avatar.jpg'; }

async function handleAvatarUpload(file){
  if(!file) return;
  if(state.user.isGuest){ alert('Create an account to set a profile picture.'); return; }
  if(!file.type || !file.type.startsWith('image/')){ alert('Please choose an image file.'); return; }
  let blob;
  try { blob = await cropToSquareJpeg(file); }
  catch(e){ alert('Could not read that image.'); return; }
  const { error: upErr } = await sb.storage.from('avatars').upload(avatarPath(), blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if(upErr){ alert('Your photo couldn\'t be uploaded — please try again.'); return; }
  const { data } = sb.storage.from('avatars').getPublicUrl(avatarPath());
  const url = data.publicUrl + '?v=' + Date.now(); // bust the browser cache so the new photo shows immediately
  const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', state.user.id);
  if(error){ alert('Your photo uploaded but couldn\'t be saved to your profile — please try again.'); return; }
  state.user.avatar = url;
  render();
}

async function removeAvatar(){
  if(state.user.isGuest || !state.user.id){ state.user.avatar = null; render(); return; }
  const { error } = await sb.from('profiles').update({ avatar_url: null }).eq('id', state.user.id);
  if(error){ alert('Couldn\'t remove your photo — please try again.'); return; }
  await sb.storage.from('avatars').remove([avatarPath()]);
  state.user.avatar = null;
  render();
}

// Switch tabs instantly (the old version showed a spinner for 0.3s on purpose).
function navigateWithLoading(tabId) {
  if(tabId !== 'watch' && watch && watch.id) stopWatching();
  if(tabId === 'reading' || tabId === 'debate' || tabId === 'assessment') warmFunctions();
  if(tabId === 'debate' || tabId === 'majlis' || tabId === 'watch') refreshIceServers();
  if(tabId === 'reports' && canModerate()) loadReports().then(() => { if(state.tab === 'reports') render(); });
  if(tabId !== 'reports' && canModerate() && Date.now() - (state._reportCountAt || 0) > 60000){ state._reportCountAt = Date.now(); refreshOpenReportCount().then(render); }
  state.tab = tabId;
  state.exploreOpen = false;
  state.mobileNavOpen = false;
  state.searchQuery = '';
  state.searchResults = null;
  render();
  window.scrollTo(0, 0);
}

const DEBATE_RANK_TITLES = [
  {min:1, max:10, title:'Novice'}, {min:11, max:20, title:'Apprentice'},
  {min:21, max:30, title:'Disputant'}, {min:31, max:40, title:'Reasoner'},
  {min:41, max:50, title:'Dialectician'}, {min:51, max:60, title:'Advocate'},
  {min:61, max:70, title:'Orator'}, {min:71, max:80, title:'Sage'},
  {min:81, max:90, title:'Elder'}, {min:91, max:100, title:'Hakim'},
];

const READING_LEVEL_TITLES = [
  {min:1, max:2, title:'Reader'}, {min:3, max:4, title:'Scholar-in-training'},
  {min:5, max:6, title:'Bibliophile'}, {min:7, max:9, title:'Scholar'},
  {min:10, max:13, title:'Archivist'}, {min:14, max:17, title:'Sage of the Stacks'},
  {min:18, max:99, title:'Grand Librarian'},
];

function titleFor(list, n){
  const hit = list.find(t=> n>=t.min && n<=t.max);
  return hit ? hit.title : list[list.length-1].title;
}

/* ================= HELPERS ================= */
function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for(const k in attrs){
    if(k==='class') e.className = attrs[k];
    else if(k==='html') e.innerHTML = attrs[k];
    else if(k === 'onclick' && tag === 'button'){
      const fn = attrs[k];
      e.addEventListener('click', (ev) => {
        if(e.dataset.busy) return;
        const r = fn(ev);
        if(r && typeof r.then === 'function'){
          e.dataset.busy = '1'; e.classList.add('is-busy');
          const done = () => { delete e.dataset.busy; e.classList.remove('is-busy'); };
          r.then(done, done);
        }
      });
    }
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if(c==null) return;
    if(typeof c==='string' || typeof c==='number'){ e.appendChild(document.createTextNode(String(c))); return; }
    if(Array.isArray(c)){ c.forEach(cc=>{ if(cc!=null) e.appendChild(typeof cc==='string'||typeof cc==='number' ? document.createTextNode(String(cc)) : cc); }); return; }
    e.appendChild(c);
  });
  return e;
}

function levelFromPoints(pts){ return Math.floor(pts/150)+1; }

/* ================= DEBATE RANK SYSTEM (100 ranks, escalating points curve) ================= */
const MAX_RANK = 100;
const RANK_BASE_COST = 80;   // points needed to go from rank 1 to rank 2
const RANK_COST_STEP = 20;   // each subsequent rank costs this many more points than the last

function pointsRequiredForRank(rank){
  // Points needed to advance FROM this rank to the next one — grows every rank.
  return Math.round(RANK_BASE_COST + (rank - 1) * RANK_COST_STEP);
}
function cumulativePointsForRank(targetRank){
  let total = 0;
  for(let r = 1; r < targetRank; r++) total += pointsRequiredForRank(r);
  return total;
}
function rankFromPoints(points){
  let remaining = Math.max(0, points||0);
  let rank = 1;
  while(rank < MAX_RANK && remaining >= pointsRequiredForRank(rank)){
    remaining -= pointsRequiredForRank(rank);
    rank++;
  }
  return rank;
}
function pointsIntoCurrentRank(points){
  let remaining = Math.max(0, points||0);
  let rank = 1;
  while(rank < MAX_RANK && remaining >= pointsRequiredForRank(rank)){
    remaining -= pointsRequiredForRank(rank);
    rank++;
  }
  return remaining;
}
function pointsToNextRank(points){
  const rank = rankFromPoints(points);
  if(rank >= MAX_RANK) return 0;
  return pointsRequiredForRank(rank) - pointsIntoCurrentRank(points);
}
function rankColor(rank){
  return 'var(--neon)';
}
function renderRankProgress(user){
  const points = user.debatePoints || 0;
  const rank = rankFromPoints(points);
  const into = pointsIntoCurrentRank(points);
  const isMax = rank >= MAX_RANK;
  const need = isMax ? into : pointsRequiredForRank(rank);
  const toNext = pointsToNextRank(points);
  const pct = isMax ? 100 : Math.round((into / need) * 100);
  const color = rankColor(rank);

  const wrap = el('div',{});
  wrap.appendChild(el('div',{style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'},[
    el('span',{style:`color:${color};font-weight:600;font-size:14px;`}, 'Rank '+rank+(isMax?' (Max)':'')),
    el('span',{style:'font-size:12px;color:var(--parchment-dim);'}, isMax ? (points+' total points') : (into+' / '+need+' points')),
  ]));
  wrap.appendChild(el('div',{class:'progress-track'},[
    el('div',{class:'progress-fill', style:`width:${pct}%;background:${color};`}),
  ]));
  if(!isMax){
    wrap.appendChild(el('div',{style:'font-size:11.5px;color:var(--parchment-dim);margin-top:5px;'}, toNext+' points until rank '+(rank+1)));
  }
  return wrap;
}

// "mc:<seed>" avatars are Majlis characters, drawn here (head and shoulders).
const characterAvatarCache = {};
function characterAvatarUrl(seed){
  if(characterAvatarCache[seed]) return characterAvatarCache[seed];
  if(!window.MajlisCharacters) return null;
  try {
    const spec = window.MajlisCharacters.random(seed, { pose: 'stand', expression: 'happy', prop: null, extras: [] });
    const svg = window.MajlisCharacters.svg(spec, { sticker: false })
      .replace(/width="\d+" height="\d+" viewBox="[^"]*"/, 'width="96" height="96" viewBox="72 34 96 96"')
      .replace('style="overflow:visible"', 'style="background:#1B2520"');
    return (characterAvatarCache[seed] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  } catch(e){ console.warn('character avatar failed', e); return null; }
}

function avatarNode(userOrUsername, size){
  size = size || 36;
  const user = typeof userOrUsername === 'string' ? state.users[userOrUsername] : userOrUsername;
  const displayName = user ? user.name : (typeof userOrUsername === 'string' ? userOrUsername : '?');
  let node;
  const av = user && user.avatar ? String(user.avatar) : '';
  const src = !av ? null
    : av.startsWith('mc:') ? characterAvatarUrl(av.slice(3))
    : av.startsWith('pfp:') ? 'pfps/' + av.slice(4) + '.jpg'
    : av;
  if(src){
    node = el('img', {class:'avatar-img', src, alt:'', style:`width:${size}px;height:${size}px;`});
  } else {
    node = el('div', {class:'avatar', style:`width:${size}px;height:${size}px;font-size:${Math.max(10,Math.round(size*0.4))}px;`},
      (displayName || '?').charAt(0).toUpperCase());
  }
  return node;
}

const FORUM_CATEGORIES = ['Discussion', 'Question', 'Debate', 'Off-topic'];

// Display names without exposing whether an account is an AI rival.
function nameWithTag(username, prefix, suffix){
  return el('span',{},[ (prefix||'') + username, badgeRow(username, 'xs'), suffix || '' ]);
}

// When someone opens the Forum, give the AI rivals a chance to post (the server allows one run every 8 minutes).
let lastForumTick = 0;
function forumTick(){
  if(!state.user || state.user.isGuest) return;
  if(Date.now() - lastForumTick < 3 * 60 * 1000) return;
  lastForumTick = Date.now();
  callSecure('forum_tick', {}).catch(() => {});
}

// A brand-new rival may post before this page knows about them — fetch their profile, then redraw.
const fetchingAuthors = new Set();
async function ensureAuthor(id){
  if(!id || fetchingAuthors.has(id) || idToUsernameMap()[id]) return;
  fetchingAuthors.add(id);
  try {
    const { data } = await sb.from('profiles_public').select('*').eq('id', id).maybeSingle();
    if(data){ applyProfileRow(data); relinkAuthors(); render(); }
  } catch(e){ console.warn('ensureAuthor failed', e); }
  finally { fetchingAuthors.delete(id); }
}

function timeAgo(ts){
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff/60000);
  if(m < 1) return 'just now';
  if(m < 60) return m+'m ago';
  const h = Math.floor(m/60);
  if(h < 24) return h+'h ago';
  const d = Math.floor(h/24);
  if(d < 7) return d+'d ago';
  return new Date(ts).toLocaleDateString();
}

/* ================= DRAFTS =================
   render() rebuilds the whole page. Without help, that wipes whatever someone
   was typing whenever anything else changes (a new forum post arrives, a DM
   comes in...). draft() ties a form field to state.drafts so its text survives,
   and render() puts the cursor back where it was. */
function draft(key, field, initial){
  field.dataset.key = key;
  if(state.drafts[key] !== undefined) field.value = state.drafts[key];
  else if(initial !== undefined) field.value = initial;
  const save = () => { state.drafts[key] = field.value; };
  field.addEventListener('input', save);
  field.addEventListener('change', save);
  return field;
}
function clearDrafts(...keys){ keys.forEach(k => { delete state.drafts[k]; }); }

/* Never rebuild the page in the middle of a click. If something finishes loading while a mouse button or
   finger is down, the button under it would be swapped for a fresh copy and the browser drops the click
   (that's why some buttons needed two or three presses). Such redraws wait until the click has landed. */
const pointer = { down: false, since: 0, pending: false };
function flushPendingRender(){ pointer.down = false; if(pointer.pending){ pointer.pending = false; render(); } }
window.addEventListener('pointerdown', (e) => { if(e.button === 0 || e.pointerType !== 'mouse'){ pointer.down = true; pointer.since = Date.now(); } }, true);
window.addEventListener('pointerup', () => { if(pointer.down){ pointer.down = false; if(pointer.pending) setTimeout(flushPendingRender, 0); } }, true);
window.addEventListener('pointercancel', () => setTimeout(flushPendingRender, 0), true);
window.addEventListener('blur', () => setTimeout(flushPendingRender, 0));
function render(){
  if(pointer.down && Date.now() - pointer.since < 2500){ pointer.pending = true; return; }
  pointer.down = false; pointer.pending = false;
  renderNow();
}
function renderNow(){
  touchActivity();
  ensureLiveDirectory();
  const app = document.getElementById('app');

  // Remember focus, cursor position and scroll so the rebuild is invisible to the user.
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.key : null;
  let selStart = null, selEnd = null;
  try { if(focusKey){ selStart = active.selectionStart; selEnd = active.selectionEnd; } } catch(e) {}
  const scrollY = window.scrollY;

  if(!state.currentUser){
    startGuestSession();
  }
  const content = state.loading ? el('div', {class:'spinner-wrap'}, el('div', {class:'spinner'})) : renderTab();

  // While the AI judge screen is up, leave it where it is and redraw only the rest of the page.
  // (Taking it off the page and putting it back restarts its animations, which looks like flashing.)
  const oldMain = app.querySelector(':scope > main');
  const keepMain = !!(oldMain && content && content.isConnected && content.parentNode === oldMain);
  [...app.children].forEach(c => { if(!(keepMain && c === oldMain)) c.remove(); });

  let main = oldMain;
  if(!keepMain){
    main = el('main');
    const sb_ = suspensionBanner();
    if(sb_) main.appendChild(sb_);
    main.appendChild(content);
    app.appendChild(main);
  }
  app.insertBefore(buildMobileNav(), main);
  app.insertBefore(buildTopbar(), app.firstChild);

  const mini = majlisMiniBar();
  if(mini) app.appendChild(mini);
  app.appendChild(buildFooter());
  app.appendChild(buildBottomBar());
  if(state.mobileNavOpen) app.appendChild(el('div',{class:'scrim', onclick:()=>{ state.mobileNavOpen = false; render(); }}));

  if(!state.cookieConsent){
    app.appendChild(buildCookieBanner());
  }

  if(state.showAuth){
    app.appendChild(renderAuthOverlay());
  }

  if(focusKey){
    const again = app.querySelector('[data-key="'+CSS.escape(focusKey)+'"]');
    if(again){
      again.focus({ preventScroll: true });
      try { if(selStart !== null) again.setSelectionRange(selStart, selEnd); } catch(e) {}
    }
  }
  window.scrollTo(0, scrollY);
}

/* ================= COOKIE BANNER ================= */
function buildCookieBanner(){
  return el('div', {class: 'cookie-banner'}, [
    el('p', {}, 'We use basic local storage to preserve your preferences and session data locally. No privacy-invasive tracking is performed.'),
    el('button', {class: 'btn', onclick: acceptCookies}, 'Accept')
  ]);
}

/* ================= FOOTER ================= */
/* ================= AUTH OVERLAY ================= */
const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
function usernameError(u){
  if(!u) return 'Choose a username.';
  if(u.length < 3) return 'Username must be at least 3 characters.';
  if(u.length > 20) return 'Username must be 20 characters or fewer.';
  if(!/^[a-zA-Z]/.test(u)) return 'Username must start with a letter.';
  if(!USERNAME_RE.test(u)) return 'Only letters, numbers, and underscores are allowed.';
  return null;
}

function passwordStrength(p){
  if(!p) return { idx: 0, pct: 0, label: '', color: 'var(--line)' };
  let score = 0;
  if(p.length >= 8) score++;
  if(p.length >= 12) score++;
  if(/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if(/[0-9]/.test(p)) score++;
  if(/[^a-zA-Z0-9]/.test(p)) score++;
  const levels = [
    { label: 'Too short', color: 'var(--wine)' },
    { label: 'Weak', color: 'var(--wine)' },
    { label: 'Fair', color: '#c9a227' },
    { label: 'Good', color: 'var(--brass)' },
    { label: 'Strong', color: 'var(--brass-bright)' },
    { label: 'Very strong', color: 'var(--brass-bright)' },
  ];
  const idx = p.length < 8 ? 0 : Math.min(score, 5);
  return { idx, pct: Math.round((idx/5)*100), ...levels[idx] };
}

// The password test for new accounts. Returns what's wrong with the password, or null if it passes.
const COMMON_PASSWORDS = ['password', 'passw0rd', 'qwerty', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'letmein', 'welcome', 'iloveyou', 'admin', 'monkey', 'dragon', 'football',
  'baseball', 'abc123', '123456', '12345678', '123456789', '1234567890', '111111', '000000', 'login', 'princess', 'sunshine', 'master', 'shadow', 'superman', 'whatever', 'majlis'];
function passwordProblem(p, username, email){
  if(!p || p.length < 10) return 'Use at least 10 characters.';
  const low = p.toLowerCase();
  const plain = low.replace(/[^a-z0-9]/g, '');
  if(COMMON_PASSWORDS.some(w => plain === w || (plain.length <= w.length + 3 && plain.includes(w)))) return 'That password is too common. Try a few unrelated words.';
  if(/^(.)\1+$/.test(p)) return 'Don\'t repeat one character.';
  if(new Set(low.split('')).size < 5) return 'Mix in more different characters.';
  const u = String(username || '').toLowerCase(), mail = String(email || '').toLowerCase().split('@')[0];
  if(u.length >= 3 && low.includes(u)) return 'Don\'t put your username in your password.';
  if(mail.length >= 4 && low.includes(mail)) return 'Don\'t put your email in your password.';
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(p)).length;
  if(p.length < 16 && kinds < 3) return 'Add capitals, numbers or symbols, or make it longer (16+ characters).';
  return null;
}

// Everything that needs to happen once someone is signed in (password, signup, or OAuth redirect).
async function afterSignIn(authUser){
  // Your own profile and everyone else's load at the same time.
  await Promise.all([loadCurrentUserProfile(authUser), loadAllProfiles()]);
  if(!state.user || state.user.isGuest){
    alert('You\'re signed in, but your profile couldn\'t be loaded. Please refresh the page.');
    return;
  }
  state.showAuth = false;
  clearDrafts('auth-username', 'auth-email', 'auth-password');
  render();   // you're in — show it straight away
  subscribeToInbox();
  // Everything else fills in a moment later, all at once.
  await Promise.all([loadWikiFromSupabase(), loadForumFromSupabase(), loadSocialData(), loadMyBooks(), loadDebateHistory(), loadReports(), loadMyModerationStatus()]);
  loadExtrasForUser();
  checkForActiveDebate();
  render();
}

// Forum/wiki may load before we know everyone's usernames; fill the names in afterwards.
function relinkAuthors(){
  const idToUsername = idToUsernameMap();
  const fix = (x) => { if(x.authorId && idToUsername[x.authorId]) x.author = idToUsername[x.authorId]; };
  state.wiki.forEach(fix);
  state.forum.forEach(p => { fix(p); p.replies.forEach(fix); });
}

function renderAuthOverlay(){
  const backdrop = el('div',{style:
    'position:fixed;inset:0;background:var(--modal-overlay);display:flex;align-items:center;justify-content:center;z-index:50;'});
  backdrop.addEventListener('click', (e)=>{ if(e.target===backdrop){ state.showAuth=false; clearDrafts('auth-password'); render(); } });

  const box = el('div',{style:'width:100%;max-width:380px;padding:24px;'});
  const isLogin = state.authMode === 'login';
  const card = el('div',{class:'card modal-card', style:'position:relative;'});
  
  card.appendChild(el('button',{class:'icon-btn', title:'Close', style:'position:absolute;top:14px;right:14px;width:32px;height:32px;', onclick:()=>{state.showAuth=false; clearDrafts('auth-password'); render();}}, icon('close', 16)));
  card.appendChild(el('h3',{}, isLogin ? 'Log in' : 'Create an account'));
  card.appendChild(el('p',{style:'font-size:13px;color:var(--parchment-dim);margin-bottom:14px;'},
    'Optional — you can keep using Majlis as a guest. An account just lets you come back to the same profile.'));

  // draft() keeps what you've typed if the page re-renders behind the dialog (e.g. a new forum post arrives).
  const userIn = draft('auth-username', el('input',{type:'text', placeholder:'e.g. sam_reads', maxlength:'20', autocomplete:'username'}));
  const emailIn = draft('auth-email', el('input',{type:'email', placeholder:'you@example.com', autocomplete:'email'}));
  const passIn = draft('auth-password', el('input',{type: state.showPassword ? 'text' : 'password', placeholder: isLogin ? 'Password' : 'At least 10 characters', autocomplete: isLogin ? 'current-password' : 'new-password'}));
  const passToggle = el('button', {class: 'pw-toggle', onclick: () => {
    state.showPassword = !state.showPassword;
    passIn.type = state.showPassword ? 'text' : 'password';
    passToggle.textContent = state.showPassword ? 'Hide' : 'Show';
  }}, state.showPassword ? 'Hide' : 'Show');

  const userCaption = el('div',{class:'field-caption'}, '3–20 characters. Letters, numbers, and underscores — must start with a letter.');
  if(!isLogin){
    userIn.addEventListener('input', ()=>{
      const err = userIn.value.trim() ? usernameError(userIn.value.trim()) : null;
      userCaption.textContent = err || 'Looks good.';
      userCaption.className = 'field-caption' + (err ? ' warn' : '');
    });
    card.appendChild(el('div',{class:'field'},[el('label',{},'Username'), userIn, userCaption]));
  }

  const mailIcon = el('span',{class:'input-icon'}, icon('mail', 16));
  card.appendChild(el('div',{class:'field'},[
    el('label',{},'Email'),
    el('div',{class:'input-icon-wrap'},[mailIcon, emailIn]),
  ]));

  const strengthWrap = el('div',{class:'pw-strength', style: isLogin ? 'display:none;' : ''});
  const strengthTrack = el('div',{class:'pw-strength-track'}, [0,1,2,3,4].map(()=>el('div',{class:'pw-strength-seg'})));
  const strengthLabel = el('div',{class:'pw-strength-label'});
  strengthWrap.appendChild(strengthTrack);
  strengthWrap.appendChild(strengthLabel);
  if(!isLogin){
    passIn.addEventListener('input', ()=>{
      const s = passwordStrength(passIn.value);
      Array.from(strengthTrack.children).forEach((seg, i)=>{
        seg.classList.toggle('filled', i < s.idx);
        seg.style.setProperty('--seg-color', s.color);
      });
      const problem = passwordProblem(passIn.value, userIn.value, emailIn.value);
      strengthLabel.textContent = !passIn.value ? '' : problem ? s.label + ' · ' + problem : s.label + ' · Looks good';
      strengthLabel.style.color = problem && passIn.value ? 'var(--wine)' : s.color;
    });
  }

  card.appendChild(el('div',{class:'field'},[
    el('label',{},'Password'),
    el('div', {class: 'pw-wrapper'}, [passIn, passToggle]),
    strengthWrap,
  ]));

  const errorBox = el('div',{style:'color:var(--wine);font-size:13px;margin-bottom:10px;min-height:16px;'});
  card.appendChild(errorBox);

  const mainBtn = el('button',{class:'btn', style:'width:100%;', onclick: async ()=>{
    const u = userIn.value.trim();
    const p = passIn.value;
    const em = emailIn.value.trim();
    if(!em || !p){ errorBox.textContent = 'Enter an email and password.'; return; }

    if(isLogin){
      mainBtn.disabled = true; mainBtn.textContent = 'Logging in...';
      const { data, error } = await sb.auth.signInWithPassword({ email: em, password: p });
      mainBtn.disabled = false; mainBtn.textContent = 'Log in';
      if(error){ errorBox.textContent = 'Incorrect email or password.'; return; }
      await afterSignIn(data.user);
      return;
    }

    // Signup flow
    const uErr = usernameError(u);
    if(uErr){ errorBox.textContent = uErr; return; }
    const pwErr = passwordProblem(p, u, em);
    if(pwErr){ errorBox.textContent = pwErr; return; }

    mainBtn.disabled = true; mainBtn.textContent = 'Creating account...';
    const { data: taken } = await sb.from('profiles_public').select('username').ilike('username', u).maybeSingle();
    if(taken){
      mainBtn.disabled = false; mainBtn.textContent = 'Create account';
      errorBox.textContent = 'That username is taken.';
      return;
    }
    // The chosen username is stored with the account, so it's used even if the
    // person has to confirm their email first and logs in later.
    const { data, error } = await sb.auth.signUp({ email: em, password: p, options: { data: { user_name: u } } });
    mainBtn.disabled = false; mainBtn.textContent = 'Create account';
    if(error){ errorBox.textContent = error.message; return; }
    if(!data.session){
      errorBox.textContent = 'Check your email to confirm your account, then log in.';
      clearDrafts('auth-password');
      return;
    }
    await afterSignIn(data.user);
  }}, isLogin ? 'Log in' : 'Create account');

  card.appendChild(mainBtn);

  const divider = el('div',{style:'display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--parchment-dim);font-size:12px;'},[
    el('div',{style:'flex:1;height:1px;background:var(--line);'}),
    el('span',{}, 'or continue with'),
    el('div',{style:'flex:1;height:1px;background:var(--line);'}),
  ]);
  card.appendChild(divider);

  const oauthRow = el('div',{style:'display:flex;gap:10px;'});
  oauthRow.appendChild(el('button',{class:'btn secondary', style:'flex:1;', onclick: async ()=>{
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
  }}, 'Google'));
  oauthRow.appendChild(el('button',{class:'btn secondary', style:'flex:1;', onclick: async ()=>{
    await sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.origin + window.location.pathname } });
  }}, 'Discord'));
  card.appendChild(oauthRow);

  box.appendChild(card);
  box.appendChild(el('div',{style:'text-align:center;margin-top:16px;font-size:13px;color:var(--parchment-dim);'},[
    isLogin ? 'New here? ' : 'Already have an account? ',
    el('a',{href:'#', style:'color:var(--brass-bright);cursor:pointer;', onclick:(e)=>{
      e.preventDefault();
      state.authMode = isLogin ? 'signup' : 'login';
      render();
    }}, isLogin ? 'Create an account' : 'Log in'),
  ]));

  backdrop.appendChild(box);
  return backdrop;
}

/* ================= SEARCH SYSTEM ================= */
function computeSearchResults(query) {
  if (!query.trim()) return null;
  
  const q = query.toLowerCase();
  const results = [];

  const pages = [
    { title: 'Home', tab: 'home' },
    { title: 'Reading Tracker', tab: 'reading' },
    { title: 'Placement Assessment', tab: 'assessment' },
    { title: 'Debate Lobby', tab: 'debate' },
    { title: 'Forum', tab: 'forum' },
    { title: 'Leaderboards', tab: 'leaderboard' },
    { title: 'Ranks Overview', tab: 'ranks' },
    { title: 'Political Compass', tab: 'compass' },
    { title: 'Wiki', tab: 'wiki' },
  ];

  pages.forEach(p => {
    if (p.title.toLowerCase().includes(q)) results.push({ label: 'Page: ' + p.title, tab: p.tab });
  });

  state.wiki.forEach(w => {
    if (w.title.toLowerCase().includes(q) || w.summary.toLowerCase().includes(q)) {
      results.push({ label: 'Wiki: ' + w.title, tab: 'wiki' });
    }
  });

  Object.values(state.users).forEach(u => {
    if (u.isGuest || u.aiRetired || u.username === state.currentUser) return;
    if (u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) {
      results.push({ label: 'Person: ' + u.name, user: u.username });
    }
  });

  return results;
}

// Typing in the search box only swaps the results dropdown — it never rebuilds the
// page, so the input keeps focus and the cursor stays put.
function buildSearchDropdown(){
  if (!state.searchQuery.trim() || !state.searchResults) return null;
  return el('div', {class: 'search-results'},
    state.searchResults.length ? state.searchResults.map(r =>
      el('div', {class: 'search-result-item', onclick: () => {
        state.searchQuery = '';
        state.searchResults = null;
        if(r.user){ viewProfile(r.user); } else { navigateWithLoading(r.tab); }
      }}, r.label)
    ) : [el('div', {class: 'search-result-item'}, 'No results found')]
  );
}

/* ================= TOPBAR & NAV ================= */
/* ================= ICONS =================
   Simple line icons (24×24, drawn with the current text colour). No emoji anywhere in the UI. */
const ICON_PATHS = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  micOff: '<path d="M9 5a3 3 0 0 1 6 0v5M15 12.5A3 3 0 0 1 9 11V9"/><path d="M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5V21M8.5 21h7M3 3l18 18"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  majlis: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.5 2.8"/><circle cx="12" cy="12" r="2.2"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  debate: '<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2.5h-6V13"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V4.5"/><path d="M8 7h8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  forum: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0z"/><path d="M8 5H4.5a3 3 0 0 0 3.5 4M16 5h3.5a3 3 0 0 1-3.5 4"/><path d="M12 13v4M8.5 21h7M9.5 17h5"/>',
  ranks: '<path d="m6 15 6-5 6 5"/><path d="m6 20 6-5 6 5"/><path d="m6 10 6-5 6 5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.4 3.2 7.9 7.5 9 4.3-1.1 7.5-4.6 7.5-9V6z"/>',
  library: '<path d="M4 20V4M9 20V4M14 20l-1.5-15.5M19.5 19.5 17 4"/><path d="M3 20h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 15 6 10z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  login: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l4 4-4 4M14 12H4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
};
function icon(name, size){
  const s = size || 18;
  return el('span',{class:'ico', 'aria-hidden':'true', html:
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || (window.EXTRA_ICONS && window.EXTRA_ICONS[name]) || ''}</svg>`});
}

/* ================= APP SHELL =================
   Desktop: a sidebar (navigation + your account) and a slim top bar (search, alerts).
   Tablet/phone: the sidebar slides in from the left, and phones get a tab bar along the bottom. */
const NAV_GROUPS = () => [
  ['Play', [['home','Home','home'],['motion','Motion of the day','megaphone'],['majlis','The Majlis','majlis'],['debate','Debate','debate'],['assessment','Assessment','target']]],
  ['Read', [['guide','30-day guide','scroll'],['reading','Reading','book'],['wiki','Wiki','library']]],
  ['Community', [['forum','Forum','forum'],['members','Members','users'],['messages','Messages','mail'],['notifications','Notifications','bell']]],
  ['Standings', [['leaderboard','Leaderboard','trophy'],['ranks','Ranks','ranks'],['compass','Compass','compass']]],
  ...(canModerate() ? [['Moderation', [['activity','Activity','activity'],['reports','Reports','flag']]]] : []),
];
const TAB_TITLES = { motion:'Motion of the day', guide:'30-day guide', home:'Home', watch:'Watching live', majlis:'The Majlis', activity:'Activity', debate:'Debate', assessment:'Assessment', reading:'Reading', wiki:'Wiki', forum:'Forum',
  members:'Members', messages:'Messages', leaderboard:'Leaderboard', ranks:'Ranks', compass:'Compass',
  reports:'Reports', notifications:'Notifications', profile:'Profile', settings:'Settings', privacy:'Privacy', terms:'Terms' };

function brandMark(){
  const M_PATH = 'M 10,80 L 10,20 L 50,65 L 90,20 L 90,80';
  return el('div',{class:'mark', html: `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="logoGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="blur2"/>
          <feMerge><feMergeNode in="blur1"/><feMergeNode in="blur2"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="logoFlashGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1"/>
          <feMerge><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path class="logo-base" d="${M_PATH}"/>
      <path class="logo-lit" d="${M_PATH}"/>
      <path class="logo-flash" d="${M_PATH}"/>
    </svg>`});
}

function brandLockup(){
  return el('button',{class:'brand', onclick: () => navigateWithLoading('home'), 'aria-label':'Majlis home'},[
    brandMark(),
    el('span',{class:'wordmark'}, ['MA', el('em',{},'JLIS')]),
  ]);
}

function openAuth(mode){ state.showAuth = true; state.authMode = mode; state.mobileNavOpen = false; render(); }

// The sidebar (also the slide-in menu on smaller screens).
function buildMobileNav(){
  const go = (id) => { state.mobileNavOpen = false; navigateWithLoading(id); };
  const side = el('aside',{class:'sidebar' + (state.mobileNavOpen ? ' open' : '')});
  const head = el('div',{class:'sidebar__head'},[
    brandLockup(),
    el('button',{class:'icon-btn sidebar__close', title:'Close menu', onclick:()=>{ state.mobileNavOpen = false; render(); }}, icon('close')),
  ]);
  side.appendChild(head);
  side.appendChild(el('div',{class:'sidebar__search'}, buildSearchBox('site-search-menu')));

  const nav = el('nav',{class:'sidenav'});
  NAV_GROUPS().forEach(([group, items]) => {
    nav.appendChild(el('div',{class:'sidenav__label'}, group));
    items.forEach(([id, label, ic]) => {
      const badge = id === 'messages' ? totalUnreadDMs() : id === 'notifications' ? unreadNotifCount() : id === 'reports' ? (state.reportsOpenCount || 0) + (state.flagsOpen || 0) : 0;
      const liveCount = id === 'debate' ? (state.liveStreams || []).length : 0;
      nav.appendChild(el('button',{class:'sidenav__item' + (state.tab === id ? ' active' : ''), 'data-tab': id, onclick:()=>go(id)},[
        icon(ic), el('span',{}, label),
        badge ? el('span',{class:'sidenav__count'}, badge > 9 ? '9+' : String(badge)) : null,
        liveCount ? el('span',{class:'sidenav__live'},[el('span',{class:'live-dot'}), 'LIVE']) : null,
      ]));
    });
  });
  side.appendChild(nav);
  side.appendChild(el('button',{class:'sidebar__theme', onclick: toggleTheme},[
    icon(state.theme === 'dark' ? 'sun' : 'moon'), el('span',{}, state.theme === 'dark' ? 'Light theme' : 'Dark theme'),
  ]));

  // Your account, pinned to the bottom of the sidebar.
  const u = state.user;
  const acct = el('div',{class:'sidebar__account'});
  if(u.isGuest){
    acct.appendChild(el('p',{class:'sidebar__guest'}, 'Browsing as a guest. Create an account to debate, log books and get ranked.'));
    acct.appendChild(el('div',{class:'sidebar__cta'},[
      el('button',{class:'btn', onclick:()=>openAuth('signup')}, 'Sign up'),
      el('button',{class:'btn secondary', onclick:()=>openAuth('login')}, 'Log in'),
    ]));
  } else {
    acct.appendChild(el('button',{class:'acct' + (state.tab === 'profile' && !state.viewingProfile ? ' active' : ''), onclick:()=>{ state.mobileNavOpen = false; goToOwnProfile(); }},[
      avatarNode(u, 36),
      el('span',{class:'acct__who'},[
        el('span',{class:'acct__name'}, u.name),
        el('span',{class:'acct__sub'}, [el('span',{}, (u.debateRank ? 'Rank '+u.debateRank : 'Unranked')), el('span',{}, 'Elo ' + (u.readingElo || 0)), streakChip()]),
      ]),
    ]));
    acct.appendChild(el('div',{class:'acct__actions'},[
      el('button',{class:'icon-btn', title:'Settings', onclick:()=>go('settings')}, icon('settings')),
      el('button',{class:'icon-btn', title:'Log out', onclick:logout}, icon('logout')),
    ]));
  }
  side.appendChild(acct);
  return side;
}

// Site search (in the top bar on bigger screens, and inside the menu on phones).
function buildSearchBox(key){
  const searchBox = el('div', {class: 'search-box'});
  const searchIn = el('input', { type: 'text', placeholder: 'Search people, threads, books…', 'data-key': key });
  searchIn.value = state.searchQuery;
  let searchDropdown = buildSearchDropdown();
  searchIn.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    state.searchResults = computeSearchResults(state.searchQuery);
    const next = buildSearchDropdown();
    if(searchDropdown) searchDropdown.remove();
    searchDropdown = next;
    if(next) searchBox.appendChild(next);
  });
  searchBox.appendChild(icon('search', 16));
  searchBox.appendChild(searchIn);
  if(searchDropdown) searchBox.appendChild(searchDropdown);
  return searchBox;
}

// Slim bar across the top of the page (desktop and tablet; phones use the bottom bar only).
function buildTopbar(){
  const searchBox = buildSearchBox('site-search');
  const unreadNotifs = unreadNotifCount();
  const unreadDMs = totalUnreadDMs();
  const iconBtn = (tab, name, title, count) => el('button',{
    class:'icon-btn' + (state.tab === tab ? ' active' : ''), title, 'aria-label': title,
    onclick:()=>navigateWithLoading(tab),
  },[icon(name), count ? el('span',{class:'badge-dot'}, count > 9 ? '9+' : String(count)) : null]);

  const right = el('div',{class:'topbar__right'},[
    el('button',{class:'icon-btn', title: state.theme === 'dark' ? 'Light theme' : 'Dark theme', onclick: toggleTheme},
      icon(state.theme === 'dark' ? 'sun' : 'moon')),
    state.user.isGuest ? null : el('button',{class:'topbar__streak', title:'Your streak', onclick:()=>navigateWithLoading('motion')}, streakChip()),
    iconBtn('notifications', 'bell', 'Notifications', unreadNotifs),
    iconBtn('messages', 'mail', 'Messages', unreadDMs),
    state.user.isGuest
      ? el('button',{class:'btn topbar__signup', onclick:()=>openAuth('signup')}, 'Sign up')
      : el('button',{class:'topbar__avatar', title:'Your profile', onclick: goToOwnProfile}, avatarNode(state.user, 32)),
  ]);

  return el('header',{class:'topbar'},[
    el('button',{class:'icon-btn hamburger', title:'Menu', 'aria-label':'Menu', onclick:()=>{ state.mobileNavOpen = !state.mobileNavOpen; render(); }}, icon('menu')),
    el('div',{class:'topbar__brand'}, brandLockup()),
    el('div',{class:'topbar__title'}, TAB_TITLES[state.tab] || ''),
    searchBox,
    right,
  ]);
}

// Phones: the main sections, always one tap away.
// Phones: the only navigation. Four main sections plus Menu (everything else, search, alerts, account).
function buildBottomBar(){
  const items = [['home','Home','home'],['debate','Debate','debate'],['reading','Read','book'],['forum','Forum','forum']];
  const unread = unreadNotifCount() + totalUnreadDMs();
  const mainTabs = items.map(([id]) => id);
  return el('nav',{class:'tabbar'}, [
    ...items.map(([id, label, ic]) =>
      el('button',{class:'tabbar__item' + (state.tab === id && !state.mobileNavOpen ? ' active' : ''), 'data-tab': id, onclick:()=>{
        state.mobileNavOpen = false; navigateWithLoading(id);
      }},[icon(ic, 20), el('span',{}, label)])),
    el('button',{class:'tabbar__item' + (state.mobileNavOpen || !mainTabs.includes(state.tab) ? ' active' : ''), 'data-tab': 'menu', onclick:()=>{
      state.mobileNavOpen = !state.mobileNavOpen; render();
    }},[
      el('span',{class:'tabbar__icon'},[icon('menu', 20), unread ? el('span',{class:'badge-dot'}, unread > 9 ? '9+' : String(unread)) : null]),
      el('span',{}, 'Menu'),
    ]),
  ]);
}

// The founders' TikTok accounts. Each @name opens their TikTok page in a new tab.
const FOUNDERS = [
  { handle: 's09309_', url: 'https://www.tiktok.com/@s09309_' },
  { handle: '3dnan.o', url: 'https://www.tiktok.com/@3dnan.o' },
];
const TIKTOK_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.6c.27 0 .53.04.77.12V9.77a5.7 5.7 0 1 0 4.91 5.64V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z"/></svg>';
function founderLinks(){
  return el('span', {class:'footer__founders'}, [
    el('span', {class:'footer__tt', html: TIKTOK_SVG}),
    'Founded by ',
    ...FOUNDERS.flatMap((f, i) => [
      i ? ' & ' : null,
      el('a', {href: f.url, target: '_blank', rel: 'noopener noreferrer', class: 'footer__founder', title: '@' + f.handle + ' on TikTok'}, '@' + f.handle),
    ]).filter(Boolean),
  ]);
}

function buildFooter(){
  return el('footer', {}, [
    el('span', {}, 'Majlis — read, reason, debate'),
    founderLinks(),
    el('span', {class:'footer__links'}, [
      el('a', {onclick: () => navigateWithLoading('privacy')}, 'Privacy'),
      el('a', {onclick: () => navigateWithLoading('terms')}, 'Terms'),
    ]),
  ]);
}

/* ================= ROUTER ================= */
function renderTab(){
  switch(state.tab){
    case 'home': return renderHome();
    case 'motion': return renderMotion();
    case 'guide': return renderGuide();
    case 'reading': return renderReading();
    case 'assessment': return renderAssessment();
    case 'debate': return renderDebate();
    case 'forum': return renderForum();
    case 'ranks': return renderRanks();
    case 'leaderboard': return renderLeaderboard();
    case 'compass': return renderCompass();
    case 'wiki': return renderWiki();
    case 'members': return renderMembers();
    case 'messages': return renderMessages();
    case 'notifications': return renderNotifications();
    case 'profile': return renderProfile();
    case 'settings': return renderSettings();
    case 'privacy': return renderPrivacy();
    case 'terms': return renderTerms();
    case 'reports': return renderReports();
    case 'majlis': return renderMajlis();
    case 'watch': return renderWatch();
    case 'activity': return renderActivity();
    default: return render404();
  }
}

/* ================= PAGES ================= */
function render404(){
  return el('div',{style:'text-align:center;padding:60px 0;'},[
    el('h2',{class:'section-title'},'404 — Page Not Found'),
    el('p',{class:'section-sub', style:'margin:0 auto 20px;'},'The state or argument you are looking for does not exist in this realm.'),
    el('button',{class:'btn', onclick:()=>navigateWithLoading('home')},'Return to Home')
  ]);
}

async function deleteAccount(){
  if(state.user.isGuest){ alert('You\'re browsing as a guest — there\'s no account to delete.'); return; }
  const typed = prompt('This permanently deletes your account, profile, posts, messages, debate history and reading data. It cannot be undone.\n\nType your username ('+state.currentUser+') to confirm:');
  if(typed === null) return;
  if(typed.trim() !== state.currentUser){ alert('The username didn\'t match, so nothing was deleted.'); return; }
  // Remove the uploaded photo first (storage files can't be deleted from inside the database function).
  await sb.storage.from('avatars').remove([avatarPath()]);
  const { error } = await sb.rpc('delete_my_account');
  if(error){ alert('Your account couldn\'t be deleted — please try again, or contact us through the details on this site.'); console.warn(error); return; }
  delete state.users[state.currentUser];
  await logout();
  alert('Your account has been deleted.');
}

function renderReports(){
  const wrap = el('div',{});
  wrap.appendChild(el('div',{class:'kicker'}, 'Moderation'));
  wrap.appendChild(el('h2',{class:'section-title'},'Reports'));
  if(!canModerate()){
    wrap.appendChild(el('p',{class:'section-sub'},'Only moderators can see reports.'));
    return wrap;
  }
  wrap.appendChild(el('p',{class:'section-sub'},'Members report people from profiles, debates, the forum, messages, the Majlis, live streams and the wiki. The words they reported are attached below, copied by the database so they can\'t be faked. Grouped by the person reported.'));

  const filter = state.reportsFilter || 'open';
  const tabs = el('div',{class:'report-tabs'});
  [['open', 'Open' + (state.reportsOpenCount ? ' (' + state.reportsOpenCount + ')' : '')], ['resolved', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All'], ['automod', 'Auto-filter' + (state.flagsOpen ? ' (' + state.flagsOpen + ')' : '')]].forEach(([k, label]) => {
    tabs.appendChild(el('button',{class:'report-tab' + (filter === k ? ' is-on' : ''), onclick: async () => { state.reportsFilter = k; if(k === 'automod'){ automod.loaded = false; render(); return; } await loadReports(); render(); }}, label));
  });
  tabs.appendChild(el('button',{class:'btn secondary report-tabs__refresh', onclick: async ()=>{ await loadReports(); render(); }}, 'Refresh'));
  wrap.appendChild(tabs);
  if(filter === 'automod'){ wrap.appendChild(renderAutomodTab()); return wrap; }
  if(state.reportsError) wrap.appendChild(el('p',{class:'field-caption warn'}, state.reportsError + ' Run the reporting SQL (migration 12) in Supabase if you haven\'t yet.'));

  if(!state.reports.length){
    wrap.appendChild(el('div',{class:'card report-empty'},[
      el('div',{class:'report-empty__tick'}, '✓'),
      el('p',{}, filter === 'open' ? 'No open reports. All clear.' : 'Nothing here yet.'),
    ]));
    return wrap;
  }

  // group by person reported
  const groups = [];
  const byTarget = {};
  state.reports.forEach(r => {
    if(!byTarget[r.targetId]){ byTarget[r.targetId] = { targetId: r.targetId, target: r.target, targetName: r.targetName, role: r.targetRole, isAi: r.targetIsAi,
      suspendedUntil: r.suspendedUntil, suspendReason: r.suspendReason, open: r.targetOpen, total: r.targetTotal, reports: [] }; groups.push(byTarget[r.targetId]); }
    byTarget[r.targetId].reports.push(r);
  });
  groups.sort((x, y) => y.open - x.open || y.reports[0].ts - x.reports[0].ts);

  const catLabel = k => (REPORT_CATEGORIES.find(c => c[0] === k) || [k, k])[1];
  const ACTION_LABEL = { none: 'No action needed', warned: 'Warned', content_removed: 'Content removed', suspended: 'Suspended' };
  groups.forEach(g => {
    const card = el('div',{class:'card report-group' + (g.open ? ' has-open' : '')});
    const susp = suspendedLabel(g.suspendedUntil);
    const cats = [...new Set(g.reports.map(r => r.category))];
    card.appendChild(el('div',{class:'report-group__head'},[
      avatarNode(g.target, 46),
      el('div',{class:'report-group__who'},[
        el('button',{class:'user-link report-group__name', onclick:()=>viewProfile(g.target)}, g.targetName),
        el('div',{class:'report-group__meta'},[
          '@' + g.target,
          g.isAi ? el('span',{class:'badge'}, 'AI rival') : null,
          g.role === 'mod' || g.role === 'admin' ? el('span',{class:'badge'}, g.role) : null,
          susp ? el('span',{class:'badge report-badge--susp'}, susp) : null,
        ]),
        el('div',{class:'report-group__cats'}, cats.map(c => el('span',{class:'report-pill is-' + c}, catLabel(c)))),
      ]),
      el('div',{class:'report-group__count'},[ el('b',{}, String(g.open)), el('span',{}, g.open === 1 ? 'open report' : 'open reports'), el('small',{}, g.total + ' ever') ]),
    ]));

    const acts = el('div',{class:'report-group__actions'});
    const openIds = g.reports.filter(r => r.status === 'open').map(r => r.id);
    if(!susp){
      acts.appendChild(el('span',{class:'report-group__label'}, 'Suspend:'));
      [[24, '1 day'], [168, '7 days'], [720, '30 days'], [-1, 'Permanently']].forEach(([h, label]) =>
        acts.appendChild(el('button',{class:'btn secondary report-act' + (h < 0 ? ' is-danger' : ''), onclick:()=>modSuspend(g, h)}, label)));
    } else {
      acts.appendChild(el('button',{class:'btn secondary report-act', onclick:()=>modSuspend(g, 0)}, 'Lift suspension'));
    }
    acts.appendChild(el('button',{class:'btn secondary report-act', onclick:()=>modWarn(g)}, 'Send a warning'));
    if(openIds.length){
      acts.appendChild(el('button',{class:'btn secondary report-act', onclick:()=>modReview(openIds, 'resolved', 'none')}, 'Mark reviewed'));
      acts.appendChild(el('button',{class:'btn secondary report-act', onclick:()=>{ if(confirm('Dismiss ' + openIds.length + ' report' + (openIds.length === 1 ? '' : 's') + ' about ' + g.targetName + '? Reporters will be told no rule was broken.')) modReview(openIds, 'dismissed'); }}, 'Dismiss all'));
    }
    card.appendChild(acts);

    g.reports.forEach(r => {
      const item = el('div',{class:'report-item' + (r.status !== 'open' ? ' is-closed' : '')});
      item.appendChild(el('div',{class:'report-item__top'},[
        el('span',{class:'report-pill is-' + r.category}, catLabel(r.category)),
        el('span',{class:'report-item__where'}, (REPORT_WHERE[r.ctxType] || 'Profile').replace('Your messages', 'Direct messages')),
        el('span',{class:'report-item__by'}, ['from ', el('button',{class:'user-link', onclick:()=>viewProfile(r.by)}, '@' + r.by), ' · ' + timeAgo(r.ts)]),
      ]));
      if(r.reason) item.appendChild(el('p',{class:'report-item__reason'}, '“' + r.reason + '”'));
      if(r.snippet) item.appendChild(el('div',{class:'report-item__quote'}, r.snippet));
      const row = el('div',{class:'report-item__actions'});
      if(['forum_post', 'forum_reply', 'wiki', 'profile'].includes(r.ctxType)) row.appendChild(el('button',{class:'linkbtn', onclick:()=>openReportContext(r)}, r.ctxType === 'profile' ? 'View profile' : 'Open'));
      if(r.status === 'open'){
        if(['forum_post', 'forum_reply', 'message', 'wiki'].includes(r.ctxType) && r.ctxId) row.appendChild(el('button',{class:'linkbtn is-danger', onclick:()=>modRemoveContent(r)}, 'Remove ' + (r.ctxType === 'message' ? 'message' : r.ctxType === 'wiki' ? 'article' : r.ctxType === 'forum_post' ? 'thread' : 'reply')));
        row.appendChild(el('button',{class:'linkbtn', onclick:()=>modReview([r.id], 'resolved', 'none')}, 'Reviewed'));
        row.appendChild(el('button',{class:'linkbtn', onclick:()=>modReview([r.id], 'dismissed')}, 'Dismiss'));
      } else {
        row.appendChild(el('span',{class:'report-item__closed'}, (r.status === 'dismissed' ? 'Dismissed' : (ACTION_LABEL[r.action] || 'Reviewed')) + (r.resolver ? ' by @' + r.resolver : '') + (r.resolvedTs ? ' · ' + timeAgo(r.resolvedTs) : '') + (r.note ? ' — ' + r.note : '')));
      }
      item.appendChild(row);
      card.appendChild(item);
    });
    wrap.appendChild(card);
  });
  return wrap;
}

function renderPrivacy(){
  const section = (title, text) => el('div',{class:'card'},[
    el('h3',{},title),
    el('p',{style:'font-size:14px;line-height:1.6;color:var(--parchment);white-space:pre-line;'}, text),
  ]);

  return el('div',{},[
    el('h2',{class:'section-title'},'Privacy Policy'),
    el('p',{class:'section-sub'},'Last updated: 2026'),

    section('1. Overview',
      'This Privacy Policy explains how Majlis ("we", "us", "the Service") collects, uses, stores, and protects information when you use our platform. We built Majlis to be as privacy-respecting as reasonably possible while still supporting accounts, debate history, and community features.'),

    section('2. Information We Collect',
      '— Account information: a username, email address, and password (processed securely via our authentication provider) when you create an account.\n— Content you submit: debate arguments, forum posts, wiki articles, direct messages, and assessment answers.\n— Usage data: reading progress, Elo ratings, fallacy-tracking results, and other in-app activity tied to your account.\n— Local browser data: certain preferences (such as theme) are stored locally in your browser using local storage.'),

    section('3. How We Use Information',
      'We use collected information to operate and improve the Service, including to create and secure your account, calculate rankings and reading statistics, enable communication features such as messaging and forums, personalize your experience, and maintain the safety and integrity of the platform.'),

    section('4. Email Verification',
      'When you create an account, our authentication provider sends a confirmation email to the address you provide, to confirm that you control that address. We do not use your email for marketing unless you separately opt in.'),

    section('5. Data Sharing',
      'We do not sell your personal data. We may share limited information with service providers who help us operate the platform (such as our authentication and hosting providers), and only to the extent necessary for them to perform their functions. We may also disclose information if required by law or to protect the rights, safety, or property of Majlis, our users, or the public.'),

    section('6. Data Storage & Retention',
      'Account and activity data is retained for as long as your account remains active. Some interface preferences are stored locally in your browser and remain there until you clear your browser data or use the delete options below. You may request deletion of your account and associated data at any time.'),

    section('7. Your Rights',
      'Depending on your location, you may have rights to access, correct, export, or delete your personal data. You can delete your account directly from this page at any time. For other requests, you can reach out through the contact details listed on this site.'),

    section('8. Cookies & Local Storage',
      'Majlis uses browser local storage, not third-party tracking cookies, to keep you signed in and remember interface preferences such as light/dark mode. We do not use this data to track you across other websites.'),

    section('9. Children\'s Privacy',
      'Majlis is not directed at children under the age of 13 (or the minimum age required by your local law), and we do not knowingly collect personal information from children below that age.'),

    section('10. International Users',
      'If you access the Service from outside the region in which it is hosted, you understand that your information may be transferred to, stored, and processed in a different jurisdiction, which may have data protection laws that differ from those in your own.'),

    section('11. Security',
      'We use industry-standard measures, including encrypted transmission and a dedicated authentication provider for credential handling, to help protect your information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.'),

    section('12. Changes to This Policy',
      'We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. Material changes will be reflected by updating the "Last updated" date above.'),

    section('13. Contact',
      'Questions or requests regarding this Privacy Policy, including data access or deletion requests, can be sent as a direct message to the site administrator on Majlis (@SafePlace2359, use the Messages page), or to the founders through the TikTok links at the bottom of every page. You can also delete your account yourself at any time from Settings.'),

    el('div',{class:'card'},[
      el('h3',{},'Delete account'),
      el('p',{style:'font-size:14px;line-height:1.6;color:var(--parchment);margin-bottom:12px;'},
        'This permanently deletes your account, including your profile, debate history, and reading data. It cannot be undone.'),
      el('button',{class:'btn wine', onclick: deleteAccount}, 'Delete account'),
    ])
  ]);
}

function renderTerms(){
  const section = (title, text) => el('div',{class:'card'},[
    el('h3',{},title),
    el('p',{style:'font-size:14px;line-height:1.6;color:var(--parchment);white-space:pre-line;'}, text),
  ]);

  return el('div',{},[
    el('h2',{class:'section-title'},'Terms & Conditions'),
    el('p',{class:'section-sub'},'Last updated: 2026'),

    section('1. Acceptance of Terms',
      'By creating an account or otherwise accessing or using Majlis ("the Service"), you agree to be bound by these Terms & Conditions ("Terms") and our Privacy Policy. If you do not agree to these Terms, you may not access or use the Service.'),

    section('2. Eligibility',
      'You must be able to form a legally binding contract in your jurisdiction to use the Service. By using Majlis, you represent that you meet this requirement. If you are using Majlis on behalf of a minor or another individual, you are responsible for ensuring their compliance with these Terms.'),

    section('3. Accounts & Registration',
      'To access certain features, you must create an account with a valid email address and confirm your email address. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate information and to promptly update it if it changes. You agree not to impersonate any person or entity or misrepresent your affiliation with any person or entity.'),

    section('4. Acceptable Use',
      'You agree not to:\n— Post content that is unlawful, harassing, defamatory, hateful, obscene, or that threatens or incites violence against any individual or group\n— Engage in bad-faith argumentation intended solely to disrupt discussion rather than debate in good faith\n— Attempt to manipulate rankings, Elo ratings, or fallacy-tracking tools through automated means, bots, scripts, or duplicate/multiple accounts\n— Attempt to gain unauthorized access to other accounts, restricted areas of the Service, or its underlying systems\n— Use the Service to distribute spam, malware, phishing links, or unsolicited advertising\n— Scrape, harvest, or collect data from the Service without our prior written consent\n— Interfere with or disrupt the integrity or performance of the Service'),

    section('5. Alternate Accounts & Rank Manipulation',
      'You may not create or use alternate ("alt") accounts to inflate, boost, or otherwise manipulate your own or another user\'s Elo rating, ranking, or debate record — including by debating against your own alt accounts, coordinating with other users to trade wins, or any similar scheme. If we reasonably believe an account is being used for this purpose, we may suspend or permanently ban any accounts involved, reset affected rankings, and remove associated rewards or status, with or without prior notice.'),

    section('6. User Content & License',
      'You retain ownership of the content you submit to Majlis, including debate arguments, forum posts, wiki articles, and messages ("User Content"). By posting User Content, you grant Majlis a non-exclusive, worldwide, royalty-free, sublicensable license to host, store, reproduce, and display that content solely for the purpose of operating and improving the Service. You represent that you have all necessary rights to the User Content you submit.'),

    section('7. Community Standards',
      'Majlis is built around structured, good-faith debate. Fallacy-tracking tools, Elo ratings, and assessment results are provided as engagement and feedback features, not as authoritative or professional evaluations. We expect users to engage respectfully, even in disagreement, and reserve the right to moderate content or conduct that undermines this goal.'),

    section('8. Moderation, Suspension & Termination',
      'We reserve the right, at our sole discretion, to remove or restrict access to any content, and to suspend or terminate any account, that we reasonably believe violates these Terms or is otherwise harmful to the Service or its users, with or without prior notice. You may delete your own account at any time from the Privacy Policy page; doing so permanently removes your profile, history, and associated data.'),

    section('9. Intellectual Property',
      'The Majlis name, logo, interface design, and underlying software are the property of Majlis and its licensors and are protected by applicable intellectual property laws. Except for the limited license granted to you to use the Service, nothing in these Terms transfers any ownership rights to you.'),

    section('10. Third-Party Services',
      'The Service may rely on third-party providers, including for authentication and email verification. Your use of those features may also be subject to the applicable third-party provider\'s own terms and privacy practices.'),

    section('11. Feedback',
      'If you choose to submit feedback, suggestions, or ideas about the Service, you grant us the right to use that feedback without restriction or compensation to you.'),

    section('12. Disclaimers',
      'The Service is provided on an "as is" and "as available" basis, without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. Elo ratings, archetypes, and fallacy assessments are algorithmic estimates intended for engagement purposes only and do not constitute professional, academic, legal, or psychological evaluation or advice.'),

    section('13. Limitation of Liability',
      'To the fullest extent permitted by applicable law, Majlis and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, use, goodwill, or other intangible losses, arising out of or related to your access to or use of, or inability to access or use, the Service.'),

    section('14. Indemnification',
      'You agree to indemnify and hold harmless Majlis and its operators from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising out of your use of the Service, your User Content, or your violation of these Terms.'),

    section('15. Governing Law',
      'These Terms shall be governed by and construed in accordance with applicable local law, without regard to its conflict-of-law provisions, unless otherwise required by mandatory law in your jurisdiction.'),

    section('16. Entire Agreement',
      'These Terms, together with our Privacy Policy, constitute the entire agreement between you and Majlis regarding your use of the Service, and supersede any prior agreements between you and Majlis on this subject.'),

    section('17. Changes to These Terms',
      'We may revise these Terms from time to time. Material changes will be reflected by updating the "Last updated" date above. Your continued use of the Service after such changes take effect constitutes your acceptance of the revised Terms.'),

    section('18. Severability',
      'If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.'),

    section('19. Contact',
      'Questions, concerns, or requests regarding these Terms can be sent as a direct message to the site administrator on Majlis (@SafePlace2359, use the Messages page), or to the founders through the TikTok links at the bottom of every page.'),
  ]);
}


// The brand's signature: a line that rises into an M.
function mLine(){
  return el('div',{html:'<svg class="mline" viewBox="0 0 360 30" preserveAspectRatio="none" aria-hidden="true"><path d="M2,27 H150 V5 L180,21 L210,5 V27 H358"/></svg>'});
}

function renderHome(){
  const u = state.user;
  const page = el('div',{class:'home'});
  const main = el('div',{class:'home__main'});
  const side = el('aside',{class:'home__side'});

  // ---- The one thing to do next ----
  const hero = el('section',{class:'hero'});
  hero.appendChild(neonM('hero__m'));
  page.appendChild(neonM('home__watermark'));
  const queued = DEBATE_MODES.find(m => (state.debateQueue[m] || []).some(e => e.username === state.currentUser));
  if(u.isGuest){
    hero.appendChild(el('div',{class:'kicker'}, 'Read · Reason · Debate'));
    hero.appendChild(el('h1',{class:'hero__title'}, ['Win the ', el('em',{},'argument.')]));
    hero.appendChild(el('p',{class:'hero__sub'}, 'Log what you read, get ranked on how well you reason, and debate the people who disagree with you most. An AI judge reads every word and always names a winner.'));
    hero.appendChild(el('div',{class:'hero__cta'},[
      el('button',{class:'btn', onclick:()=>openAuth('signup')}, ['Create an account', icon('arrow', 16)]),
      el('button',{class:'btn secondary', onclick:()=>openAuth('login')}, 'Log in'),
    ]));
  } else if(!u.placementTaken){
    hero.appendChild(el('div',{class:'kicker'}, 'Welcome, '+u.name));
    hero.appendChild(el('h1',{class:'hero__title'}, ['First, get ', el('em',{},'ranked.')]));
    hero.appendChild(el('p',{class:'hero__sub'}, 'The placement test maps your views. The written argument at the end sets your starting rank, from 1 to 10.'));
    hero.appendChild(el('div',{class:'hero__cta'},[
      el('button',{class:'btn', onclick:()=>navigateWithLoading('assessment')}, ['Start the assessment', icon('arrow', 16)]),
    ]));
  } else {
    hero.appendChild(el('div',{class:'kicker'}, 'Welcome back, '+u.name));
    hero.appendChild(el('h1',{class:'hero__title'}, ['Win the ', el('em',{},'argument.')]));
    hero.appendChild(el('p',{class:'hero__sub'}, 'You\'re matched with whoever disagrees with you most. You get 30 seconds to agree a topic, you both decide when to stop, and the AI judge names the winner.'));
    if(queued){
      hero.appendChild(queueStatusNode(queued));
    } else {
      hero.appendChild(el('div',{class:'hero__cta'},[
        el('button',{class:'btn', onclick:()=>queueForMatch('Text', '', false)}, ['Find a text debate', icon('arrow', 16)]),
        el('button',{class:'btn secondary', onclick:()=>queueForMatch('Audio', '', false)}, 'Audio'),
        el('button',{class:'btn secondary', onclick:()=>queueForMatch('Video', '', false)}, 'Video'),
      ]));
    }
  }
  main.appendChild(hero);
  const nudge = installNudge(); if(nudge) main.insertBefore(nudge, hero);
  main.appendChild(motionCard());
  if(!u.isGuest && window.MAJLIS_GUIDE){
    const nx = guideNext(), gd = nx ? guideDays()[nx - 1] : null;
    main.appendChild(el('section',{class:'guide-mini'},[
      el('span',{class:'guide-mini__icon'}, icon('scroll', 20)),
      el('div',{class:'guide-mini__text'},[
        el('div',{class:'eyebrow'}, '30-day guide · ' + guideCount() + ' of 30'),
        el('div',{class:'guide-mini__title'}, gd ? 'Day ' + nx + ': ' + gd.title : 'You finished the guide!'),
      ]),
      el('button',{class:'btn secondary', onclick:()=>{ if(nx) guide.open = guideStatus(nx) === 'locked' ? null : nx; navigateWithLoading('guide'); }}, gd ? (guideStatus(nx) === 'tomorrow' ? 'Tomorrow' : 'Open') : 'Review'),
    ]));
  }

  // ---- Reading ----
  const reading = el('section',{class:'home-section'});
  reading.appendChild(el('div',{class:'panel-head'},[el('h3',{class:'eyebrow'},'Continue reading'),
    el('button',{class:'linkbtn', onclick:()=>navigateWithLoading('reading')}, ['Reading log', icon('arrow', 14)])]));
  const current = (u.books || []).filter(b => b.status !== 'Finished').slice(0, 3);
  if(!current.length){
    reading.appendChild(el('p',{class:'empty-note'}, u.isGuest ? 'Create an account to keep a reading log.' : 'Nothing in progress. Log a book to start earning reading Elo.'));
  }
  current.forEach(b => {
    const pct = b.pages ? Math.round(b.pagesRead / b.pages * 100) : 0;
    reading.appendChild(el('div',{class:'entry'},[
      el('div',{class:'entry__main'},[el('div',{class:'entry__title'}, b.title), el('div',{class:'entry__meta'}, b.author+' · '+b.pagesRead+' of '+b.pages+' pages')]),
      el('div',{class:'entry__side'},[
        el('span',{class:'entry__figure'}, pct+'%'),
        el('div',{class:'progress-track mini-progress'},[el('div',{class:'progress-fill', style:'width:'+pct+'%;'})]),
      ]),
    ]));
  });
  main.appendChild(reading);

  // ---- Debates ----
  const debates = el('section',{class:'home-section'});
  debates.appendChild(el('div',{class:'panel-head'},[el('h3',{class:'eyebrow'},'Recent debates'),
    el('button',{class:'linkbtn', onclick:()=>goToOwnProfile()}, ['Full record', icon('arrow', 14)])]));
  const hist = (u.debateHistory || []).slice(0, 5);
  if(!hist.length){
    debates.appendChild(el('p',{class:'empty-note'}, u.isGuest ? 'Create an account to debate.' : 'No debates yet. Your results will appear here.'));
  }
  const RESULT = { win: 'Won', loss: 'Lost', draw: 'Draw', none: 'No result' };
  hist.forEach(h => debates.appendChild(el('div',{class:'entry'},[
    el('div',{class:'entry__main'},[el('div',{class:'entry__title'}, h.topic), el('div',{class:'entry__meta'}, h.mode+' · vs. '+h.opponent+(h.unranked?' · unranked':''))]),
    el('span',{class:'result-pill '+h.result}, RESULT[h.result] || h.result),
  ])));
  main.appendChild(debates);

  // ---- Dossier: every number in one place ----
  const dossier = el('section',{class:'dossier'});
  dossier.appendChild(el('div',{class:'eyebrow'}, 'Dossier'));
  if(u.debateRank){
    const points = u.debatePoints || 0;
    const rank = rankFromPoints(points);
    const isMax = rank >= MAX_RANK;
    const into = pointsIntoCurrentRank(points);
    const need = isMax ? Math.max(1, into) : pointsRequiredForRank(rank);
    dossier.appendChild(el('div',{class:'dossier__rank'},[
      el('span',{class:'dossier__num'}, String(rank)),
      el('span',{class:'dossier__rankmeta'},[el('span',{class:'dossier__ranklabel'}, 'Debate rank'), el('span',{class:'dossier__title'}, titleFor(DEBATE_RANK_TITLES, rank))]),
    ]));
    dossier.appendChild(el('div',{class:'progress-track mini-progress'},[el('div',{class:'progress-fill', style:'width:'+(isMax?100:Math.round(into/need*100))+'%;'})]));
    dossier.appendChild(el('div',{class:'dossier__next'}, isMax ? 'Highest rank reached' : (need - into)+' points to rank '+(rank+1)));
  } else {
    dossier.appendChild(el('div',{class:'dossier__rank'},[
      el('span',{class:'dossier__num', style:'color:var(--faint);'}, '—'),
      el('span',{class:'dossier__rankmeta'},[el('span',{class:'dossier__ranklabel'}, 'Debate rank'), el('span',{class:'dossier__title'}, u.isGuest ? 'Sign up to get ranked' : 'After the assessment')]),
    ]));
  }
  const level = levelFromPoints(u.readingPoints || 0);
  const rows = [
    ['Reading Elo', u.readingElo || 0, 'Level '+level+', '+titleFor(READING_LEVEL_TITLES, level)],
    ['Debate points', u.debatePoints || 0, null],
    ['Insight points', u.insightPoints || 0, null],
    ['Books finished', u.booksFinished || 0, (u.pagesRead || 0).toLocaleString()+' pages'],
    ['Fallacies flagged', (u.fallacyStats && u.fallacyStats.total) || 0, null],
    ['Archetype', u.archetype || '—', null],
  ];
  dossier.appendChild(el('dl',{class:'dossier__list'}, rows.flatMap(([k, v, hint]) => [
    el('dt',{}, [k, hint ? el('small',{}, hint) : null]), el('dd',{}, String(v)),
  ])));
  if(!u.isGuest) dossier.appendChild(el('button',{class:'linkbtn', onclick: goToOwnProfile}, ['Full profile', icon('arrow', 14)]));
  side.appendChild(dossier);

  const accounts = Object.values(state.users).filter(x => !x.isGuest && !x.hiddenStats && (!x.settings || x.settings.showOnLeaderboard !== false))
    .sort((a, b) => (b.debatePoints || 0) - (a.debatePoints || 0)).slice(0, 5);
  if(accounts.length){
    const lb = el('section',{class:'dossier'});
    lb.appendChild(el('div',{class:'panel-head'},[el('div',{class:'eyebrow'}, 'Top debaters'),
      el('button',{class:'linkbtn', onclick:()=>navigateWithLoading('leaderboard')}, ['All', icon('arrow', 14)])]));
    accounts.forEach((x, i) => lb.appendChild(el('div',{class:'lb-row'},[
      el('span',{class:'lb-pos'}, String(i+1)),
      avatarNode(x, 28),
      el('button',{class:'user-link lb-name', style:'text-align:left;', onclick:()=>viewProfile(x.username)}, x.name),
      el('span',{class:'lb-rank'}, x.debateRank ? 'Rank '+x.debateRank : 'Unranked'),
    ])));
    side.appendChild(lb);
  }

  page.appendChild(main);
  page.appendChild(side);
  return page;
}

const LEANINGS = ['Left','Right','Center','Libertarian','Authoritarian','Traditionalist','Progressive','Classical','Anti-establishment'];
function diversityScore(){
  const finished = state.user.books.filter(b=>b.status==='Finished');
  if(finished.length===0) return 0;
  const unique = new Set(finished.map(b=>b.leaning));
  return Math.round((unique.size/finished.length)*100);
}

function renderReading(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Reading Tracker'));
  wrap.appendChild(el('p',{class:'section-sub'},'Reading Elo starts at 0 and moves when books are evaluated based on page count and difficulty.'));

  const grid = el('div',{class:'grid grid-3'});
  grid.appendChild(statCard('Books finished', state.user.booksFinished));
  grid.appendChild(statCard('Pages read', state.user.pagesRead.toLocaleString()));
  grid.appendChild(statCard('Reading Diversity', diversityScore()+'%'));
  wrap.appendChild(grid);

  wrap.appendChild(el('div',{class:'divider'}));

  const listCard = el('div',{class:'card'});
  listCard.appendChild(el('h3',{},'Your books'));
  if(!state.user.books.length){
    listCard.appendChild(el('p',{class:'empty-note'}, state.user.isGuest ? 'Create an account to track your reading.' : 'No books logged yet.'));
  }
  state.user.books.forEach(b=>{
    const row = el('div',{class:'book-row', style:'align-items:flex-start;'},[
      el('div',{style:'flex:1;min-width:220px;'},[
        el('div',{class:'book-title'}, b.title),
        el('div',{class:'book-meta'}, b.author+' · '+b.pagesRead+'/'+b.pages+' pages · '+b.status+' · ['+b.leaning+'] · AI Elo worth: '+b.eloWorth+(b.verified ? ' · verified' : ' · unverified')),
        b.note ? el('div',{class:'book-meta', style:'font-style:italic;margin-top:3px;'}, b.note) : null,
      ]),
      el('div',{style:'display:flex;flex-direction:column;align-items:flex-end;gap:8px;'},[
        el('div',{class:'points-tag'}, '+'+b.points+' pts'),
        b.id ? bookActions(b) : null,
      ]),
    ]);
    listCard.appendChild(row);
  });
  wrap.appendChild(listCard);

  wrap.appendChild(el('div',{class:'divider'}));

  const addCard = el('div',{class:'card'});
  addCard.appendChild(el('h3',{},'Log a new book'));
  addCard.appendChild(el('p',{style:'font-size:12.5px;color:var(--parchment-dim);margin:-4px 0 14px;'},
    'Books are checked against the Open Library catalogue, so use the real title and author (if it isn\'t listed, you can add it with a link). A new book can take up to half a minute while it\'s checked and rated. To update your progress, change the number next to the book in your list.'));
  if(state.readingNotice){
    addCard.appendChild(el('div',{class:'mock-note', style:'background:rgba(35,159,92,0.08);border-color:var(--brass);color:var(--parchment);'}, state.readingNotice));
  }
  const titleInput = draft('book-title', el('input',{type:'text', placeholder:'Book title', maxlength:'200'}));
  const authorInput = draft('book-author', el('input',{type:'text', placeholder:'Author', maxlength:'200'}));
  const pagesInput = draft('book-pages', el('input',{type:'number', placeholder:'Total pages', min:'1', max:'5000'}));
  const pagesReadInput = draft('book-pages-read', el('input',{type:'number', placeholder:'Pages read so far', min:'0'}));
  const leaningSelect = draft('book-leaning', el('select',{}, LEANINGS.map(l=>el('option',{value:l},l))));

  addCard.appendChild(el('div',{class:'field'},[el('label',{},'Title'), titleInput]));
  addCard.appendChild(el('div',{class:'field'},[el('label',{},'Author'), authorInput]));
  const row2 = el('div',{class:'grid grid-2'},[
    el('div',{class:'field'},[el('label',{},'Total pages'), pagesInput]),
    el('div',{class:'field'},[el('label',{},'Pages read'), pagesReadInput]),
  ]);
  addCard.appendChild(row2);
  addCard.appendChild(el('div',{class:'field'},[el('label',{},'Author ideological leaning'), leaningSelect]));
  // Shown when the catalogue doesn't know the book: a link lets the AI check it's real instead.
  const needLink = state.bookNeedsLink;
  const linkInput = needLink ? draft('book-link', el('input',{type:'url', placeholder:'https://…', maxlength:'500'})) : null;
  if(needLink){
    addCard.appendChild(el('div',{class:'mock-note', style:'border-color:var(--gold);'},[
      el('div',{style:'font-weight:600;margin-bottom:4px;'}, 'We couldn\'t find "'+needLink.title+'" in the catalogue.'),
      el('div',{}, 'If it\'s a real book, paste a link to a page about it — the publisher, Google Books, Goodreads, Amazon, Wikipedia or the author\'s site. The AI will read the page, check the book is real, and add it so nobody else needs a link for it.'),
    ]));
    addCard.appendChild(el('div',{class:'field'},[el('label',{},'Link to the book'), linkInput]));
  }

  const addBtn = el('button',{class:'btn', onclick: async ()=>{
    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const pages = parseInt(pagesInput.value)||0;
    const pagesRead = Math.min(parseInt(pagesReadInput.value)||0, pages||0);
    const link = linkInput ? linkInput.value.trim() : '';
    if(state.user.isGuest){ alert('Create an account to track your reading.'); return; }
    if(!title || !pages){ alert('Enter at least a title and total pages.'); return; }
    if(pages > 5000){ alert('Total pages must be 5000 or fewer.'); return; }
    if(needLink && !/^https?:\/\/\S+\.\S+/i.test(link)){ alert('Paste a full link starting with https:// — or change the title if it was misspelled.'); return; }

    // The server checks and scores the book (with the AI) and awards the points — the browser only sends the facts.
    addBtn.disabled = true; addBtn.textContent = link ? 'The AI is checking the link...' : 'Checking the catalogue...';
    const { data, error, needLink: askForLink } = await callSecure('log_book', { title, author: author || 'Unknown', pages, pagesRead, leaning: leaningSelect.value, link: link || undefined });
    addBtn.disabled = false; addBtn.textContent = needLink ? 'Check link & add book' : 'Add book';
    if(error){
      state.readingNotice = null;
      if(askForLink){ state.bookNeedsLink = { title }; render(); return; }
      alert(error); return;
    }

    const gained = data.elo_gained || 0;
    state.readingNotice = (data.updated ? 'Progress updated on ' : 'Added ') + '"' + data.title + '" by ' + data.author +
      ' — +' + (data.points||0) + ' points, +' + gained + ' Elo.' +
      (data.addedFromLink ? ' The AI checked the link and added this book to the Majlis library.' : '') +
      (data.note ? ' ' + data.note : '') + ((data.notes||[]).length ? ' ' + data.notes.join(' ') : '');
    state.bookNeedsLink = null;
    clearDrafts('book-title', 'book-author', 'book-pages', 'book-pages-read', 'book-leaning', 'book-link');
    await Promise.all([refreshMyProfile(), loadMyBooks()]);
    render();
  }}, needLink ? 'Check link & add book' : 'Add book');
  // Changing the title after a "not found" goes back to a normal catalogue check.
  if(needLink){
    titleInput.addEventListener('input', ()=>{ if(titleInput.value.trim() !== needLink.title){ state.bookNeedsLink = null; render(); } });
  }
  addCard.appendChild(addBtn);
  wrap.appendChild(addCard);

  return wrap;
}

// "Pages read" editor + delete button for one book on your list.
function bookActions(b){
  const wrap = el('div',{style:'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;'});
  if(b.verified){
    const prIn = draft('book-pr-'+b.id, el('input',{type:'number', min:'0', max:String(b.pages), style:'width:84px;padding:5px 8px;font-size:13px;', title:'Pages read'}), String(b.pagesRead));
    const saveBtn = el('button',{class:'btn secondary', style:'padding:5px 10px;font-size:12px;', onclick: async ()=>{
      const n = parseInt(prIn.value);
      if(!Number.isFinite(n) || n < 0){ alert('Enter how many pages you\'ve read.'); return; }
      saveBtn.disabled = true;
      const { data, error } = await sb.rpc('update_book_progress', { p_book_id: b.id, p_pages_read: Math.min(n, b.pages) });
      saveBtn.disabled = false;
      if(error){ alert(friendlyDbError(error, 'Couldn\'t update your progress — please try again.')); return; }
      clearDrafts('book-pr-'+b.id);
      const pts = data.points || 0, elo = data.elo_gained || 0;
      state.readingNotice = pts || elo
        ? 'Updated "'+b.title+'": '+(pts>=0?'+':'')+pts+' points, '+(elo>=0?'+':'')+elo+' Elo.'
        : null;
      await Promise.all([refreshMyProfile(), loadMyBooks()]);
      if(!streak.today) loadStreak(true).then(render);
      render();
    }}, 'Save pages');
    wrap.appendChild(prIn);
    wrap.appendChild(saveBtn);
  }
  wrap.appendChild(el('button',{class:'btn secondary', style:'padding:5px 10px;font-size:12px;color:var(--wine);border-color:var(--wine);', onclick: async ()=>{
    if(!confirm('Delete "'+b.title+'"? The '+b.points+' points and Elo it earned will be removed too.')) return;
    const { error } = await sb.rpc('delete_book', { p_book_id: b.id });
    if(error){ alert(friendlyDbError(error, 'Couldn\'t delete that book — please try again.')); return; }
    clearDrafts('book-pr-'+b.id);
    state.readingNotice = 'Deleted "'+b.title+'".';
    await Promise.all([refreshMyProfile(), loadMyBooks()]);
    render();
  }}, 'Delete'));
  return wrap;
}

function statCard(label, value){
  return el('div',{class:'card'},[
    el('div',{class:'stat-big'}, String(value)),
    el('div',{class:'stat-label'}, label),
  ]);
}

function renderAssessment(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Placement Assessment'));

  if(state.user.placementTaken && !state.quiz.active){
    wrap.appendChild(el('p',{class:'section-sub'},'You have completed the assessment.'));
    const fb = state.user.placementFeedback;
    wrap.appendChild(el('div',{class:'card'},[
      el('h3',{},'Your result'),
      el('div',{class:'stat-big'}, 'Rank #'+state.user.debateRank),
      fb ? el('div',{class:'stat-label', style:'margin-bottom:6px;'},
        'Starting rank '+fb.rank+' of 10 — '+(fb.aiGraded ? 'graded by the AI from your written argument.' : 'estimated from your written argument.')) : null,
      fb && fb.feedback ? el('p',{style:'font-size:13.5px;color:var(--parchment-dim);margin:0 0 10px;'}, fb.feedback) : null,
      el('div',{class:'stat-label'},'Retaking updates your compass, philosophy, and religion results — it won\'t change your rank or points.'),
      el('div',{style:'height:14px'}),
      el('button',{class:'btn secondary', onclick:()=>{
        state.quiz.active = true;
        state.quiz.section = 'philosophy';
        state.quiz.index = 0;
        state.quiz.answers = [];
        render();
      }}, 'Retake Assessment'),
    ]));
    return wrap;
  }

  if(!state.quiz.active){
    wrap.appendChild(el('p',{class:'section-sub'},
      'A philosophy section, then three separate mapping sections — economic, political, and social — each producing its own compass. An optional religion section follows, then a short written statement of your own view. The final written question decides your starting rank (1–10): the AI grades how well you reason, not how much you write.'));
    wrap.appendChild(el('button',{class:'btn', onclick:()=>{
      state.quiz.active = true;
      state.quiz.section = 'philosophy';
      state.quiz.index = 0;
      state.quiz.answers = [];
      render();
    }}, 'Begin Assessment'));
    return wrap;
  }

  const QUIZ_SECTIONS = ['philosophy','economic','political','social'];
  const SECTION_BANK = {
    philosophy: PHIL_QUESTIONS,
    economic: ECONOMIC_QUESTIONS,
    political: POLITICAL_QUESTIONS,
    social: SOCIAL_QUESTIONS,
  };
  const SECTION_LABEL = {
    philosophy: 'Philosophy',
    economic: 'Economic mapping',
    political: 'Political mapping',
    social: 'Social mapping',
  };

  if(QUIZ_SECTIONS.includes(state.quiz.section)){
    const bank = SECTION_BANK[state.quiz.section];
    const item = bank[state.quiz.index];
    const displayIndex = state.quiz.index+1;
    const displayTotal = bank.length;

    wrap.appendChild(el('p',{class:'section-sub'},
      SECTION_LABEL[state.quiz.section]+' — question '+displayIndex+' of '+displayTotal));

    const track = el('div',{class:'progress-track'});
    track.appendChild(el('div',{class:'progress-fill', style:'width:'+Math.round((displayIndex/displayTotal)*100)+'%'}));
    wrap.appendChild(track);
    wrap.appendChild(el('div',{style:'height:20px'}));

    const card = el('div',{class:'card'});
    card.appendChild(el('div',{class:'quiz-q'}, item.q));
    const optsWrap = el('div',{class:'quiz-opts'});
    item.opts.forEach((opt)=>{
      optsWrap.appendChild(el('button',{class:'quiz-opt', onclick:()=>{
        state.quiz.answers.push({section: state.quiz.section, axis: item.axis || null, q: item.q, choice: opt});
        if(displayIndex >= displayTotal){
          const nextIdx = QUIZ_SECTIONS.indexOf(state.quiz.section) + 1;
          if(nextIdx < QUIZ_SECTIONS.length){
            state.quiz.section = QUIZ_SECTIONS[nextIdx];
            state.quiz.index = 0;
          } else {
            state.quiz.section = 'religion-pick';
          }
        } else {
          state.quiz.index += 1;
        }
        render();
      }}, opt));
    });
    card.appendChild(optsWrap);
    wrap.appendChild(card);
    return wrap;
  }

  if(state.quiz.section === 'religion-pick'){
    wrap.appendChild(el('p',{class:'section-sub'}, 'Optional — helps the AI understand your worldview more precisely. Skip if you\'d rather not say.'));
    const card = el('div',{class:'card'});
    card.appendChild(el('div',{class:'quiz-q'}, 'Which best describes your religious or spiritual identity?'));
    const optsWrap = el('div',{class:'quiz-opts'});
    RELIGIONS.forEach((r)=>{
      optsWrap.appendChild(el('button',{class:'quiz-opt', onclick:()=>{
        state.quiz.religion = r;
        state.quiz.answers.push({section:'religion', axis:null, q:'Which best describes your religious or spiritual identity?', choice:r});
        const followups = RELIGION_QUESTIONS[r];
        if(followups && followups.length){
          state.quiz.section = 'religion-followup';
          state.quiz.index = 0;
        } else {
          state.quiz.section = 'written';
        }
        render();
      }}, r));
    });
    card.appendChild(optsWrap);
    wrap.appendChild(card);
    wrap.appendChild(el('div',{style:'height:12px'}));
    wrap.appendChild(el('button',{class:'btn secondary', onclick:()=>{ state.quiz.section = 'written'; render(); }}, 'Skip this section'));
    return wrap;
  }

  if(state.quiz.section === 'religion-followup'){
    const bank = RELIGION_QUESTIONS[state.quiz.religion] || [];
    const item = bank[state.quiz.index];
    const displayIndex = state.quiz.index+1;
    const displayTotal = bank.length;

    wrap.appendChild(el('p',{class:'section-sub'}, state.quiz.religion+' — question '+displayIndex+' of '+displayTotal));
    const track = el('div',{class:'progress-track'});
    track.appendChild(el('div',{class:'progress-fill', style:'width:'+Math.round((displayIndex/displayTotal)*100)+'%'}));
    wrap.appendChild(track);
    wrap.appendChild(el('div',{style:'height:20px'}));

    const card = el('div',{class:'card'});
    card.appendChild(el('div',{class:'quiz-q'}, item.q));
    const optsWrap = el('div',{class:'quiz-opts'});
    item.opts.forEach((opt)=>{
      optsWrap.appendChild(el('button',{class:'quiz-opt', onclick:()=>{
        state.quiz.answers.push({section:'religion-detail', axis:null, q:item.q, choice:opt});
        if(displayIndex >= displayTotal){
          state.quiz.section = 'written';
        } else {
          state.quiz.index += 1;
        }
        render();
      }}, opt));
    });
    card.appendChild(optsWrap);
    wrap.appendChild(card);
    wrap.appendChild(el('div',{style:'height:12px'}));
    wrap.appendChild(el('button',{class:'btn secondary', onclick:()=>{ state.quiz.section = 'written'; render(); }},
      displayIndex > 1 ? 'Skip the rest of this section' : 'Skip this section'));
    wrap.appendChild(el('p',{class:'field-caption', style:'margin-top:8px;'},
      'The more you answer, the more precisely the AI can place you within your tradition.'));
    return wrap;
  }

  if(state.quiz.section === 'written'){
    wrap.appendChild(el('p',{class:'section-sub'},
      'State a position you hold and make your strongest case for it, in your own words. This decides your starting rank (1–10): the AI looks for clear reasons, evidence or examples, and whether you deal with the best objection to your view. Length alone doesn\'t help.'));
    const card = el('div',{class:'card'});
    const positionIn = draft('assessment-position', el('input',{type:'text', placeholder:'e.g. Markets should be lightly regulated', maxlength:'200'}));
    const viewBox = draft('assessment-case', el('textarea',{placeholder:'Why you hold this position...', style:'min-height:160px;'}));
    card.appendChild(el('div',{class:'field'},[el('label',{},'A position you hold'), positionIn]));
    card.appendChild(el('div',{class:'field'},[el('label',{},'Your case for it'), viewBox]));
    const submitBtn = el('button',{class:'btn', onclick: async ()=>{
      const position = positionIn.value.trim();
      const viewText = viewBox.value.trim();
      if(position.length < 3){
        alert('State the position you hold first.');
        return;
      }
      if(viewText.length < 80){
        alert('Write a bit more — at least a few sentences.');
        return;
      }
      submitBtn.disabled = true; submitBtn.textContent = 'Analysing...';
      await finishAssessment(position, viewText);
      if(document.body.contains(submitBtn)){ submitBtn.disabled = false; submitBtn.textContent = 'Submit & get ranked'; }
    }}, 'Submit & get ranked');
    card.appendChild(submitBtn);
    wrap.appendChild(card);
    return wrap;
  }
}


const COMPASS_DEFS = {
  economic: {
    title: 'Economic Compass',
    xLabels: ['Left','Right'], yLabels: ['Interventionist','Laissez-faire'],
    quads: { tl:'Socialist', tr:'Corporatist', bl:'Communalist', br:'Free-Market Capitalist' },
  },
  political: {
    title: 'Political Compass',
    xLabels: ['Nationalist','Globalist'], yLabels: ['Authoritarian','Libertarian'],
    quads: { tl:'Nationalist-Authoritarian', tr:'Technocratic Globalist', bl:'Sovereigntist Libertarian', br:'Cosmopolitan Libertarian' },
  },
  social: {
    title: 'Social Compass',
    xLabels: ['Traditional','Progressive'], yLabels: ['Collectivist','Individualist'],
    quads: { tl:'Traditionalist Communitarian', tr:'Progressive Communitarian', bl:'Conservative Individualist', br:'Liberal Individualist' },
  },
};

function axisScoreToPct(sum, questionCount){
  const max = questionCount * 3;
  return Math.max(0, Math.min(100, Math.round(50 + (sum/max)*50)));
}

function computeAxisPair(answers, section){
  const secAnswers = answers.filter(a=>a.section===section);
  const bank = section==='economic' ? ECONOMIC_QUESTIONS : section==='political' ? POLITICAL_QUESTIONS : SOCIAL_QUESTIONS;
  let xSum = 0, xCount = 0, ySum = 0, yCount = 0;
  secAnswers.forEach(a=>{
    const q = bank.find(b=>b.q===a.q);
    if(!q) return;
    const optIndex = q.opts.indexOf(a.choice);
    if(optIndex === -1) return;
    const value = -3 + optIndex*2; // 0->-3, 1->-1, 2->1, 3->3
    if(q.axis==='x'){ xSum += value; xCount++; } else { ySum += value; yCount++; }
  });
  return {
    x: axisScoreToPct(xSum, xCount || 15),
    y: axisScoreToPct(ySum, yCount || 15),
  };
}

function computeThreeCompasses(answers){
  return {
    economic: computeAxisPair(answers, 'economic'),
    political: computeAxisPair(answers, 'political'),
    social: computeAxisPair(answers, 'social'),
  };
}

function deriveQuadrantIdeology(section, pair){
  const def = COMPASS_DEFS[section];
  const isRight = pair.x >= 50;
  const isTop = pair.y >= 50;
  if(isTop && !isRight) return def.quads.tl;
  if(isTop && isRight) return def.quads.tr;
  if(!isTop && !isRight) return def.quads.bl;
  return def.quads.br;
}

function deriveArchetype(answers){
  // Philosophical archetype, derived only from the philosophy section, independent of the three compasses.
  const philAnswers = answers.filter(a=>a.section==='philosophy');
  let epistemic = 0;
  philAnswers.forEach(a=>{
    const bank = PHIL_QUESTIONS.find(q=>q.q===a.q);
    if(!bank) return;
    const optIndex = bank.opts.indexOf(a.choice);
    if(optIndex === -1) return;
    epistemic += (2 - optIndex);
  });
  const freeWillAnswer = philAnswers.find(a=>/free will/i.test(a.q));
  const moralityAnswer = philAnswers.find(a=>/morality discovered/i.test(a.q));

  if(epistemic <= -8) return 'Empiricist';
  if(moralityAnswer && /Invented/i.test(moralityAnswer.choice)) return 'Existentialist';
  if(freeWillAnswer && /incoherent/i.test(freeWillAnswer.choice)) return 'Skeptic';
  if(epistemic >= 20) return 'Rationalist';
  if(epistemic >= 8) return 'Utilitarian';
  return 'Stoic';
}

async function aiAnalyzeAssessment(answers){
  const bySection = (name) => answers.filter(a=>a.section===name).map(a=>({ q: a.q, choice: a.choice }));
  const religionAnswer = answers.find(a=>a.section==='religion');
  const payload = {
    action: 'analyze_assessment',
    sections: {
      economic: { xLabels: COMPASS_DEFS.economic.xLabels, yLabels: COMPASS_DEFS.economic.yLabels, answers: bySection('economic') },
      political: { xLabels: COMPASS_DEFS.political.xLabels, yLabels: COMPASS_DEFS.political.yLabels, answers: bySection('political') },
      social: { xLabels: COMPASS_DEFS.social.xLabels, yLabels: COMPASS_DEFS.social.yLabels, answers: bySection('social') },
      philosophy: { answers: bySection('philosophy') },
    },
    religion: religionAnswer ? religionAnswer.choice : null,
    religionAnswers: bySection('religion-detail'),
  };
  try {
    const { data, error } = await sb.functions.invoke('ai-assist', { body: payload, region: FN_REGION });
    if(error || !data || data.error) throw new Error((data && data.error) || 'AI analysis unavailable');
    const clampPair = (p) => ({ x: Math.max(0, Math.min(100, Math.round(p.x))), y: Math.max(0, Math.min(100, Math.round(p.y))) });
    return {
      aiAnalyzed: true,
      archetype: data.archetype,
      archetypeReasoning: data.archetypeReasoning || '',
      religion: payload.religion,
      denomination: data.denomination || null,
      denominationReasoning: data.denominationReasoning || '',
      compass: {
        economic: clampPair(data.economic),
        political: clampPair(data.political),
        social: clampPair(data.social),
      },
      ideologies: {
        economic: { label: data.economic.ideology, reasoning: data.economic.reasoning || '' },
        political: { label: data.political.ideology, reasoning: data.political.reasoning || '' },
        social: { label: data.social.ideology, reasoning: data.social.reasoning || '' },
      },
    };
  } catch(e){
    console.warn('AI assessment analysis unavailable, using local scoring:', e);
    const compass = computeThreeCompasses(answers);
    return {
      aiAnalyzed: false,
      archetype: deriveArchetype(answers),
      archetypeReasoning: '',
      religion: payload.religion,
      denomination: null,
      denominationReasoning: '',
      compass,
      ideologies: {
        economic: { label: deriveQuadrantIdeology('economic', compass.economic), reasoning: '' },
        political: { label: deriveQuadrantIdeology('political', compass.political), reasoning: '' },
        social: { label: deriveQuadrantIdeology('social', compass.social), reasoning: '' },
      },
    };
  }
}

function computePhilosophyScore(answers){
  // Reduces the philosophy section to a single 0-100 number so it can be compared
  // for matchmaking, independent of whatever label the AI gives it.
  const philAnswers = answers.filter(a=>a.section==='philosophy');
  let epistemic = 0;
  philAnswers.forEach(a=>{
    const bank = PHIL_QUESTIONS.find(q=>q.q===a.q);
    if(!bank) return;
    const optIndex = bank.opts.indexOf(a.choice);
    if(optIndex === -1) return;
    epistemic += (2 - optIndex);
  });
  const maxAbs = (philAnswers.length || 1) * 2;
  return Math.max(0, Math.min(100, Math.round(50 + (epistemic/maxAbs)*50)));
}

// Guests aren't saved, so their starting rank is estimated here (the real one is graded by the AI on the server).
function localPlacementRank(text){
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  let rank = 1;
  if(words >= 40) rank++;
  if(words >= 90) rank++;
  if(/\b(because|since|therefore|thus|so that|it follows)\b/i.test(text)) rank++;
  if(/\b(however|although|critics|objection|one might argue|on the other hand|counter)\b/i.test(text)) rank++;
  return Math.min(5, rank);
}

async function finishAssessment(position, viewText){
  const signedIn = !state.user.isGuest && state.user.id;
  // The AI compass analysis and the AI grading of your written case run at the same time.
  const [analysis, placement] = await Promise.all([
    aiAnalyzeAssessment(state.quiz.answers),
    signedIn ? callSecure('submit_placement', { position, case: viewText }) : Promise.resolve(null),
  ]);
  const philosophyScore = computePhilosophyScore(state.quiz.answers);

  if(signedIn){
    // The server grades what you wrote (rank 1–10); on a retake it leaves your rank alone.
    if(placement.error){
      alert(placement.error);
      return;
    }
    state.user.placementFeedback = placement.data.retake ? null : {
      rank: placement.data.rank, feedback: placement.data.feedback || '', aiGraded: !!placement.data.aiGraded,
    };
    const { error: ideologyErr } = await sb.rpc('save_ideology_vector', {
      p_econ_x: analysis.compass.economic.x, p_econ_y: analysis.compass.economic.y,
      p_pol_x: analysis.compass.political.x, p_pol_y: analysis.compass.political.y,
      p_soc_x: analysis.compass.social.x, p_soc_y: analysis.compass.social.y,
      p_phil_score: philosophyScore,
      p_religion: analysis.religion || null,
      p_denomination: analysis.denomination || null,
      p_econ_label: analysis.ideologies.economic.label,
      p_pol_label: analysis.ideologies.political.label,
      p_soc_label: analysis.ideologies.social.label,
      p_archetype: analysis.archetype || null,
    });
    if(ideologyErr){
      console.warn('save_ideology_vector failed:', ideologyErr);
      alert('Your result is shown below, but it couldn\'t be saved for others to see (a sync error occurred). You can try retaking the assessment in a moment.');
    }
    await refreshMyProfile();
  } else {
    // Guests aren't saved anywhere, so their placement is only calculated for this visit.
    const startRank = localPlacementRank(viewText);
    state.user.placementFeedback = { rank: startRank, feedback: 'Guest estimate — create an account to have the AI grade your argument.', aiGraded: false };
    state.user.debatePoints = cumulativePointsForRank(startRank);
    state.user.debateRank = rankFromPoints(state.user.debatePoints);
  }

  // The AI's written reasoning isn't stored in the database, so attach this session's full result.
  state.user.placementTaken = true;
  state.user.compass = analysis.compass;
  state.user.archetype = analysis.archetype;
  state.user.archetypeReasoning = analysis.archetypeReasoning;
  state.user.ideologies = analysis.ideologies;
  state.user.ideologyAiAnalyzed = analysis.aiAnalyzed;
  state.user.religion = analysis.religion;
  state.user.denomination = analysis.denomination;
  state.user.denominationReasoning = analysis.denominationReasoning;
  state.user.philosophyScore = philosophyScore;

  clearDrafts('assessment-position', 'assessment-case');
  state.quiz.active = false;
  state.tab = 'assessment';
  render();
}

function otherParticipant(debate){ return debate.participants.find(u=>u!==state.currentUser); }
function rivalOf(debate){
  const u = state.users[otherParticipant(debate)];
  return u && u.isAi ? u : null;
}

// Ask the AI rival for its next message. The server decides if it's the rival's turn,
// so calling this more often than needed is harmless.
async function requestRivalTurn(debate, isRetry){
  if(!rivalOf(debate) || debate._rivalTyping || debate.verdict || debate.status === 'ended') return;
  if(!isRetry) debate._rivalRetries = 0;
  debate._rivalTyping = true;
  render();
  let res;
  try { res = await callSecure('rival_turn', { debateId: debate.id }); }
  finally { debate._rivalTyping = false; }
  const m = res && res.data && res.data.message;
  // The AI was busy or the call failed: try again by itself instead of waiting for the next message.
  const skipped = res && res.data && res.data.skipped;
  if(!m && (res && res.error || skipped === 'ai' || skipped === 'busy')){
    debate._rivalRetries = (debate._rivalRetries || 0) + 1;
    if(debate._rivalRetries <= 6){
      debate._rivalTyping = true;   // keep the dots up while we wait
      render();
      setTimeout(() => {
        debate._rivalTyping = false;
        const d = state.debates[debate.id];
        if(d && !d.verdict && d.status !== 'ended') requestRivalTurn(d, true);
      }, 3000 * debate._rivalRetries);
      return;
    }
  }
  if(m) debate._rivalRetries = 0;
  if(m && !debate.chatLog.some(x => x.id === m.id)){
    debate.chatLog.push({ id: m.id, author: m.author, text: m.text });
  }
  if(res && res.data && res.data.message){
    // The rival may also have asked to wrap up; pick that up.
    const { data: row } = await sb.from('debates').select('end_request').eq('id', debate.id).maybeSingle();
    if(row) debate.endRequest = row.end_request || null;
  }
  render();
}

// The rival opens if the player hasn't said anything a few seconds after the topic is set.
function maybeRivalOpens(debate){
  if(!rivalOf(debate) || debate._rivalOpenTimer || debate.chatLog.length || topicPhaseActive(debate) || debate.verdict) return;
  debate._rivalOpenTimer = setTimeout(() => {
    const d = state.debates[debate.id];
    if(d && !d.chatLog.length && !d.verdict) requestRivalTurn(d);
  }, 7000);
}

let debatePollTimer = null;
let debateChannel = null;

function idToUsernameMap(){
  const m = {};
  Object.values(state.users).forEach(u => { if(u.id) m[u.id] = u.username; });
  return m;
}

async function enterDebate(debateId){
  stopDebatePolling();
  const { data: debate, error } = await sb.from('debates').select('*').eq('id', debateId).single();
  if(error || !debate) return;
  const { data: msgs } = await sb.from('debate_messages').select('*').eq('debate_id', debateId).order('created_at', { ascending: true });
  let idToUsername = idToUsernameMap();
  if(!idToUsername[debate.participant1_id] || !idToUsername[debate.participant2_id]){
    await loadAllProfiles();   // opponent signed up after this page loaded
    idToUsername = idToUsernameMap();
  }
  const p1 = idToUsername[debate.participant1_id], p2 = idToUsername[debate.participant2_id];
  state.debates[debateId] = {
    id: debate.id, mode: debate.mode, topic: debate.topic, unranked: debate.unranked,
    participants: [p1, p2].filter(Boolean),
    chatLog: (msgs||[]).map(m => ({ id: m.id, author: idToUsername[m.author_id] || 'Unknown', text: m.text })),
    verdict: debate.verdict, status: debate.status,
    createdAt: debate.created_at ? new Date(debate.created_at).getTime() : Date.now(),
    endRequest: debate.end_request || null,
    topicVotes: debate.topic_votes || {},
    topicLocked: debate.topic_locked !== false,   // older databases without the topic step: never block the chat
    label: debate.label || null,
  };
  state.user.activeDebateId = debateId;
  subscribeToDebate(debateId);
  warmFunctions();
  render();
}

function subscribeToDebate(debateId){
  if(debateChannel){ sb.removeChannel(debateChannel); debateChannel = null; }
  debateChannel = sb.channel('debate-'+debateId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'debate_messages', filter: 'debate_id=eq.'+debateId }, (payload) => {
      const idToUsername = idToUsernameMap();
      const d = state.debates[debateId];
      if(!d) return;
      const m = payload.new;
      if(d.chatLog.some(x => x.id === m.id)) return;   // already on screen
      const author = idToUsername[m.author_id] || 'Unknown';
      // Our own message that we already showed? Just confirm it instead of adding a duplicate.
      const mine = d.chatLog.find(x => x.pending && !x.id && x.author === author && x.text === m.text);
      if(mine){ mine.id = m.id; mine.pending = false; }
      else d.chatLog.push({ id: m.id, author, text: m.text });
      render();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'debates', filter: 'id=eq.'+debateId }, (payload) => {
      const d = state.debates[debateId];
      if(!d) return;
      d.verdict = payload.new.verdict;
      d.status = payload.new.status;
      if('end_request' in payload.new) d.endRequest = payload.new.end_request;
      if('topic_votes' in payload.new) d.topicVotes = payload.new.topic_votes || {};
      if('topic_locked' in payload.new) d.topicLocked = payload.new.topic_locked !== false;
      if(payload.new.topic) d.topic = payload.new.topic;
      if(payload.new.label) d.label = payload.new.label;
      if(d.status === 'ended'){
        teardownVideoCall();
        Promise.all([refreshMyProfile(), loadDebateHistory()]).then(render);
      }
      render();
    })
    .subscribe();
}

let labelRequested = false;
// Your finished debates, read from the database (previously kept only in this browser).
async function loadDebateHistory(){
  if(!state.user || state.user.isGuest || !state.user.id) return;
  const me = state.user.id;
  const query = (cols) => sb.from('debates').select(cols)
    .eq('status', 'ended')
    .or('participant1_id.eq.'+me+',participant2_id.eq.'+me)
    .order('created_at', { ascending: false })
    .limit(50);
  let { data, error } = await query('id, topic, label, mode, unranked, verdict, winner_id, participant1_id, participant2_id, created_at');
  if(error && /label/.test(error.message || '')){   // database not updated yet
    ({ data, error } = await query('id, topic, mode, unranked, verdict, winner_id, participant1_id, participant2_id, created_at'));
    if(data) data.forEach(d => { d.label = d.topic || 'Open topic'; });
  }
  if(error){ console.warn('loadDebateHistory failed', error); return; }
  // Older debates finished before the AI named them — ask for names once, in the background.
  const unnamed = (data||[]).filter(d => !d.label).map(d => d.id).slice(0, 8);
  if(unnamed.length && !labelRequested){
    labelRequested = true;
    callSecure('label_debates', { debateIds: unnamed }).then(({ data: res }) => {
      if(res && res.labels && Object.keys(res.labels).length) loadDebateHistory().then(render);
    });
  }
  const idToUsername = idToUsernameMap();
  state.user.debateHistory = (data||[]).map(d => {
    const opponentId = d.participant1_id === me ? d.participant2_id : d.participant1_id;
    const winnerName = d.verdict && d.verdict.winner;
    const won = d.winner_id ? d.winner_id === me : winnerName === state.currentUser;
    const noContest = !d.winner_id && !winnerName;
    const isDraw = noContest && d.verdict && d.verdict.aiJudged;
    return {
      topic: debateTitle(d), mode: d.mode, unranked: !!d.unranked,
      opponent: idToUsername[opponentId] || 'a former member',
      result: isDraw ? 'draw' : noContest ? 'none' : (won ? 'win' : 'loss'),
    };
  });
}

// Debates that ended before anyone argued got placeholder names from the judge; show something sensible instead.
const JUNK_LABEL = /too short to name|unstarted|no substantive|no real debate|ended early|insufficient|no discussion/i;
function debateTitle(d){
  const label = d.label || (d.verdict && d.verdict.label) || '';
  const topic = d.topic && !/^open topic$/i.test(d.topic) ? d.topic : '';
  if(label && !JUNK_LABEL.test(label)) return label;
  if(topic && !JUNK_LABEL.test(topic)) return topic;
  return 'Ended before it got going';
}

function stopDebatePolling(){
  if(debatePollTimer){ clearInterval(debatePollTimer); debatePollTimer = null; }
}

async function tryMatchDebate(mode, topic, unranked){
  const { data, error } = await sb.rpc('try_match_debate', { p_mode: mode, p_topic: topic||'', p_unranked: !!unranked });
  if(error){ console.warn('try_match_debate failed', error); return; }
  if(data){
    state.debateQueue[mode] = (state.debateQueue[mode]||[]).filter(e=>e.username!==state.currentUser);
    state.tab = 'debate';   // you may have queued from Home
    await enterDebate(data);
  }
}

// Look for a real person first; after 20 seconds with nobody, text debates get an AI rival.
const RIVAL_AFTER_MS = 20000;
let rivalStarting = false;
function queueEntry(mode){ return (state.debateQueue[mode]||[]).find(e=>e.username===state.currentUser) || null; }

async function startRivalDebate(mode, topic, unranked){
  if(rivalStarting) return;
  rivalStarting = true;
  try {
    const { data, error } = await callSecure('start_rival_debate', { mode, topic: topic || '', unranked: !!unranked });
    if(!queueEntry(mode)) return;   // cancelled meanwhile
    if(error){ alert(error); await cancelQueue(mode); return; }
    state.debateQueue[mode] = (state.debateQueue[mode]||[]).filter(e=>e.username!==state.currentUser);
    stopDebatePolling();
    state.tab = 'debate';
    await loadAllProfiles();   // the rival may be brand new
    await enterDebate(data.debateId);
  } finally {
    rivalStarting = false;
  }
}

function startDebatePolling(mode, topic, unranked){
  stopDebatePolling();
  debatePollTimer = setInterval(() => {
    const entry = queueEntry(mode);
    if(!entry || state.user.activeDebateId){ stopDebatePolling(); return; }
    document.querySelectorAll('[data-queue-seconds]').forEach(n => { n.textContent = queueSearchText(mode); });
    if(mode === 'Text' && Date.now() - (entry.since || Date.now()) >= RIVAL_AFTER_MS){
      stopDebatePolling();
      startRivalDebate(mode, topic, unranked);
      return;
    }
    // Audio and video need a real person. After 20 seconds with nobody, offer a text debate instead.
    if(mode !== 'Text' && !entry.offered && Date.now() - (entry.since || Date.now()) >= RIVAL_AFTER_MS){
      entry.offered = true;
      render();
    }
    tryMatchDebate(mode, topic, unranked);
  }, 1000);
}

function queueSearchText(mode){
  const entry = queueEntry(mode);
  if(!entry) return '';
  const secs = Math.floor((Date.now() - (entry.since || Date.now())) / 1000);
  return 'Looking for a '+mode.toLowerCase()+' opponent… '+secs+'s';
}

async function queueForMatch(mode, topic, unranked){
  if(state.user.isGuest){ alert('Create an account to debate.'); return; }
  state.debateQueue[mode] = state.debateQueue[mode] || [];
  if(!state.debateQueue[mode].some(e=>e.username===state.currentUser)){
    state.debateQueue[mode].push({ username: state.currentUser, topic, unranked: !!unranked, since: Date.now() });
  }
  render();
  await tryMatchDebate(mode, topic, unranked);
  if(!state.user.activeDebateId){
    startDebatePolling(mode, topic, unranked);
  }
}

const DEBATE_MODES = ['Text', 'Audio', 'Video'];

async function switchQueueToText(mode){
  const entry = queueEntry(mode);
  const topic = entry ? entry.topic : '', unranked = entry ? entry.unranked : false;
  await cancelQueue(mode);
  await queueForMatch('Text', topic, unranked);
}
function keepWaiting(mode){
  const entry = queueEntry(mode);
  if(entry){ entry.offerDismissed = true; render(); }
}

// "Looking for an opponent…" with a timer and, for audio/video after 20s, the switch-to-text offer.
function queueStatusNode(mode){
  const entry = queueEntry(mode);
  const box = el('div',{class:'queue-box'},[
    el('div',{class:'queue-status'},[
      el('span',{class:'end-panel__dot'}),
      el('span',{'data-queue-seconds':'1'}, queueSearchText(mode)),
      el('button',{class:'linkbtn', onclick:()=>cancelQueue(mode)}, 'Cancel'),
    ]),
  ]);
  if(entry && entry.offered && !entry.offerDismissed){
    box.appendChild(el('div',{class:'queue-offer'},[
      el('div',{class:'queue-offer__text'},[
        el('strong',{}, 'No one is free for a ' + mode.toLowerCase() + ' debate right now.'),
        el('span',{}, ' Want to try a text debate instead? You\'ll be matched within about 20 seconds.'),
      ]),
      el('div',{class:'queue-offer__actions'},[
        el('button',{class:'btn', onclick:()=>switchQueueToText(mode)}, 'Switch to text'),
        el('button',{class:'btn secondary', onclick:()=>keepWaiting(mode)}, 'Keep waiting'),
      ]),
    ]));
  }
  return box;
}

async function cancelQueue(mode){
  state.debateQueue[mode] = (state.debateQueue[mode]||[]).filter(e=>e.username!==state.currentUser);
  stopDebatePolling();
  render();
  if(state.user && state.user.id){
    await sb.from('debate_queue').delete().eq('user_id', state.user.id).eq('mode', mode);
  }
}

// If the person already has an active debate waiting server-side (e.g. after a refresh), rejoin it.
// Throttled, because renderDebate() calls it and render() runs often.
let lastActiveDebateCheck = 0;
async function checkForActiveDebate(){
  if(!state.user || state.user.isGuest || !state.user.id || state.user.activeDebateId) return;
  if(Date.now() - lastActiveDebateCheck < 5000) return;
  lastActiveDebateCheck = Date.now();
  const { data } = await sb.from('debates').select('id').eq('status','active')
    .or('participant1_id.eq.'+state.user.id+',participant2_id.eq.'+state.user.id)
    .order('created_at', { ascending: false }).limit(1);
  if(data && data.length){
    await enterDebate(data[0].id);
  }
}

function renderDebate(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Debate'));

  if(!state.user.placementTaken){
    wrap.appendChild(el('p',{class:'section-sub'},'Take the placement assessment first so you can be matched by rank.'));
    wrap.appendChild(el('button',{class:'btn', onclick:()=>navigateWithLoading('assessment')},'Go to Assessment'));
    return wrap;
  }

  if(state.user.activeDebateId && state.debates[state.user.activeDebateId]){
    const active = state.debates[state.user.activeDebateId];
    // An ended debate with no verdict can't be shown — let go of it rather than trapping the user.
    if(active.status === 'ended' && !active.verdict){
      const staleId = state.user.activeDebateId;
      state.user.activeDebateId = null;
      delete state.debates[staleId];
    } else {
      return renderChatRoom(active);
    }
  }
  checkForActiveDebate();

  wrap.appendChild(el('p',{class:'section-sub'},
    'You\'re paired with whoever in the queue disagrees with you the most, across your economic, political, social, philosophical and religious views, so debates are never one-sided from the start.'));

  const topicInput = draft('debate-topic', el('input',{type:'text', placeholder:'Proposed topic (optional)', maxlength:'200'}));
  const queuedMode = DEBATE_MODES.find(m => queueEntry(m));

  const arena = el('div',{class:'arena'});
  const stage = el('section',{class:'arena-stage'});
  stage.appendChild(neonM('arena-stage__m'));
  stage.appendChild(el('div',{class:'kicker'}, queuedMode ? 'Searching' : 'Pick your arena'));
  stage.appendChild(el('h3',{class:'arena-stage__title'}, queuedMode ? 'Finding your opponent…' : 'How do you want to argue?'));
  if(queuedMode){
    stage.appendChild(queueStatusNode(queuedMode));
  } else {
    stage.appendChild(el('div',{class:'field', style:'max-width:520px;'},[el('label',{},'Topic'), topicInput]));
    const MODE_INFO = {
      Text:  ['forum', 'Text', 'Typed live chat. If nobody is free within 20 seconds, you get an AI rival.'],
      Audio: ['mic', 'Audio', 'Voice only, no camera. Your words are transcribed for the judge.'],
      Video: ['video', 'Video', 'Face to face on camera. Your words are transcribed for the judge.'],
    };
    stage.appendChild(el('div',{class:'mode-grid'}, DEBATE_MODES.map(mode => {
      const [ic, name, desc] = MODE_INFO[mode];
      return el('button',{class:'mode-tile' + (mode === 'Text' ? ' is-primary' : ''), onclick:()=>queueForMatch(mode, topicInput.value.trim(), false)},[
        el('span',{class:'mode-tile__icon'}, icon(ic, 22)),
        el('span',{class:'mode-tile__name'}, name),
        el('span',{class:'mode-tile__desc'}, desc),
        el('span',{class:'mode-tile__go'}, ['Find a match', icon('arrow', 14)]),
      ]);
    })));
  }
  arena.appendChild(stage);

  // Right: debates happening now between real people.
  const side = el('aside',{class:'arena-side'});
  const streams = (state.liveStreams || []).filter(x => x.a !== state.currentUser && x.b !== state.currentUser);
  if(streams.length){
    side.appendChild(el('div',{class:'panel-head'},[el('span',{class:'eyebrow'},'Streaming now')]));
    streams.forEach(x => side.appendChild(el('div',{class:'live-row is-stream'},[
      el('span',{class:'live-badge'},[el('span',{class:'live-dot'}), 'LIVE']),
      el('div',{class:'live-row__main'},[el('div',{class:'live-row__topic'}, x.topic), el('div',{class:'live-row__who'}, x.a + ' vs ' + x.b + ' · ' + x.mode)]),
      el('button',{class:'btn', onclick:()=>startWatching(x)}, 'Watch'),
    ])));
    side.appendChild(el('div',{style:'height:18px'}));
  }
  side.appendChild(el('div',{class:'panel-head'},[el('span',{class:'eyebrow'},'Live now')]));
  loadLiveDebates();
  const live = (state.liveDebates || []);
  if(!live.length){
    side.appendChild(el('p',{class:'empty-note'}, state.liveDebatesLoaded ? 'No live debates right now. Start one and you\'ll be first.' : 'Checking…'));
  } else {
    live.forEach(d => side.appendChild(el('div',{class:'live-row'},[
      el('span',{class:'live-dot'}),
      el('div',{class:'live-row__main'},[
        el('div',{class:'live-row__topic'}, d.topic),
        el('div',{class:'live-row__who'}, d.a + ' vs ' + d.b),
      ]),
      el('span',{class:'live-row__meta'}, d.mode + ' · ' + d.mins + 'm'),
    ])));
  }
  side.appendChild(el('button',{class:'majlis-teaser', onclick:()=>navigateWithLoading('majlis')},[
    el('span',{class:'eyebrow'},'The Majlis'),
    el('span',{class:'majlis-teaser__title'},'Topic now: ' + majlisQuestion()),
    el('span',{class:'majlis-teaser__go'},['Take a seat', icon('arrow', 14)]),
  ]));
  arena.appendChild(side);
  wrap.appendChild(arena);

  return wrap;
}

// Active debates between real people (never AI rivals), refreshed at most every 20 seconds.
let liveDebatesAt = 0;
async function loadLiveDebates(){
  if(Date.now() - liveDebatesAt < 20000) return;
  liveDebatesAt = Date.now();
  const { data, error } = await sb.from('debates').select('id, topic, label, mode, participant1_id, participant2_id, created_at')
    .eq('status', 'active').order('created_at', { ascending: false }).limit(20);
  const byId = {};
  Object.values(state.users).forEach(u => { if(u.id) byId[u.id] = u; });
  const rows = error ? [] : (data || []).filter(d => {
    const a = byId[d.participant1_id], b = byId[d.participant2_id];
    return a && b && !a.isAi && !b.isAi && a.username !== state.currentUser && b.username !== state.currentUser;
  }).slice(0, 6).map(d => ({
    topic: d.label || d.topic || 'Open topic', mode: d.mode || 'Text',
    a: byId[d.participant1_id].username, b: byId[d.participant2_id].username,
    mins: Math.max(1, Math.round((Date.now() - new Date(d.created_at).getTime()) / 60000)),
  }));
  const changed = JSON.stringify(rows) !== JSON.stringify(state.liveDebates || []) || !state.liveDebatesLoaded;
  state.liveDebates = rows; state.liveDebatesLoaded = true;
  if(changed && state.tab === 'debate' && !state.user.activeDebateId) render();
}

/* ================= ACTIVITY (moderators) — Update 16 ================= */
// Tell the server this person is using the site: at most once every 4 minutes, only while the tab is open.
let lastActivityTouch = 0;
function touchActivity(){
  if(!state.user || state.user.isGuest || !state.user.id || document.hidden) return;
  if(Date.now() - lastActivityTouch < 240000) return;
  lastActivityTouch = Date.now();
  sb.rpc('touch_activity').then(({ error }) => { if(error) console.warn('touch_activity failed', error); });
}
setInterval(touchActivity, 60000);
document.addEventListener('visibilitychange', touchActivity);

async function loadActivityStats(){
  state.activityLoading = true;
  const { data, error } = await sb.rpc('mod_activity_stats');
  state.activityLoading = false;
  state.activityStats = error ? { error: friendlyDbError(error, 'Couldn\'t load activity.') } : data;
  state.activityAt = Date.now();
  if(state.tab === 'activity') render();
}

function renderActivity(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Activity'));
  if(!canModerate()){
    wrap.appendChild(el('p',{class:'section-sub'},'Only moderators can see this page.'));
    return wrap;
  }
  wrap.appendChild(el('p',{class:'section-sub'},'How many different people are using Majlis. Each person counts once, however many pages they open. AI rivals are never counted.'));
  if(!state.activityStats && !state.activityLoading) loadActivityStats();
  const st = state.activityStats;
  wrap.appendChild(el('button',{class:'btn secondary', style:'margin-bottom:18px;', onclick: loadActivityStats}, state.activityLoading ? 'Loading…' : 'Refresh'));
  if(!st){ wrap.appendChild(el('div',{class:'spinner-wrap'}, el('div',{class:'spinner'}))); return wrap; }
  if(st.error){ wrap.appendChild(el('p',{class:'field-caption warn'}, st.error)); return wrap; }

  const tiles = [['Online now', st.now, 'active in the last 5 minutes'], ['Last hour', st.hour, 'different people'], ['Today', st.today, (st.newToday || 0) + ' new today'],
                 ['This week', st.week, 'last 7 days'], ['This month', st.month, 'last 30 days'], ['Members', st.members, 'accounts in total']];
  wrap.appendChild(el('div',{class:'activity-tiles'}, tiles.map(([label, n, sub], i) => el('div',{class:'activity-tile' + (i === 0 ? ' is-live' : '')},[
    el('div',{class:'activity-tile__label'}, [i === 0 ? el('span',{class:'live-dot'}) : null, label]),
    el('div',{class:'activity-tile__num'}, String(n || 0)),
    el('div',{class:'activity-tile__sub'}, sub),
  ]))));

  const days = st.days || [];
  const max = Math.max(1, ...days.map(d => d.users || 0));
  const chart = el('div',{class:'card'});
  chart.appendChild(el('h3',{},'Different people each day, last 14 days'));
  chart.appendChild(el('div',{class:'activity-chart', role:'img', 'aria-label':'Daily active people for the last 14 days'}, days.map(d => {
    const dt = new Date(d.day + 'T12:00:00');
    return el('div',{class:'activity-bar', title: d.day + ': ' + d.users},[
      el('span',{class:'activity-bar__n'}, String(d.users || 0)),
      el('span',{class:'activity-bar__fill', style:'height:' + Math.round((d.users || 0) / max * 100) + '%'}),
      el('span',{class:'activity-bar__day'}, dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })),
    ]);
  })));
  wrap.appendChild(chart);
  wrap.appendChild(el('p',{class:'field-caption'}, 'Updated ' + timeAgo(state.activityAt || Date.now()) + '. Counts start from the day this update was installed.'));
  return wrap;
}

/* ================= THE MAJLIS: an audio-only room (Update 16) =================
   One shared room. Up to 8 people sit on the cushions and speak; everyone else listens.
   Voices go peer to peer (WebRTC); who is where is shared with Supabase Realtime presence. */
const MAJLIS_SEATS = 8;
// The room is redecorated every hour, the same for everyone.
const MAJLIS_LOOKS = [
  { key: 'moroccan', name: 'The Moroccan Majlis' }, { key: 'sand', name: 'The Sand Majlis' },
  { key: 'turquoise', name: 'The Turquoise Majlis' }, { key: 'mashrabiya', name: 'The Mashrabiya Majlis' },
  { key: 'palace', name: 'The Palace Majlis' }, { key: 'navy', name: 'The Navy and Gold Majlis' },
];
function majlisLook(){ return MAJLIS_LOOKS[Math.floor(Date.now() / 3600000) % MAJLIS_LOOKS.length]; }
let majlisLookShown = null;
setInterval(() => {
  const k = majlisLook().key;
  if(majlisLookShown && k !== majlisLookShown && state.tab === 'majlis') render();
  majlisLookShown = k;
}, 60000);
// Where the 8 floor cushions sit (percent of the room): four along the back wall, two down each side.
const MAJLIS_SEAT_SPOTS = [[22, 15, 'back'], [41, 15, 'back'], [59, 15, 'back'], [78, 15, 'back'],
                           [9, 42, 'left'], [9, 68, 'left'], [91, 42, 'right'], [91, 68, 'right']];
const DALLAH_SVG = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M26 10h8M30 10v4"/><path d="M24 14h12l-2 6c6 3 9 9 8 16-1 8-6 13-12 13s-11-5-12-13c-1-7 2-13 8-16z"/>'
  + '<path d="M22 24c-6-2-12 0-14-6 5 1 8 3 11 5"/><path d="M42 26c5 0 8 4 7 9s-5 7-8 7"/><path d="M20 52h20"/>'
  + '<path d="M50 50h8l-1 5h-6z"/><path d="M4 50h8l-1 5H5z"/></svg>';
const MAJLIS_MAX_LISTENERS = 40;
// A new topic every 25 minutes (see topics.js). Each room gets a different one.
const MAJLIS_TOPIC_MS = 25 * 60000;
const MAJLIS_TOPICS = [
  'Is the UN Security Council still fit for purpose?', 'Should the veto powers at the UN be abolished?',
  'Will China overtake the US as the leading world power?', 'Is NATO expansion making Europe safer or less safe?',
  'Should the EU build its own army?', 'Do economic sanctions actually change a country\'s behaviour?',
  'Is the world moving from one superpower to many?', 'Should rich countries pay poorer ones for climate damage?',
  'Is BRICS a real alternative to the West?', 'Will the US dollar stay the world\'s reserve currency?',
  'Should countries be allowed to build nuclear weapons for deterrence?', 'Is globalisation over?',
  'Should the Gulf states act as the world\'s mediators?', 'Does foreign aid help or hurt the countries that receive it?',
  'Should borders be more open or more controlled?', 'Is humanitarian intervention ever justified?',
  'Will Africa be the next centre of global growth?', 'Should tech giants be treated like foreign powers?',
  'Is the Arctic the next great battleground for resources?', 'Can a two-state solution still work in the Middle East?',
  'Is Europe too dependent on others for its energy?', 'Should India get a permanent seat on the Security Council?',
  'Do international courts have any real power?', 'Is a new cold war already here?',
  'Should countries control critical supply chains like chips and rare earths?', 'Is oil wealth a blessing or a curse for a country?',
  'Can the world agree on rules for artificial intelligence?', 'Should space be governed like the high seas?',
  'Do trade wars ever have winners?', 'Is it right to boycott countries over human rights?',
  'Should small states pick a side between the big powers?', 'Will water be the cause of future wars?',
];
function majlisTopicIndex(room){ return Math.floor(Date.now() / MAJLIS_TOPIC_MS) + ((room || 1) - 1) * 7; }
function majlisTopic(room){
  // topics.js makes an endless supply; the old geopolitics list is the backup if it didn't load
  if(window.MajlisTopics) return window.MajlisTopics.at(majlisTopicIndex(room));
  return MAJLIS_TOPICS[majlisTopicIndex(room) % MAJLIS_TOPICS.length];
}
function majlisQuestion(){ return majlisTopic(1); }
function majlisNextTopicMins(){ return Math.max(1, Math.ceil((MAJLIS_TOPIC_MS - (Date.now() % MAJLIS_TOPIC_MS)) / 60000)); }
let majlisTopicShown = null;
setInterval(() => {
  const k = majlisTopicIndex(1);
  if(majlisTopicShown !== null && k !== majlisTopicShown && state.tab === 'majlis') render();
  majlisTopicShown = k;
}, 20000);

const majlis = { channel: null, joined: false, me: null, members: [], peers: {}, stream: null, muted: false, gen: 0, error: '',
  room: 1, viewRoom: 1, lobby: null, lobbyMembers: [], requested: false };
function majlisChannelName(room){ return room === 1 ? 'majlis-room' : 'majlis-room-' + room; }

/* ---- the lobby: who is in which room, and requests for a new one ----
   Everyone on the Majlis page shares a tiny presence record: which room they're in, whether they're on a
   cushion, and whether they've asked for a new room. When two people have asked, the next room opens
   and both move into it. A room disappears when the last person leaves. */
function majlisLobbyConnect(){
  if(majlis.lobby || !state.user || state.user.isGuest || !state.user.id) return;
  majlis.lobby = sb.channel('majlis-lobby', { config: { presence: { key: state.user.id } } });
  majlis.lobby.on('presence', { event: 'sync' }, majlisLobbySync)
    .subscribe((status) => { if(status === 'SUBSCRIBED') majlisLobbyTrack(); });
}
function majlisLobbyTrack(){
  if(!majlis.lobby) return;
  majlis.lobby.track({ id: state.user.id, username: state.currentUser,
    room: majlis.joined ? majlis.room : null,
    seat: majlis.joined && majlis.me && majlis.me.seat != null ? majlis.me.seat : null,
    request: majlis.requested ? majlis.viewRoom : null, at: Date.now() });
}
function majlisLobbySync(){
  const st = majlis.lobby ? majlis.lobby.presenceState() : {};
  const list = [];
  Object.values(st).forEach(metas => { const m = metas && metas[metas.length - 1]; if(m && m.id) list.push(m); });
  majlis.lobbyMembers = list;
  // Two requests: open the lowest free room number and move the people who asked into it.
  const askers = list.filter(m => m.request != null).sort((a, b) => a.at - b.at);
  if(majlis.requested && askers.length >= 2 && askers.slice(0, 2).some(m => m.id === state.user.id)){
    const used = new Set(majlisRooms().map(r => r.room));
    let n = 2; while(used.has(n)) n++;
    majlis.requested = false;
    majlisSwitchRoom(n, true);
    return;
  }
  render();
}
// Rooms that exist right now (room 1 always does), with how full they are.
function majlisRooms(){
  const rooms = { 1: { room: 1, people: 0, speakers: 0 } };
  majlis.lobbyMembers.forEach(m => {
    if(m.room == null) return;
    const r = rooms[m.room] || (rooms[m.room] = { room: m.room, people: 0, speakers: 0 });
    r.people++; if(m.seat != null) r.speakers++;
  });
  return Object.values(rooms).sort((a, b) => a.room - b.room);
}
function majlisRoomFull(room){
  const r = majlisRooms().find(x => x.room === room);
  if(majlis.joined && majlis.room === room) return majlisSpeakers().length >= MAJLIS_SEATS || majlisListeners().length >= MAJLIS_MAX_LISTENERS;
  return !!r && (r.speakers >= MAJLIS_SEATS || r.people >= MAJLIS_SEATS + MAJLIS_MAX_LISTENERS);
}
function majlisRequestRoom(){
  majlis.requested = !majlis.requested;
  majlisLobbyTrack();
  render();
}
async function majlisSwitchRoom(room, asSpeaker){
  const wasIn = majlis.joined;
  if(wasIn) majlisLeave(true);
  majlis.viewRoom = room;
  majlisLobbyTrack();
  if(wasIn || asSpeaker) await majlisJoin(!!asSpeaker, room);
  else render();
}

function majlisMe(){ return majlis.members.find(m => m.id === state.user.id) || null; }
function majlisSpeakers(){ return majlis.members.filter(m => m.seat != null).sort((a, b) => a.seat - b.seat); }
function majlisListeners(){ return majlis.members.filter(m => m.seat == null); }

function majlisTrack(){
  if(!majlis.channel || !majlis.me) return;
  majlis.channel.track({ ...majlis.me, muted: majlis.muted, gen: majlis.gen });
}

function majlisReadPresence(){
  const st = majlis.channel ? majlis.channel.presenceState() : {};
  const list = [];
  Object.values(st).forEach(metas => { const m = metas && metas[metas.length - 1]; if(m && m.id) list.push(m); });
  // Two people on one cushion: the one who sat first keeps it.
  const taken = {};
  list.sort((a, b) => (a.sat || 0) - (b.sat || 0)).forEach(m => {
    if(m.seat == null) return;
    if(taken[m.seat]) m.seat = null; else taken[m.seat] = m.id;
  });
  majlis.members = list;
  const mine = list.find(m => m.id === state.user.id);
  if(mine && majlis.me && majlis.me.seat != null && mine.seat == null){
    // Someone else got that cushion first: stand up and listen.
    majlisSetSeat(null);
    return;
  }
  majlisSyncPeers();
  render();
}

async function majlisJoin(asSpeaker, room){
  if(state.user.isGuest){ alert('Create an account to join the Majlis.'); return; }
  if(majlis.joined){ if(asSpeaker) majlisSit(); return; }
  if(majlis.joining) return;             // already connecting — a second press would open a second connection
  majlis.joining = true;
  // ask for the microphone at the same time as connecting, instead of after
  if(asSpeaker && !majlis.stream && navigator.mediaDevices){
    majlis.micAsk = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      .then(st => { if(majlis.joining || majlis.joined) majlis.stream = majlis.stream || st; else st.getTracks().forEach(t => t.stop()); return st; }).catch(() => null);
  }
  setTimeout(() => { if(majlis.joining && !majlis.joined){ majlis.joining = false; majlis.error = 'Couldn\'t connect to the Majlis — check your connection and try again.'; try { sb.removeChannel(majlis.channel); } catch(e){} majlis.channel = null; render(); } }, 15000);
  majlis.error = '';
  majlis.room = room || majlis.viewRoom || 1;
  majlis.viewRoom = majlis.room;
  majlis.me = { id: state.user.id, username: state.currentUser, name: state.user.name, seat: null, sat: 0, joined: Date.now() };
  majlis.channel = sb.channel(majlisChannelName(majlis.room), { config: { presence: { key: state.user.id }, broadcast: { self: false } } });
  majlis.channel
    .on('presence', { event: 'sync' }, majlisReadPresence)
    .on('broadcast', { event: 'sig' }, ({ payload }) => majlisSignal(payload))
    .on('broadcast', { event: 'mod' }, ({ payload }) => majlisModAction(payload))
    .subscribe(async (status) => {
      if(status !== 'SUBSCRIBED') return;
      majlis.joined = true; majlis.joining = false;
      if(majlis.micAsk){ await majlis.micAsk; majlis.micAsk = null; }
      const listeners = majlisListeners().length;
      if(!asSpeaker && listeners >= MAJLIS_MAX_LISTENERS){ majlis.error = 'This room is full. Ask for a new room, or try another one.'; majlisLeave(); return; }
      majlisTrack();
      majlisLobbyTrack();
      if(asSpeaker && majlisSpeakers().length < MAJLIS_SEATS) majlisSit(); else render();
    });
  render();
}

async function majlisSit(seat){
  const used = new Set(majlisSpeakers().filter(m => m.id !== state.user.id).map(m => m.seat));
  if(seat == null){ for(let i = 0; i < MAJLIS_SEATS; i++){ if(!used.has(i)){ seat = i; break; } } }
  if(seat == null || used.has(seat)){ alert('All the cushions are taken. You can listen until one frees up.'); return; }
  if(!majlis.stream){
    try { majlis.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); }
    catch(e){ alert('The Majlis needs your microphone to speak. Check your browser permissions, or just listen.'); return; }
  }
  majlisSetSeat(seat);
}

function majlisSetSeat(seat){
  if(!majlis.me) return;
  const wasSpeaker = majlis.me.seat != null;
  majlis.me.seat = seat;
  majlis.me.sat = seat == null ? 0 : Date.now();
  if(seat == null && majlis.stream){ majlis.stream.getTracks().forEach(t => t.stop()); majlis.stream = null; majlis.muted = false; }
  if(wasSpeaker !== (seat != null)){
    // Speaking or listening changes what we send, so every connection starts again.
    majlis.gen++;
    Object.keys(majlis.peers).forEach(majlisDropPeer);
  }
  majlisTrack();
  majlisLobbyTrack();
  render();
}

function majlisToggleMute(){
  if(!majlis.stream) return;
  majlis.muted = !majlis.muted;
  majlis.stream.getAudioTracks().forEach(t => { t.enabled = !majlis.muted; });
  majlisTrack();
  render();
}

function majlisLeave(quiet){
  Object.keys(majlis.peers).forEach(majlisDropPeer);
  if(majlis.stream){ majlis.stream.getTracks().forEach(t => t.stop()); majlis.stream = null; }
  if(majlis.channel){ try { majlis.channel.untrack(); } catch(e){} sb.removeChannel(majlis.channel); }
  majlis.channel = null; majlis.joined = false; majlis.joining = false; majlis.me = null; majlis.members = []; majlis.muted = false;
  document.querySelectorAll('audio[data-majlis]').forEach(a => a.remove());
  if(!quiet){ majlisLobbyTrack(); render(); }
}
window.addEventListener('beforeunload', () => { if(majlis.joined) majlisLeave(true); });

// ---- voice connections: one per pair where at least one side is speaking ----
function majlisPairKey(other){ return (majlis.gen) + ':' + (other.gen || 0); }

function majlisSyncPeers(){
  const me = majlisMe();
  if(!me) return;
  const want = {};
  majlis.members.forEach(m => {
    if(m.id === me.id) return;
    if(me.seat != null || m.seat != null) want[m.id] = m;
  });
  Object.keys(majlis.peers).forEach(id => {
    if(!want[id] || majlis.peers[id].key !== majlisPairKey(want[id])) majlisDropPeer(id);
  });
  Object.values(want).forEach(m => {
    if(majlis.peers[m.id]) return;
    majlisMakePeer(m);
    if(me.id < m.id) majlisOffer(m.id);   // one side starts, the other answers
  });
}

function majlisMakePeer(m){
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const peer = { pc, key: majlisPairKey(m), audio: null };
  if(majlis.me.seat != null && majlis.stream) majlis.stream.getTracks().forEach(t => pc.addTrack(t, majlis.stream));
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.ontrack = (ev) => {
    let a = document.querySelector('audio[data-majlis="' + m.id + '"]');
    if(!a){ a = document.createElement('audio'); a.autoplay = true; a.setAttribute('data-majlis', m.id); a.style.display = 'none'; document.body.appendChild(a); }
    a.srcObject = ev.streams[0] || new MediaStream([ev.track]);
    a.play && a.play().catch(() => {});
  };
  pc.onicecandidate = (ev) => { if(ev.candidate) majlisSend(m.id, { kind: 'ice', candidate: ev.candidate }); };
  majlis.peers[m.id] = peer;
  return peer;
}

function majlisDropPeer(id){
  const p = majlis.peers[id];
  if(p){ try { p.pc.close(); } catch(e){} }
  delete majlis.peers[id];
  const a = document.querySelector('audio[data-majlis="' + id + '"]');
  if(a) a.remove();
}

function majlisSend(to, body){
  if(majlis.channel) majlis.channel.send({ type: 'broadcast', event: 'sig', payload: { ...body, to, from: state.user.id, gen: majlis.gen } });
}

async function majlisOffer(id){
  const p = majlis.peers[id];
  if(!p) return;
  try {
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    majlisSend(id, { kind: 'offer', sdp: offer });
  } catch(e){ console.warn('majlis offer failed', e); }
}

async function majlisSignal(msg){
  if(!msg || msg.to !== state.user.id || !majlis.joined) return;
  const other = majlis.members.find(m => m.id === msg.from);
  if(!other) return;
  let p = majlis.peers[msg.from];
  if(p && (other.gen || 0) !== msg.gen) return;   // stale message from an older connection
  try {
    if(msg.kind === 'offer'){
      if(!p) p = majlisMakePeer(other);
      await p.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await p.pc.createAnswer();
      await p.pc.setLocalDescription(answer);
      majlisSend(msg.from, { kind: 'answer', sdp: answer });
    } else if(msg.kind === 'answer' && p){
      await p.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } else if(msg.kind === 'ice' && p){
      await p.pc.addIceCandidate(msg.candidate);
    }
  } catch(e){ console.warn('majlis signal error', e); }
}

// Moderators can take someone off a cushion or out of the room.
function majlisMod(targetId, action){
  if(!canModerate() || !majlis.channel) return;
  majlis.channel.send({ type: 'broadcast', event: 'mod', payload: { to: targetId, action, by: state.user.id } });
}
function majlisModAction(msg){
  if(!msg || msg.to !== state.user.id) return;
  const byMod = (() => { const u = Object.values(state.users).find(x => x.id === msg.by); return u && (u.role === 'admin' || u.role === 'mod'); })();
  if(!byMod) return;
  if(msg.action === 'stand'){ majlisSetSeat(null); alert('A moderator moved you to the listeners.'); }
  if(msg.action === 'remove'){ majlisLeave(); alert('A moderator removed you from the Majlis.'); }
}

function renderMajlis(){
  majlisLobbyConnect();
  const wrap = el('div',{class:'majlis'});
  const me = majlisMe();
  const inRoom = majlis.joined && me;
  const room = inRoom ? majlis.room : majlis.viewRoom;
  // Before you join, the cushions are drawn from the lobby (who sits where in this room).
  const lobbyHere = majlis.lobbyMembers.filter(m => m.room === room);
  const speakers = inRoom ? majlisSpeakers() : lobbyHere.filter(m => m.seat != null).map(m => ({ id: m.id, username: m.username, seat: m.seat }));
  const listeners = inRoom ? majlisListeners() : lobbyHere.filter(m => m.seat == null).map(m => ({ id: m.id, username: m.username }));
  const rooms = majlisRooms();
  const full = majlisRoomFull(room);
  const askers = majlis.lobbyMembers.filter(m => m.request != null).length;

  const text = el('div',{class:'majlis__text'});
  text.appendChild(el('div',{class:'kicker'}, inRoom ? (me.seat != null ? 'You are speaking' : 'You are listening') : 'Take a seat'));
  text.appendChild(el('h2',{class:'majlis__title'}, 'Every majlis has an empty cushion. It\'s yours.'));
  text.appendChild(el('p',{class:'majlis__sub'}, 'Voice only, no cameras. Sit on a cushion to speak, or just listen. Up to ' + MAJLIS_SEATS + ' people speak at once, and the topic changes every 25 minutes.'));
  const actions = el('div',{class:'hero__cta'});
  if(!inRoom && majlis.joining){
    actions.appendChild(el('button',{class:'btn is-busy', disabled:'disabled'}, [el('span',{class:'btn-spinner'}), 'Joining…']));
    actions.appendChild(el('button',{class:'btn secondary', onclick:()=>majlisLeave(true)}, 'Cancel'));
  } else if(!inRoom){
    actions.appendChild(el('button',{class:'btn', onclick:()=>majlisJoin(true, room)}, [icon('mic', 16), 'Sit and speak']));
    actions.appendChild(el('button',{class:'btn secondary', onclick:()=>majlisJoin(false, room)}, 'Just listen'));
  } else {
    if(me.seat != null){
      actions.appendChild(el('button',{class:'btn' + (majlis.muted ? ' secondary' : ''), onclick: majlisToggleMute}, [icon(majlis.muted ? 'micOff' : 'mic', 16), majlis.muted ? 'Unmute' : 'Mute']));
      actions.appendChild(el('button',{class:'btn secondary', onclick:()=>majlisSetSeat(null)}, 'Stand up and listen'));
    } else {
      actions.appendChild(el('button',{class:'btn', onclick:()=>majlisSit()}, [icon('mic', 16), 'Take a cushion']));
    }
    actions.appendChild(el('button',{class:'btn secondary', onclick:()=>majlisLeave()}, 'Leave'));
  }
  text.appendChild(actions);
  if(rooms.length > 1 || room !== 1){
    text.appendChild(el('div',{class:'majlis-rooms'}, rooms.map(r => el('button',{
      class:'majlis-rooms__tab' + (r.room === room ? ' is-on' : ''), onclick:()=> r.room === room ? null : majlisSwitchRoom(r.room, false)},
      [el('span',{}, 'Room ' + r.room), el('span',{class:'majlis-rooms__count'}, r.speakers + '/' + MAJLIS_SEATS + ' seats · ' + r.people + ' in')]))));
  }
  if(full || majlis.requested){
    text.appendChild(el('div',{class:'queue-offer majlis-request'},[
      el('div',{class:'queue-offer__text'},[
        el('strong',{}, majlis.requested ? 'You\'ve asked for a new room.' : 'This room is full.'),
        el('span',{}, majlis.requested
          ? ' ' + (askers >= 2 ? 'Opening it now…' : 'It opens as soon as one more person asks (' + askers + ' of 2).')
          : ' Ask for a new room. When two people have asked, it opens and you both move in.'),
      ]),
      el('div',{class:'queue-offer__actions'},[
        el('button',{class: majlis.requested ? 'btn secondary' : 'btn', onclick: majlisRequestRoom}, majlis.requested ? 'Cancel request' : 'Request a new room'),
      ]),
    ]));
  } else if(askers > 0){
    text.appendChild(el('p',{class:'field-caption'}, askers + ' ' + (askers === 1 ? 'person has' : 'people have') + ' asked for a new room. ',
      ));
    text.lastChild.appendChild(el('button',{class:'linkbtn', onclick: majlisRequestRoom}, 'Ask too'));
  }
  if(majlis.error) text.appendChild(el('p',{class:'field-caption warn'}, majlis.error));
  text.appendChild(el('p',{class:'field-caption'}, 'Be civil. Moderators can move or remove anyone, and you can report people from their profile.'));
  const lookNow = majlisLook();
  text.appendChild(el('p',{class:'majlis__look'}, [el('span',{class:'majlis__look-dot style-' + lookNow.key}), 'This hour: ' + lookNow.name + '. The room changes every hour.']));

  // A real majlis seen from above: floor cushions along three walls, a rug in the middle
  // with the coffee pot and tonight's question, lanterns in the corners, open at the front.
  const look = majlisLook();
  const ring = el('div',{class:'majlis-room style-' + look.key});
  ring.appendChild(el('div',{class:'majlis-room__wall'}));
  ring.appendChild(el('div',{class:'majlis-room__panel', 'aria-hidden':'true'}));
  ring.appendChild(el('div',{class:'majlis-room__chandelier', 'aria-hidden':'true'}));
  [1,2,3,4].forEach(n => ring.appendChild(el('span',{class:'majlis-room__table is-' + n, 'aria-hidden':'true'})));
  ['tl','tr','bl','br'].forEach(c => ring.appendChild(el('span',{class:'majlis-room__lantern is-' + c, 'aria-hidden':'true'})));
  ring.appendChild(el('div',{class:'majlis-room__window is-1', 'aria-hidden':'true'}));
  ring.appendChild(el('div',{class:'majlis-room__window is-2', 'aria-hidden':'true'}));
  ring.appendChild(el('div',{class:'majlis-room__window is-3', 'aria-hidden':'true'}));
  ring.appendChild(el('div',{class:'majlis-room__rug'},[
    el('div',{class:'majlis-room__rug-inner'},[
      el('div',{class:'majlis-room__ottoman', 'aria-hidden':'true'}),
      el('div',{class:'majlis-room__coffee', 'aria-hidden':'true', html: DALLAH_SVG}),
      el('div',{class:'majlis__qlabel'}, 'Topic now' + (room > 1 ? ' · Room ' + room : '')),
      el('div',{class:'majlis__question'}, majlisTopic(room)),
      el('div',{class:'majlis__next'}, 'New topic in ' + majlisNextTopicMins() + ' min'),
    ]),
  ]));
  MAJLIS_SEAT_SPOTS.forEach(([x, y, side], i) => {
    const who = speakers.find(m => m.seat === i);
    const pos = 'left:' + x + '%;top:' + y + '%;';
    const mat = el('span',{class:'cushion__mat is-' + side, 'aria-hidden':'true'});
    if(who){
      const isMe = who.id === state.user.id;
      const seat = el('div',{class:'cushion is-taken is-' + side + (who.muted ? ' is-muted' : '') + (isMe ? ' is-me' : ''), style: pos},[
        mat,
        avatarNode(who.username, 54),
        el('div',{class:'cushion__name'}, isMe ? 'You' : who.username),
        who.muted ? el('span',{class:'cushion__muted', title:'Muted'}, icon('micOff', 13)) : null,
      ]);
      if(!isMe){
        seat.appendChild(el('div',{class:'cushion__tools'},[
          el('button',{class:'linkbtn', onclick:()=>viewProfile(who.username)}, 'Profile'),
          el('button',{class:'linkbtn', onclick:()=>openReport(who.username, { type:'majlis', preview:'Majlis room ' + (majlis.viewRoom || majlis.room || 1) + ' · ' + majlisTopic(majlis.viewRoom || majlis.room || 1) })}, 'Report'),
          canModerate() ? el('button',{class:'linkbtn', onclick:()=>majlisMod(who.id, 'stand')}, 'Move to listeners') : null,
          canModerate() ? el('button',{class:'linkbtn', onclick:()=>majlisMod(who.id, 'remove')}, 'Remove') : null,
        ]));
      }
      ring.appendChild(seat);
    } else {
      const canTake = inRoom && me.seat == null;
      ring.appendChild(el('button',{class:'cushion is-empty is-' + side, style: pos, 'aria-label':'Empty cushion ' + (i + 1),
        onclick: () => inRoom ? (canTake ? majlisSit(i) : null) : majlisJoin(true, room)},[
        mat,
        el('span',{class:'cushion__plus'}, '+'),
        el('div',{class:'cushion__name'}, 'Sit here'),
      ]));
    }
  });

  wrap.appendChild(el('div',{class:'majlis__grid'},[text, ring]));

  const lr = el('div',{class:'majlis__listeners'});
  lr.appendChild(el('div',{class:'panel-head'},[el('span',{class:'eyebrow'}, 'Listening (' + listeners.length + ')'), el('span',{class:'eyebrow'}, speakers.length + ' of ' + MAJLIS_SEATS + ' cushions taken')]));
  if(!listeners.length){
    lr.appendChild(el('p',{class:'empty-note'}, inRoom ? 'Nobody else is listening yet.' : 'Join to see who is here.'));
  } else {
    lr.appendChild(el('div',{class:'majlis__crowd'}, listeners.map(m => el('div',{class:'majlis__listener'},[
      avatarNode(m.username, 38), el('span',{}, m.id === state.user.id ? 'You' : m.username),
      m.id !== state.user.id && (state.user && !state.user.isGuest) ? el('button',{class:'linkbtn', onclick:()=>openReport(m.username, { type:'majlis', preview:'Majlis room ' + (majlis.viewRoom || majlis.room || 1) + ' · listening' })}, 'Report') : null,
      canModerate() && m.id !== state.user.id ? el('button',{class:'linkbtn', onclick:()=>majlisMod(m.id, 'remove')}, 'Remove') : null,
    ]))));
  }
  wrap.appendChild(lr);
  return wrap;
}

// While you're in the Majlis but on another page, a small bar keeps you in touch.
function majlisMiniBar(){
  if(!majlis.joined || !majlis.me || state.tab === 'majlis') return null;
  const me = majlisMe();
  return el('div',{class:'majlis-mini'},[
    el('span',{class:'end-panel__dot'}),
    el('span',{class:'majlis-mini__text'}, 'In the Majlis · ' + (me && me.seat != null ? (majlis.muted ? 'muted' : 'speaking') : 'listening')),
    me && me.seat != null ? el('button',{class:'linkbtn', onclick: majlisToggleMute}, majlis.muted ? 'Unmute' : 'Mute') : null,
    el('button',{class:'linkbtn', onclick:()=>navigateWithLoading('majlis')}, 'Open'),
    el('button',{class:'linkbtn', onclick:()=>majlisLeave()}, 'Leave'),
  ]);
}

/* ================= GOING LIVE: others can watch audio and video debates (Update 20) =================
   Both debaters have to agree. While live, each of them sends their own camera/mic straight to each
   viewer (up to 25), and the debate shows up for everyone under "Streaming now" with a LIVE badge. */
const LIVE_MAX_VIEWERS = 25;
const live = { mine: false, theirs: false, broadcasting: false, debate: null, since: 0, dirCh: null, watchCh: null, pcs: {}, viewers: 0 };

function sendLiveState(sync){
  if(webrtcChannel) webrtcChannel.send({ type: 'broadcast', event: 'live', payload: { from: state.currentUser, on: live.mine, sync: !!sync } });
}
function onLiveMessage(debate, p){
  if(!p || p.from === state.currentUser) return;
  live.theirs = !!p.on;
  if(!p.sync) sendLiveState(true);
  updateLive(debate);
}
function toggleGoLive(debate){
  live.mine = !live.mine;
  sendLiveState(false);
  updateLive(debate);
}
function updateLive(debate){
  const on = live.mine && live.theirs && !!localStream && debate.status !== 'ended' && !debate.verdict;
  if(on && !live.broadcasting) startBroadcast(debate);
  if(!on && live.broadcasting) stopBroadcast();
  render();
}

function startBroadcast(debate){
  live.broadcasting = true; live.debate = debate.id; live.since = Date.now();
  const opp = otherParticipant(debate);
  const info = { debateId: debate.id, mode: debate.mode, topic: topicPhaseActive(debate) ? 'Choosing a topic' : (debate.topic || 'Open topic'),
                 a: debate.participants[0], b: debate.participants[1], since: live.since, host: state.user.id };
  // Announce the stream on the shared list (the same channel everyone already listens to).
  ensureLiveDirectory();
  live.info = info;
  if(live.dir) live.dir.track(info);
  live.watchCh = sb.channel('watch-' + debate.id, { config: { presence: { key: state.user.id } } });
  live.watchCh
    .on('presence', { event: 'sync' }, syncViewers)
    .on('broadcast', { event: 'wsig' }, ({ payload }) => hostSignal(payload))
    .on('broadcast', { event: 'vote' }, () => loadVotes(debate.id))
    .subscribe((st) => { if(st === 'SUBSCRIBED') live.watchCh.track({ id: state.user.id, username: state.currentUser, role: 'host' }); });
}
function stopBroadcast(){
  Object.keys(live.pcs).forEach(id => { try { live.pcs[id].close(); } catch(e){} });
  live.pcs = {};
  if(live.info && live.dir){ try { live.dir.untrack(); } catch(e){} }
  live.info = null;
  if(live.watchCh){ try { live.watchCh.untrack(); } catch(e){} sb.removeChannel(live.watchCh); }
  live.watchCh = null; live.broadcasting = false; live.debate = null; live.viewers = 0;
}
function wsend(ch, to, body){ if(ch) ch.send({ type: 'broadcast', event: 'wsig', payload: { ...body, to, from: state.user.id } }); }

function syncViewers(){
  if(!live.watchCh) return;
  const st = live.watchCh.presenceState();
  const viewers = [];
  Object.values(st).forEach(metas => { const m = metas && metas[metas.length - 1]; if(m && m.role === 'viewer') viewers.push(m); });
  const allowed = viewers.slice(0, LIVE_MAX_VIEWERS);
  const ids = new Set(allowed.map(v => v.id));
  Object.keys(live.pcs).forEach(id => { if(!ids.has(id)){ try { live.pcs[id].close(); } catch(e){} delete live.pcs[id]; } });
  allowed.forEach(async v => {
    if(live.pcs[v.id] || !localStream) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    live.pcs[v.id] = pc;
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.onicecandidate = (ev) => { if(ev.candidate) wsend(live.watchCh, v.id, { kind: 'ice', candidate: ev.candidate }); };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsend(live.watchCh, v.id, { kind: 'offer', sdp: offer, mode: state.debates[live.debate] ? state.debates[live.debate].mode : 'Video', username: state.currentUser });
    } catch(e){ console.warn('live offer failed', e); }
  });
  if(live.viewers !== allowed.length){ live.viewers = allowed.length; render(); }
}
async function hostSignal(p){
  if(!p || p.to !== state.user.id) return;
  const pc = live.pcs[p.from];
  if(!pc) return;
  try {
    if(p.kind === 'answer') await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
    else if(p.kind === 'ice') await pc.addIceCandidate(p.candidate);
  } catch(e){ console.warn('live signal error', e); }
}

// The box inside an audio/video debate.
function goLivePanel(debate, oppName){
  const box = el('div',{class:'golive' + (live.broadcasting ? ' is-live' : '')});
  if(live.broadcasting){
    box.appendChild(el('div',{class:'golive__row'},[
      el('span',{class:'live-badge'},[el('span',{class:'live-dot'}), 'LIVE']),
      el('span',{class:'golive__text'}, live.viewers + (live.viewers === 1 ? ' person watching' : ' people watching')),
      el('button',{class:'btn secondary', onclick:()=>toggleGoLive(debate)}, 'Stop streaming'),
    ]));
    box.appendChild(audiencePanel(debate.id, debate.participants[0], debate.participants[1], false));
    return box;
  }
  let msg, label;
  if(live.mine && !live.theirs){ msg = 'Waiting for ' + oppName + ' to agree to go live.'; label = 'Cancel'; }
  else if(!live.mine && live.theirs){ msg = oppName + ' wants to go live so others can watch.'; label = 'Go live'; }
  else { msg = 'Let other people watch this debate. You both have to agree.'; label = 'Go live'; }
  box.appendChild(el('div',{class:'golive__row'},[
    el('span',{class:'golive__icon'}, icon('video', 18)),
    el('span',{class:'golive__text'}, msg),
    el('button', Object.assign({class: label === 'Cancel' ? 'btn secondary' : 'btn', onclick:()=>toggleGoLive(debate)}, localStream ? {} : { disabled: 'disabled', title: 'Needs your camera or microphone' }), label),
  ]));
  return box;
}

/* ---- the list of live streams everyone sees ---- */
function ensureLiveDirectory(){
  if(live.dir || !state.user || state.user.isGuest || !state.user.id) return;
  live.dir = sb.channel('debate-live', { config: { presence: { key: 'viewer:' + state.user.id } } });
  const dir = live.dir;
  dir.on('presence', { event: 'sync' }, () => {
    if(live.dir !== dir) return;
    const st = dir.presenceState();
    const byDebate = {};
    Object.values(st).forEach(metas => { const m = metas && metas[metas.length - 1]; if(m && m.debateId) byDebate[m.debateId] = m; });
    const list = Object.values(byDebate).sort((a, b) => a.since - b.since);
    const changed = JSON.stringify(list.map(x => x.debateId)) !== JSON.stringify((state.liveStreams || []).map(x => x.debateId));
    state.liveStreams = list;
    if(changed) render();
  }).subscribe((st) => { if(st === 'SUBSCRIBED' && live.info) live.dir.track(live.info); });
}

/* ---- watching someone else's live debate ---- */
const watch = { id: null, info: null, ch: null, pcs: {}, streams: {}, hosts: [], viewers: 0 };

function startWatching(info){
  if(state.user.isGuest){ alert('Create an account to watch live debates.'); return; }
  stopWatching();
  watch.id = info.debateId; watch.info = info; watch.startedAt = Date.now();
  watch.ch = sb.channel('watch-' + info.debateId, { config: { presence: { key: state.user.id } } });
  watch.ch
    .on('broadcast', { event: 'wsig' }, ({ payload }) => viewerSignal(payload))
    .on('broadcast', { event: 'vote' }, () => loadVotes(info.debateId))
    .on('presence', { event: 'sync' }, () => {
      if(!watch.ch) return;
      const st = watch.ch.presenceState();
      const hosts = [], viewers = [];
      Object.values(st).forEach(metas => { const m = metas && metas[metas.length - 1]; if(!m) return; (m.role === 'host' ? hosts : viewers).push(m); });
      watch.hosts = hosts; watch.viewers = viewers.length;
      Object.keys(watch.pcs).forEach(id => { if(!hosts.some(h => h.id === id)){ try { watch.pcs[id].close(); } catch(e){} delete watch.pcs[id]; delete watch.streams[id]; } });
      render();
    })
    .subscribe((st) => { if(st === 'SUBSCRIBED') watch.ch.track({ id: state.user.id, username: state.currentUser, role: 'viewer' }); });
  state.tab = 'watch';
  render();
}
function stopWatching(){
  Object.values(watch.pcs).forEach(pc => { try { pc.close(); } catch(e){} });
  if(watch.ch){ try { watch.ch.untrack(); } catch(e){} sb.removeChannel(watch.ch); }
  watch.id = null; watch.info = null; watch.ch = null; watch.pcs = {}; watch.streams = {}; watch.hosts = []; watch.viewers = 0;
}
async function viewerSignal(p){
  if(!p || p.to !== state.user.id || !watch.ch) return;
  try {
    if(p.kind === 'offer'){
      if(watch.pcs[p.from]){ try { watch.pcs[p.from].close(); } catch(e){} }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      watch.pcs[p.from] = pc;
      pc.ontrack = (ev) => { watch.streams[p.from] = ev.streams[0] || new MediaStream([ev.track]); render(); };
      pc.onicecandidate = (ev) => { if(ev.candidate) wsend(watch.ch, p.from, { kind: 'ice', candidate: ev.candidate }); };
      await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsend(watch.ch, p.from, { kind: 'answer', sdp: answer });
    } else if(p.kind === 'ice' && watch.pcs[p.from]){
      await watch.pcs[p.from].addIceCandidate(p.candidate);
    }
  } catch(e){ console.warn('watch signal error', e); }
}

function renderWatch(){
  const wrap = el('div',{class:'watch'});
  const info = watch.info;
  if(!info){
    wrap.appendChild(el('h2',{class:'section-title'},'Live debates'));
    wrap.appendChild(el('p',{class:'section-sub'},'Nothing to watch right now.'));
    wrap.appendChild(el('button',{class:'btn', onclick:()=>navigateWithLoading('debate')},'Back to debates'));
    return wrap;
  }
  const ended = watch.ch && !watch.hosts.length && Date.now() - (watch.startedAt || 0) > 3000;
  wrap.appendChild(el('div',{class:'watch__head'},[
    el('span',{class:'live-badge'},[el('span',{class:'live-dot'}), ended ? 'ENDED' : 'LIVE']),
    el('span',{class:'watch__meta'}, info.mode + ' debate · ' + watch.viewers + ' watching'),
  ]));
  wrap.appendChild(el('h2',{class:'section-title'}, info.topic));
  const tiles = el('div',{class: info.mode === 'Audio' ? 'audio-stage' : 'video-grid'});
  [info.a, info.b].forEach(name => {
    const host = watch.hosts.find(h => h.username === name);
    const stream = host ? watch.streams[host.id] : null;
    if(info.mode === 'Audio'){
      const a = el('audio',{autoplay:'true'}); if(stream) a.srcObject = stream;
      tiles.appendChild(el('div',{class:'audio-seat'},[avatarNode(name, 96), el('div',{class:'audio-seat__name'}, name),
        el('div',{class:'audio-seat__state' + (stream ? ' is-live' : '')}, stream ? 'Speaking live' : (host ? 'Connecting…' : 'Not streaming')), a]));
    } else {
      const v = el('video',{autoplay:'true', playsinline:'true', class:'video-el'}); if(stream) v.srcObject = stream;
      tiles.appendChild(el('div',{class:'video-box'},[v, el('div',{class:'video-label'}, name)]));
    }
  });
  if(info.mode === 'Audio') tiles.insertBefore(el('div',{class:'audio-stage__vs'},'VS'), tiles.children[1]);
  wrap.appendChild(tiles);
  wrap.appendChild(audiencePanel(info.debateId, info.a, info.b, !ended && info.a !== state.currentUser && info.b !== state.currentUser));
  wrap.appendChild(el('div',{class:'hero__cta', style:'margin-top:18px;'},[
    el('button',{class:'btn secondary', onclick:()=>{ stopWatching(); navigateWithLoading('debate'); }}, 'Stop watching'),
    el('button',{class:'btn secondary', onclick:()=>openReport(info.a, { type:'stream', preview:'Live stream: ' + (info.topic || '') })}, 'Report ' + info.a),
    el('button',{class:'btn secondary', onclick:()=>openReport(info.b, { type:'stream', preview:'Live stream: ' + (info.topic || '') })}, 'Report ' + info.b),
  ]));
  wrap.appendChild(el('p',{class:'field-caption'}, 'You are watching only. The debaters can\'t hear or see you.'));
  return wrap;
}

/* ================= VIDEO DEBATES (WebRTC + live transcription) ================= */
let pc = null;
let localStream = null;
let remoteStream = null;
let webrtcChannel = null;
let speechRecognizer = null;
let activeVideoDebateId = null;

// Servers that help two browsers find each other. The relay (TURN) servers come from our Supabase
// function when they're set up, so calls also work on strict school and mobile networks.
let ICE_SERVERS = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
let iceFetchedAt = 0;
async function refreshIceServers(){
  if(!state.user || state.user.isGuest || Date.now() - iceFetchedAt < 3 * 3600_000) return;
  iceFetchedAt = Date.now();
  try {
    const { data } = await callSecure('ice_servers', {});
    if(data && Array.isArray(data.iceServers) && data.iceServers.length) ICE_SERVERS = data.iceServers;
  } catch(e){ iceFetchedAt = 0; }
}

async function setupVideoCall(debate){
  if(activeVideoDebateId === debate.id) return;
  teardownVideoCall();
  activeVideoDebateId = debate.id;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: debate.mode !== 'Audio', audio: true });
  } catch(e){
    console.warn('Could not access camera/mic', e);
    localStream = null;
  }

  remoteStream = new MediaStream();
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  if(localStream){
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    render();
  };
  pc.onicecandidate = (event) => {
    if(event.candidate && webrtcChannel){
      webrtcChannel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'ice', candidate: event.candidate, from: state.currentUser } });
    }
  };

  const amInitiator = debate.participants[0] === state.currentUser;

  webrtcChannel = sb.channel('webrtc-'+debate.id)
    .on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if(!payload || payload.from === state.currentUser || !pc) return;
      try {
        if(payload.kind === 'offer'){
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          webrtcChannel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'answer', sdp: answer, from: state.currentUser } });
        } else if(payload.kind === 'answer'){
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if(payload.kind === 'ice'){
          await pc.addIceCandidate(payload.candidate);
        }
      } catch(e){ console.warn('WebRTC signaling error', e); }
    })
    .on('broadcast', { event: 'live' }, ({ payload }) => onLiveMessage(debate, payload))
    .subscribe(async (status) => {
      if(status === 'SUBSCRIBED') sendLiveState(false);
      if(status === 'SUBSCRIBED' && amInitiator && pc){
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        webrtcChannel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'offer', sdp: offer, from: state.currentUser } });
      }
    });

  startSpeechTranscription(debate);
  render();
}

function teardownVideoCall(){
  stopBroadcast(); live.mine = false; live.theirs = false;
  if(speechRecognizer){ try{ speechRecognizer.onend = null; speechRecognizer.stop(); }catch(e){} speechRecognizer = null; }
  if(pc){ try{ pc.close(); }catch(e){} pc = null; }
  if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream = null; }
  if(webrtcChannel){ sb.removeChannel(webrtcChannel); webrtcChannel = null; }
  remoteStream = null;
  activeVideoDebateId = null;
}
window.addEventListener('beforeunload', teardownVideoCall);

function startSpeechTranscription(debate){
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognitionCtor) return;
  speechRecognizer = new SpeechRecognitionCtor();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = false;
  speechRecognizer.lang = 'en-US';
  speechRecognizer.onresult = async (event) => {
    for(let i = event.resultIndex; i < event.results.length; i++){
      if(event.results[i].isFinal){
        const text = event.results[i][0].transcript.trim();
        if(text && state.user && state.user.id){
          const { error: transcriptErr } = await sb.from('debate_messages').insert({ debate_id: debate.id, author_id: state.user.id, text });
          if(transcriptErr) console.warn('Transcript line failed to save:', transcriptErr);
        }
      }
    }
  };
  speechRecognizer.onerror = (e) => { console.warn('Speech recognition error', e); };
  speechRecognizer.onend = () => {
    if(activeVideoDebateId === debate.id && speechRecognizer){
      try { speechRecognizer.start(); } catch(e){}
    }
  };
  try { speechRecognizer.start(); } catch(e){ console.warn('Could not start speech recognition', e); }
}

function renderChatRoom(debate){
  const wrap = el('div',{});
  if(debate.verdict) return judgeAnimHolding(debate) ? renderJudging(debate) : renderVerdict(debate);
  if(endRequestState(debate).type === 'judging') return renderJudging(debate);
  startDebateTicker();

  const oppName = otherParticipant(debate);
  wrap.appendChild(el('h2',{class:'section-title'}, debate.mode+' Debate — '+(topicPhaseActive(debate) ? 'Choosing a topic' : (debate.topic || 'Open topic'))));
  wrap.appendChild(el('p',{class:'section-sub vs-line'}, ['vs. ', avatarNode(oppName, 26), ' '+oppName, badgeRow(oppName, 'xs'), (debate.unranked?' · unranked':' · ranked'),
    state.users[oppName] ? el('button',{class:'report-link', title:'Report ' + oppName, onclick:()=>openReport(oppName, { type:'debate', id:debate.id, preview: debate.topic ? 'Topic: ' + debate.topic : '' })}, [icon('flag', 13), 'Report']) : null]));
  if(topicPhaseActive(debate)) wrap.appendChild(renderTopicPhase(debate));

  const room = el('div',{class:'debate-room'});
  const left = el('div',{});

  if(debate.mode === 'Video' || debate.mode === 'Audio'){
    setupVideoCall(debate);
    const supportsSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    if(debate.mode === 'Audio'){
      // Audio only: two big avatars; the other person's voice plays through a hidden audio element.
      const remoteAudio = el('audio',{autoplay:'true'});
      if(remoteStream) remoteAudio.srcObject = remoteStream;
      const connected = !!(remoteStream && remoteStream.getAudioTracks().length);
      left.appendChild(el('div',{class:'audio-stage'},[
        el('div',{class:'audio-seat'},[avatarNode(state.currentUser, 96), el('div',{class:'audio-seat__name'},'You'),
          el('div',{class:'audio-seat__state' + (localStream ? ' is-live' : '')}, localStream ? 'Mic on' : 'No mic')]),
        el('div',{class:'audio-stage__vs'},'VS'),
        el('div',{class:'audio-seat'},[avatarNode(oppName, 96), el('div',{class:'audio-seat__name'}, oppName),
          el('div',{class:'audio-seat__state' + (connected ? ' is-live' : '')}, connected ? 'Connected' : 'Connecting…')]),
        remoteAudio,
      ]));
    } else {
      const localVideo = el('video',{autoplay:'true', playsinline:'true', class:'video-el'});
      localVideo.muted = true;
      if(localStream) localVideo.srcObject = localStream;
      const remoteVideo = el('video',{autoplay:'true', playsinline:'true', class:'video-el'});
      if(remoteStream) remoteVideo.srcObject = remoteStream;

      left.appendChild(el('div',{class:'video-grid'},[
        el('div',{class:'video-box'},[localVideo, el('div',{class:'video-label'},'You')]),
        el('div',{class:'video-box'},[remoteVideo, el('div',{class:'video-label'}, oppName)]),
      ]));
    }

    if(!localStream){
      left.appendChild(el('p',{class:'field-caption warn', style:'margin-top:10px;'},
        (debate.mode === 'Audio' ? 'Microphone' : 'Camera/microphone') + ' access is needed for ' + debate.mode.toLowerCase() + ' debates — check your browser permissions and reload.'));
    }
    left.appendChild(el('p',{class:'field-caption', style:'margin-top:10px;'},
      supportsSpeech
        ? 'Your speech is transcribed live so the AI judge can review the debate afterward.'
        : 'Live captioning (used for AI judging) isn\'t supported in this browser — try Chrome, or switch to Text mode.'));

    left.appendChild(goLivePanel(debate, oppName));
    left.appendChild(el('div',{style:'height:14px'}));
    left.appendChild(debateEndButtons(debate));
    left.appendChild(el('div',{style:'height:14px'}));
    left.appendChild(el('div',{class:'stat-label'},'Live transcript'));
    const transcriptLog = el('div',{class:'chat-log', style:'max-height:220px;'});
    renderChatMessages(transcriptLog, debate);
    left.appendChild(transcriptLog);
    // Typed lines go into the same transcript the judge reads — useful for sources, links,
    // browsers without speech recognition, or when the mic isn't picking you up.
    left.appendChild(debateMessageInput(debate, 'Type a point or a source to add it to the transcript...'));
  } else {
    const chatWindow = el('div',{class:'chat-window'});
    const log = el('div',{class:'chat-log'});
    renderChatMessages(log, debate);
    maybeRivalOpens(debate);
    chatWindow.appendChild(log);
    
    const inputRow = debateMessageInput(debate, 'Write your argument...');
    chatWindow.appendChild(inputRow);
    left.appendChild(chatWindow);
    left.appendChild(el('div',{style:'height:14px'}));
    left.appendChild(debateEndButtons(debate));
  }

  room.appendChild(left);
  room.appendChild(el('div',{class:'sidebox'},[
    el('h4',{},'AI Judge'),
    el('p',{},'When you both agree to end, the AI judge reads every message, checks for 12 logical fallacies, and always picks a winner.')
  ]));

  wrap.appendChild(room);
  return wrap;
}

// Text box that adds a message to the debate (used by both text and video debates).
function debateMessageInput(debate, placeholder){
  const inputRow = el('div',{class:'chat-input-row', style: (debate.mode === 'Video' || debate.mode === 'Audio') ? 'border:1px solid var(--line);border-radius:3px;margin-top:10px;' : ''});
  const picking = topicPhaseActive(debate);
  const box = draft('debate-msg-'+debate.id, el('textarea',{placeholder: picking ? 'The chat opens when the topic is set…' : placeholder, maxlength:'4000'}));
  if(picking){ box.disabled = true; }
  const send = async ()=>{
    const val = box.value.trim();
    if(!val || topicPhaseActive(debate)) return;
    // Show it in the debate straight away (faded until the server confirms).
    const local = { author: state.currentUser, text: val, pending: true, id: null };
    debate.chatLog.push(local);
    box.value = '';
    clearDrafts('debate-msg-'+debate.id);
    render();
    const { data, error } = await sb.from('debate_messages').insert({ debate_id: debate.id, author_id: state.user.id, text: val }).select('id').single();
    if(error){
      debate.chatLog = debate.chatLog.filter(m => m !== local);
      state.drafts['debate-msg-'+debate.id] = val;
      render();
      automodNote(error, 'debate', val);
      alert(friendlyDbError(error, 'That message couldn\'t be sent.'));
      return;
    }
    if(debate.chatLog.some(m => m !== local && m.id === data.id)){ debate.chatLog = debate.chatLog.filter(m => m !== local); }
    else { local.id = data.id; local.pending = false; }
    if(!streak.today) loadStreak(true).then(render);
    render();
    if(rivalOf(debate)) requestRivalTurn(debate);
  };
  box.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
  inputRow.appendChild(box);
  inputRow.appendChild(el('button',{class:'btn', onclick: send}, 'Send'));
  return inputRow;
}

/* ---------- The first 30 seconds: pick a topic ----------
   Both players see where their assessment answers disagree most, with topics built from that.
   Picking the same topic starts the debate at once; otherwise the server decides when time is up. */
const TOPIC_MS = 30000;
const DISAGREE_AXES = [
  { key: 'economic', axis: 'x', name: 'Economics', ends: ['Left', 'Right'], motions: [
    'Should the rich pay much higher taxes?', 'Should healthcare be fully public?', 'Is capitalism the best system we have?', 'Should the minimum wage be raised?'] },
  { key: 'economic', axis: 'y', name: 'The state and the market', ends: ['Interventionist', 'Laissez-faire'], motions: [
    'Should big tech companies be broken up?', 'Should the state own key industries like energy?', 'Do regulations do more harm than good?', 'Should governments cap prices in a crisis?'] },
  { key: 'political', axis: 'x', name: 'Nation and the world', ends: ['Nationalist', 'Globalist'], motions: [
    'Should countries set strict immigration limits?', 'Is globalisation good for ordinary workers?', 'Should national law come before international law?', 'Is the UN still worth having?'] },
  { key: 'political', axis: 'y', name: 'Freedom and authority', ends: ['Authoritarian', 'Libertarian'], motions: [
    'Should governments be allowed to monitor online messages?', 'Is free speech worth protecting even when it offends?', 'Should all drugs be decriminalised?', 'Should voting be compulsory?'] },
  { key: 'social', axis: 'x', name: 'Tradition and change', ends: ['Traditional', 'Progressive'], motions: [
    'Should schools teach religion?', 'Is the traditional family best for children?', 'Has modern culture lost its moral compass?', 'Should social media be banned for under-16s?'] },
  { key: 'social', axis: 'y', name: 'The group and the individual', ends: ['Collectivist', 'Individualist'], motions: [
    'Should national service be compulsory?', 'Should individual freedom come before the common good?', 'Is it selfish not to vote?', 'Should the state support people who choose not to work?'] },
];
const GENERAL_MOTIONS = ['Do we have free will?', 'Is morality objective?', 'Should the rich pay much higher taxes?', 'Is free speech worth protecting even when it offends?'];

function topicPhaseActive(debate){
  return debate.topicLocked === false && !debate.verdict && Date.now() < debate.createdAt + TOPIC_MS;
}
function topicSecondsLeft(debate){
  return Math.max(0, Math.ceil((debate.createdAt + TOPIC_MS - Date.now()) / 1000));
}

// Where the two players' assessment results are furthest apart, biggest gap first.
function disagreements(debate){
  const me = state.user;
  const opp = state.users[otherParticipant(debate)] || null;
  if(!me.compass || !opp || !opp.compass) return { known: false, axes: [], extras: [] };
  const axes = DISAGREE_AXES.map(a => {
    const mine = me.compass[a.key][a.axis], theirs = opp.compass[a.key][a.axis];
    return { ...a, mine, theirs, gap: Math.abs(mine - theirs) };
  }).sort((x, y) => y.gap - x.gap);
  const extras = [];
  if(me.religion && opp.religion && me.religion !== opp.religion && me.religion !== 'Prefer not to say' && opp.religion !== 'Prefer not to say'){
    extras.push({ name: 'Religion', mine: me.religion, theirs: opp.religion, motions: ['Can morality exist without God?', 'Does religion do more good than harm?'] });
  }
  if(me.archetype && opp.archetype && me.archetype !== opp.archetype && !/not yet/i.test(me.archetype + opp.archetype)){
    extras.push({ name: 'Philosophy', mine: me.archetype, theirs: opp.archetype, motions: ['Do we have free will?', 'Is morality objective?'] });
  }
  return { known: true, axes, extras };
}

function suggestedTopics(debate, d){
  const out = [];
  const add = (t) => { if(t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t); };
  if(debate.topic && !/^open topic$/i.test(debate.topic)) add(debate.topic);   // proposed in the lobby
  if(d.known){
    const seed = String(debate.id).split('').reduce((n, c) => n + c.charCodeAt(0), 0);
    d.axes.slice(0, 2).forEach((a, i) => { add(a.motions[(seed + i) % a.motions.length]); add(a.motions[(seed + i + 1) % a.motions.length]); });
    d.extras.slice(0, 1).forEach(e => add(e.motions[seed % e.motions.length]));
  } else {
    GENERAL_MOTIONS.forEach(add);
  }
  return out.slice(0, 5);
}

async function voteTopic(debate, topic){
  topic = String(topic || '').replace(/\s+/g, ' ').trim();
  if(topic.length < 3){ alert('Write a topic of at least a few words.'); return; }
  debate.topicVotes = { ...(debate.topicVotes || {}), [state.user.id]: topic };
  render();
  const { data, error } = await callSecure('vote_topic', { debateId: debate.id, topic });
  if(error){ alert(error); return; }
  applyTopicState(debate, data);
}

function applyTopicState(debate, data){
  if(!data) return;
  if(data.votes) debate.topicVotes = data.votes;
  if(data.locked){ debate.topicLocked = true; if(data.topic) debate.topic = data.topic; clearDrafts('topic-custom-'+debate.id); }
  render();
}

// When the 30 seconds run out, ask the server to settle the topic (safe for both players to call).
async function finalizeTopic(debate){
  if(debate._finalizing || debate.topicLocked) return;
  debate._finalizing = true;
  const { data } = await callSecure('finalize_topic', { debateId: debate.id });
  debate._finalizing = false;
  if(data && data.locked){ applyTopicState(debate, data); return; }
  debate.topicLocked = true;   // the server will confirm over realtime; don't hold the chat shut
  render();
}

function renderTopicPhase(debate){
  const opp = otherParticipant(debate) || 'your opponent';
  const oppUser = state.users[opp];
  const votes = debate.topicVotes || {};
  const myVote = votes[state.user.id] || null;
  const theirVote = oppUser && oppUser.id ? (votes[oppUser.id] || null) : null;
  const d = disagreements(debate);
  const left = topicSecondsLeft(debate);

  const box = el('section',{class:'topic-phase'});
  box.appendChild(el('div',{class:'topic-phase__head'},[
    el('div',{},[
      el('div',{class:'kicker'}, 'Pick a topic'),
      el('div',{class:'topic-phase__title'}, 'What will you argue about?'),
    ]),
    el('div',{class:'topic-phase__timer', 'data-topic-countdown':'1'}, '0:'+String(left).padStart(2,'0')),
  ]));
  box.appendChild(el('div',{class:'topic-phase__bar'},[el('div',{class:'topic-phase__fill', 'data-topic-bar':'1', style:'width:'+(left / 30 * 100)+'%;'})]));

  const grid = el('div',{class:'topic-phase__grid'});

  // Where you disagree
  const dis = el('div',{});
  dis.appendChild(el('div',{class:'eyebrow', style:'margin-bottom:12px;'}, 'Where you disagree'));
  if(!d.known){
    dis.appendChild(el('p',{class:'end-panel__note'}, opp+' hasn\'t shared assessment results, so here are some classic topics instead.'));
  } else {
    d.axes.slice(0, 3).forEach(a => {
      dis.appendChild(el('div',{class:'gap-row'},[
        el('div',{class:'gap-row__name'},[el('span',{}, a.name), el('span',{class:'gap-row__size'}, a.gap >= 40 ? 'Big gap' : a.gap >= 20 ? 'Some gap' : 'Close')]),
        el('div',{class:'gap-track'},[
          el('span',{class:'gap-track__line'}),
          el('span',{class:'gap-dot gap-dot--you', style:'left:'+a.mine+'%;', title:'You'}),
          el('span',{class:'gap-dot gap-dot--them', style:'left:'+a.theirs+'%;', title:opp}),
        ]),
        el('div',{class:'gap-row__ends'},[el('span',{}, a.ends[0]), el('span',{}, a.ends[1])]),
      ]));
    });
    d.extras.forEach(e => dis.appendChild(el('div',{class:'gap-row'},[
      el('div',{class:'gap-row__name'},[el('span',{}, e.name)]),
      el('div',{class:'gap-row__vs'},[el('span',{class:'gap-chip gap-chip--you'}, 'You: '+e.mine), el('span',{class:'gap-chip'}, opp+': '+e.theirs)]),
    ])));
    dis.appendChild(el('div',{class:'gap-legend'},[el('span',{class:'gap-dot gap-dot--you gap-dot--inline'}), 'You', el('span',{class:'gap-dot gap-dot--them gap-dot--inline'}), opp]));
  }
  grid.appendChild(dis);

  // Topics to vote on
  const pick = el('div',{});
  pick.appendChild(el('div',{class:'eyebrow', style:'margin-bottom:12px;'}, 'Suggested topics'));
  const topics = suggestedTopics(debate, d);
  [myVote, theirVote].forEach(v => { if(v && !topics.some(t => t.toLowerCase() === v.toLowerCase())) topics.unshift(v); });
  topics.forEach(t => {
    const mine = myVote && myVote.toLowerCase() === t.toLowerCase();
    const theirs = theirVote && theirVote.toLowerCase() === t.toLowerCase();
    pick.appendChild(el('button',{class:'topic-opt' + (mine ? ' is-mine' : '') + (theirs ? ' is-theirs' : ''), onclick:()=>voteTopic(debate, t)},[
      el('span',{class:'topic-opt__text'}, t),
      el('span',{class:'topic-opt__votes'},[
        mine ? el('span',{class:'vote-tag vote-tag--you'}, 'You') : null,
        theirs ? el('span',{class:'vote-tag'}, opp) : null,
      ]),
    ]));
  });
  const custom = draft('topic-custom-'+debate.id, el('input',{type:'text', placeholder:'Or suggest your own topic…', maxlength:'120'}));
  custom.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); voteTopic(debate, custom.value); } });
  pick.appendChild(el('div',{class:'topic-custom'},[custom, el('button',{class:'btn secondary', onclick:()=>voteTopic(debate, custom.value)}, 'Suggest')]));
  grid.appendChild(pick);
  box.appendChild(grid);

  box.appendChild(el('p',{class:'end-panel__note', style:'margin-top:14px;'},
    myVote && theirVote ? 'You picked different topics. Pick the same one to start now, or one of the two is chosen when time runs out.'
    : myVote ? 'Waiting for '+opp+'. If they pick the same topic, the debate starts straight away.'
    : theirVote ? opp+' picked a topic. Pick the same one to start now.'
    : 'Pick one. If you both choose the same topic, the debate starts straight away.'));
  return box;
}

/* ---------- Ending or leaving a debate ----------
   • In the first 15 seconds after you're matched, you can leave on your own (no contest, no points).
   • After that, ending (with AI judging) or leaving (no result) needs BOTH players to agree.
   • If your opponent doesn't answer a request for a minute, you can have the AI judge it anyway.
   The server enforces all of this; the buttons below just mirror it. */
const LEAVE_WINDOW_MS = 15000;
const NO_ANSWER_MS = 60000;
let endActionBusy = false;

function endRequestState(debate){
  const r = debate.endRequest;
  if(!r || r.cancelled) return { type: 'none' };
  if(r.accepted) return r.kind === 'end' ? { type: 'judging', r } : { type: 'closing', r };
  const mine = r.by === (state.user && state.user.id);
  if(r.declined) return { type: mine ? 'declined' : 'none', r };
  return { type: mine ? 'mine' : 'theirs', r };
}

function leaveSecondsLeft(debate){
  return Math.max(0, Math.ceil((debate.createdAt + LEAVE_WINDOW_MS - Date.now()) / 1000));
}

// Re-renders the room when a time limit passes, and keeps the little countdowns ticking in between.
let debateTicker = null;
let debateTickerPhase = '';
// Mirrors the server: you can have it judged after a minute without an answer, or once your
// opponent has said "keep debating" twice and it's been a minute since you first asked.
function declinesOf(r, userId){ return (r && r.tally && r.tally[userId] && r.tally[userId].declines) || 0; }
function canForceEnd(r){
  if(!r || r.accepted || r.declined || r.cancelled) return false;
  const now = Date.now();
  if(now - new Date(r.at).getTime() >= NO_ANSWER_MS) return true;
  const t = r.tally && r.tally[r.by];
  return !!t && t.declines >= 2 && now - new Date(t.firstAt).getTime() >= NO_ANSWER_MS;
}

function debatePhaseKey(debate){
  const st = endRequestState(debate);
  const waited = st.type === 'mine' && canForceEnd(st.r);
  return [debate.id, st.type, leaveSecondsLeft(debate) > 0, waited, topicPhaseActive(debate), !!debate.topicLocked].join('|');
}
function startDebateTicker(){
  if(debateTicker) return;
  debateTicker = setInterval(() => {
    const d = state.user && state.debates[state.user.activeDebateId];
    if(!d || d.verdict || state.tab !== 'debate'){ clearInterval(debateTicker); debateTicker = null; debateTickerPhase = ''; return; }
    const key = debatePhaseKey(d);
    if(debateTickerPhase && key !== debateTickerPhase){ debateTickerPhase = key; render(); if(!(d.topicLocked === false && Date.now() >= d.createdAt + TOPIC_MS)) return; }
    debateTickerPhase = key;
    document.querySelectorAll('[data-leave-countdown]').forEach(n => { n.textContent = leaveSecondsLeft(d) + 's'; });
    const tl = topicSecondsLeft(d);
    document.querySelectorAll('[data-topic-countdown]').forEach(n => { n.textContent = '0:' + String(tl).padStart(2, '0'); });
    document.querySelectorAll('[data-topic-bar]').forEach(n => { n.style.width = Math.max(0, (d.createdAt + TOPIC_MS - Date.now()) / TOPIC_MS * 100) + '%'; });
    if(d.topicLocked === false && Date.now() >= d.createdAt + TOPIC_MS) finalizeTopic(d);
  }, 250);
}

async function endAction(debate, action, extra, before){
  if(endActionBusy) return;
  endActionBusy = true;
  render();
  let result;
  try {
    result = await callSecure(action, { debateId: debate.id, ...(extra || {}) });
  } finally {
    endActionBusy = false;
  }
  const { data, error } = result;
  if(error){
    // Undo anything shown ahead of the server (e.g. the judging screen), then re-read the real state.
    if(before !== undefined) debate.endRequest = before;
    if(judgeAnim && judgeAnim.debateId === debate.id && !debate.verdict && endRequestState(debate).type !== 'judging'){
      if(judgeAnim.timer) clearInterval(judgeAnim.timer);
      judgeAnim = null;
    }
    render();
    alert(error);
    const { data: row } = await sb.from('debates').select('status, verdict, end_request').eq('id', debate.id).maybeSingle();
    if(row){
      debate.endRequest = row.end_request || null;
      if(row.verdict){ debate.verdict = row.verdict; debate.status = row.status; }
      render();
    }
    return;
  }
  if(data.endRequest !== undefined) debate.endRequest = data.endRequest;
  if(data.verdict){
    debate.verdict = data.verdict;
    debate.status = 'ended';
    teardownVideoCall();
    Promise.all([refreshMyProfile(), loadDebateHistory()]).then(render);
  }
  render();
}

// Agreeing to be judged: switch to the judging screen straight away, then wait for the verdict.
function agreeToJudging(debate){
  const r = debate.endRequest;
  if(r && r.kind === 'end') debate.endRequest = { ...r, accepted: true, acceptedAt: new Date().toISOString() };
  startJudgeAnim(debate);
  endAction(debate, 'respond_end', { accept: true }, r);
}

// AI rivals always agree, so go straight to the judging screen.
function endRivalDebate(debate){
  const before = debate.endRequest;
  debate.endRequest = { by: state.user.id, kind: 'end', at: new Date().toISOString(), accepted: true, acceptedAt: new Date().toISOString() };
  startJudgeAnim(debate);
  endAction(debate, 'request_end', { kind: 'end' }, before);
}

function debateEndButtons(debate){
  const opp = otherParticipant(debate) || 'your opponent';
  const st = endRequestState(debate);
  const busy = endActionBusy ? { disabled: 'disabled' } : {};
  const box = el('div',{class:'end-panel'});

  if(st.type === 'theirs'){
    const judged = st.r.kind === 'end';
    box.classList.add('end-panel--ask');
    box.appendChild(el('div',{class:'end-panel__title'}, judged
      ? opp+' wants to end the debate and have the AI judge it.'
      : opp+' wants to leave. The debate would end with no result and no points.'));
    box.appendChild(el('div',{class:'end-panel__row'},[
      el('button',{class:'btn', ...busy, onclick:()=> judged ? agreeToJudging(debate) : endAction(debate, 'respond_end', { accept: true })},
        judged ? 'Agree — judge it now' : 'Agree to leave'),
      el('button',{class:'btn secondary', ...busy, onclick:()=>endAction(debate, 'respond_end', { accept: false })}, 'Keep debating'),
    ]));
    return box;
  }

  if(st.type === 'closing'){
    box.appendChild(el('div',{class:'end-panel__title'},[el('span',{class:'end-panel__dot'}), 'Ending the debate…']));
    return box;
  }

  if(st.type === 'mine'){
    const waitedLong = canForceEnd(st.r);
    const saidNoTwice = declinesOf(st.r, st.r.by) >= 2;
    box.appendChild(el('div',{class:'end-panel__title'},[
      el('span',{class:'end-panel__dot'}),
      'Waiting for '+opp+' to agree to '+(st.r.kind === 'end' ? 'end the debate and get judged' : 'leave with no result')+'…',
    ]));
    const row = el('div',{class:'end-panel__row'});
    if(waitedLong){
      box.appendChild(el('p',{class:'end-panel__note'}, saidNoTwice
        ? opp+' has said "keep debating" twice. You can have the AI judge the debate as it stands.'
        : opp+' hasn\'t answered for a minute. You can have the AI judge the debate as it stands.'));
      row.appendChild(el('button',{class:'btn wine', ...busy, onclick:()=>{
        const before = debate.endRequest;
        debate.endRequest = { ...before, kind: 'end', accepted: true, forced: true };
        startJudgeAnim(debate);
        endAction(debate, 'force_end', null, before);
      }}, 'Have the AI judge it now'));
    }
    row.appendChild(el('button',{class:'btn secondary', ...busy, onclick:()=>endAction(debate, 'cancel_end')}, 'Cancel request'));
    box.appendChild(row);
    return box;
  }

  if(st.type === 'declined'){
    box.appendChild(el('p',{class:'end-panel__note'}, declinesOf(st.r, st.r.by) >= 2
      ? opp+' has said "keep debating" twice — if you ask again, you can have the AI judge it.'
      : opp+' wants to keep debating.'));
  }
  const row = el('div',{class:'end-panel__row'});
  row.appendChild(el('button',{class:'btn wine', ...busy, onclick:()=> rivalOf(debate) ? endRivalDebate(debate) : endAction(debate, 'request_end', { kind: 'end' })}, 'Ask to end & get judged'));
  if(leaveSecondsLeft(debate) > 0){
    row.appendChild(el('button',{class:'btn secondary', ...busy, onclick:()=>leaveDebate(debate)},
      ['Leave now ', el('span',{class:'end-panel__count', 'data-leave-countdown':'1'}, leaveSecondsLeft(debate)+'s')]));
  } else {
    row.appendChild(el('button',{class:'btn secondary', ...busy, onclick:()=>endAction(debate, 'request_end', { kind: 'leave' })}, 'Ask to leave (no result)'));
  }
  box.appendChild(row);
  box.appendChild(el('p',{class:'end-panel__note'}, leaveSecondsLeft(debate) > 0
    ? 'You can leave on your own for the first 15 seconds. After that, you both need to agree to end or leave.'
    : 'Ending or leaving now needs both of you to agree.'));
  return box;
}

async function leaveDebate(debate){
  if(!confirm('Leave this debate? It will end as a no contest — no points either way.')) return;
  await endAction(debate, 'leave_debate');
}

/* ---------- The AI judge at work ----------
   An animated screen while the verdict is worked out. It runs on its own clock (so re-renders
   don't restart it) and speeds up once the verdict has arrived, so it never adds much waiting. */
const JUDGE_STEPS = [
  { label: n => 'Reading the transcript ('+n+' messages)', end: 1.2 },
  { label: () => 'Mapping each side\'s main arguments', end: 2.4 },
  { label: () => 'Checking for 12 logical fallacies', end: 4.2 },
  { label: () => 'Weighing evidence and examples', end: 5.2 },
  { label: () => 'Scoring the rebuttals', end: 6.2 },
  { label: () => 'Deciding the winner', end: Infinity },
];
const JUDGE_PHASES = ['Reading every message…', 'Finding each side\'s claims…', 'Hunting for fallacies…', 'Weighing the evidence…', 'Scoring rebuttals…', 'Reaching a verdict…'];
let judgeAnim = null;

function judgeAnimHolding(debate){
  return !!(judgeAnim && judgeAnim.debateId === debate.id && !judgeAnim.revealed);
}

function startJudgeAnim(debate){
  if(judgeAnim && judgeAnim.debateId === debate.id) return;
  if(judgeAnim && judgeAnim.timer) clearInterval(judgeAnim.timer);
  judgeAnim = { debateId: debate.id, node: null, vt: 0, last: performance.now(), started: Date.now(),
    finishVt: null, doneAt: null, revealed: false, timer: null };
}

function renderJudging(debate){
  startJudgeAnim(debate);
  if(!judgeAnim.node) judgeAnim.node = buildJudgeStage(debate);
  if(!judgeAnim.timer) judgeAnim.timer = setInterval(() => tickJudgeAnim(debate), 50);
  return judgeAnim.node;
}

function buildJudgeStage(debate){
  const lines = debate.chatLog.slice(-8);
  const stage = el('div',{class:'judge-stage'});
  stage.appendChild(el('div',{class:'judge-head'},[
    el('div',{class:'judge-orb', html:
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="54" class="judge-orb__track"/>' +
      '<circle cx="60" cy="60" r="54" class="judge-orb__arc"/>' +
      '<path d="M 38,78 L 38,42 L 60,66 L 82,42 L 82,78" class="judge-orb__m"/></svg>'}),
    el('div',{},[
      el('div',{class:'judge-kicker'}, 'AI JUDGE'),
      el('div',{class:'judge-title'}, 'Reviewing your debate'),
      el('div',{class:'judge-phase'}, JUDGE_PHASES[0]),
    ]),
  ]));

  const body = el('div',{class:'judge-body'});
  const scan = el('div',{class:'judge-scan'});
  scan.appendChild(el('div',{class:'judge-label'}, 'Transcript'));
  const scanList = el('div',{class:'judge-scan__list'});
  (lines.length ? lines : [{ author: '—', text: 'No messages yet' }]).forEach(m => {
    scanList.appendChild(el('div',{class:'judge-line'},[
      el('span',{class:'judge-line__who'}, m.author),
      el('span',{class:'judge-line__text'}, m.text.length > 140 ? m.text.slice(0, 140)+'…' : m.text),
    ]));
  });
  scanList.appendChild(el('div',{class:'judge-scan__beam'}));
  scan.appendChild(scanList);
  body.appendChild(scan);

  const steps = el('div',{class:'judge-steps'});
  steps.appendChild(el('div',{class:'judge-label'}, 'Checklist'));
  JUDGE_STEPS.forEach((st, i) => {
    const row = el('div',{class:'judge-step'},[
      el('span',{class:'judge-step__icon'}),
      el('span',{}, st.label(debate.chatLog.length)),
    ]);
    steps.appendChild(row);
    if(i === 2){
      const chips = el('div',{class:'judge-chips'});
      Object.keys(FALLACY_LABELS).forEach(k => chips.appendChild(el('span',{class:'judge-chip', 'data-key':k}, FALLACY_LABELS[k])));
      steps.appendChild(chips);
    }
  });
  body.appendChild(steps);
  stage.appendChild(body);

  stage.appendChild(el('div',{class:'judge-bar'},[el('div',{class:'judge-bar__fill'})]));
  const slow = el('div',{class:'judge-slow'},[
    el('span',{}, 'This is taking longer than usual. '),
    el('button',{class:'btn secondary', onclick:()=>endAction(debate, 'end_debate')}, 'Try again'),
  ]);
  stage.appendChild(slow);
  return stage;
}

function tickJudgeAnim(debate){
  const a = judgeAnim;
  if(!a || a.debateId !== debate.id){ return; }
  const now = performance.now();
  const dt = (now - a.last) / 1000; a.last = now;
  const d = state.debates[debate.id] || debate;
  const haveVerdict = !!d.verdict;
  a.vt += dt * (haveVerdict ? 6 : 1);

  const stepsEnd = JUDGE_STEPS[4].end;
  if(haveVerdict && a.vt >= stepsEnd && a.finishVt === null) a.finishVt = a.vt + 0.5;
  const finished = a.finishVt !== null && a.vt >= a.finishVt;
  if(finished && !a.doneAt) a.doneAt = now;

  const node = a.node;
  if(node){
    // Checklist
    const rows = node.querySelectorAll('.judge-step');
    let active = JUDGE_STEPS.findIndex(st => a.vt < st.end);
    if(active === -1) active = JUDGE_STEPS.length - 1;
    rows.forEach((row, i) => {
      const done = i < active || (finished && i === JUDGE_STEPS.length - 1);
      row.classList.toggle('is-done', done);
      row.classList.toggle('is-active', !done && i === active);
    });
    node.querySelector('.judge-phase').textContent = finished ? 'Verdict reached' : JUDGE_PHASES[active];
    node.querySelector('.judge-title').textContent = finished ? 'The verdict is in' : 'Reviewing your debate';

    // Transcript scan: steps 1–2 sweep down the messages, later steps keep sweeping more gently.
    const lines = node.querySelectorAll('.judge-line');
    const sweep = a.vt < 2.4 ? a.vt / 2.4 : ((a.vt - 2.4) / 3) % 1;
    const idx = Math.min(lines.length - 1, Math.floor(sweep * lines.length));
    lines.forEach((ln, i) => {
      ln.classList.toggle('is-reading', !finished && i === idx);
      ln.classList.toggle('is-read', a.vt >= 1.2 || i < idx);
    });
    const beam = node.querySelector('.judge-scan__beam');
    if(beam){ beam.style.opacity = finished ? '0' : '1'; if(lines[idx]) beam.style.transform = 'translateY('+lines[idx].offsetTop+'px)'; beam.style.height = (lines[idx] ? lines[idx].offsetHeight : 0)+'px'; }

    // Fallacy chips light up one by one during step 3; any the judge found turn red at the end.
    const chips = node.querySelectorAll('.judge-chip');
    const lit = Math.floor(Math.max(0, a.vt - 2.4) / 0.15);
    const found = new Set();
    if(finished && d.verdict && d.verdict.fallaciesFound){
      Object.values(d.verdict.fallaciesFound).forEach(list => (list || []).forEach(k => found.add(k)));
    }
    chips.forEach((c, i) => {
      c.classList.toggle('is-checking', !finished && i === lit && a.vt < 4.2);
      c.classList.toggle('is-checked', i < lit || a.vt >= 4.2);
      c.classList.toggle('is-found', found.has(c.getAttribute('data-key')));
    });

    // Progress bar creeps towards 90% while waiting, then fills.
    const pct = finished ? 100 : Math.min(90, a.vt < stepsEnd ? (a.vt / stepsEnd) * 80 : 80 + 10 * (1 - Math.exp(-(a.vt - stepsEnd) / 6)));
    node.querySelector('.judge-bar__fill').style.width = pct + '%';
    node.classList.toggle('is-finished', finished);
    node.classList.toggle('is-slow', !haveVerdict && Date.now() - a.started > 45000);
  }

  // Hold "The verdict is in" for a moment, then show the verdict.
  if(a.doneAt && now - a.doneAt > 750){
    clearInterval(a.timer); a.timer = null;
    a.revealed = true;
    render();
  }
}

function renderChatMessages(log, debate){
  log.innerHTML = '';
  debate.chatLog.forEach(m=>{
    const mine = m.author === state.currentUser;
    log.appendChild(el('div',{class:'msg '+(mine?'me':'them'), style: m.pending ? 'opacity:0.6;' : ''},[
      el('span',{class:'tag'}, m.author),
      m.text
    ]));
  });
  if(debate._rivalTyping){
    log.appendChild(el('div',{class:'msg them typing-msg'},[
      el('span',{class:'tag'}, otherParticipant(debate)),
      el('span',{class:'typing-dots', 'aria-label':'typing'},[el('i'),el('i'),el('i')]),
    ]));
  }
  // The log isn't on the page yet when this runs, so scroll once it has been attached.
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}

// Judging happens on the server (secure-actions edge function); these are just display names.
// Keep in sync with FALLACY_KEYS in the ai-assist and secure-actions edge functions.
const FALLACY_LABELS = {
  adHominem: 'Ad hominem',
  strawman: 'Strawman',
  falseEquivalency: 'False equivalence',
  goalpostShift: 'Moving the goalposts',
  selfContradiction: 'Self-contradiction',
  appealToEmotion: 'Appeal to emotion',
  falseDilemma: 'False dilemma',
  circularReasoning: 'Circular reasoning',
  hastyGeneralization: 'Hasty generalization',
  redHerring: 'Red herring',
  appealToAuthority: 'Appeal to authority/popularity',
  nonSequitur: 'Non sequitur',
};

function renderVerdict(debate){
  const v = debate.verdict;
  // Play the reveal once, straight after the judging animation.
  const justRevealed = judgeAnim && judgeAnim.debateId === debate.id && judgeAnim.revealed && !judgeAnim.revealPlayed;
  if(justRevealed) judgeAnim.revealPlayed = true;
  const wrap = el('div',{class: justRevealed ? 'verdict-reveal' : ''});
  wrap.appendChild(el('h2',{class:'section-title'}, v.aiJudged ? 'AI Judge — Verdict' : 'Verdict'));
  const vOpp = otherParticipant(debate);
  if(vOpp && state.users[vOpp] && state.user && !state.user.isGuest){
    wrap.appendChild(el('button',{class:'report-link', style:'margin:-6px 0 12px;', onclick:()=>openReport(vOpp, { type:'debate', id:debate.id, preview: debate.topic ? 'Topic: ' + debate.topic : '' })}, [icon('flag', 13), 'Report ' + vOpp]));
  }
  if(!v.aiJudged && v.forfeit === undefined){
    wrap.appendChild(el('p',{class:'section-sub'}, 'The AI judge wasn\'t reachable for this debate, so a standard scoring pass was used instead.'));
  }

  const aud = audienceVerdict(debate);
  const summaryCard = el('div',{class:'card'});
  const named = v.label || debate.label;
  if(named) summaryCard.appendChild(el('div',{class:'eyebrow', style:'margin-bottom:10px;'}, 'What you debated: '+named));
  if(v.winner === null && v.aiJudged){
    summaryCard.appendChild(el('h3',{},'Draw — too close to call'));
    summaryCard.appendChild(el('p',{style:'font-size:13px;color:var(--parchment-dim);'},
      debate.unranked ? 'Unranked match — no debate points awarded.' : 'Both sides receive draw points.'));
  } else if(v.winner === null){
    summaryCard.appendChild(el('h3',{},'No contest'));
    if(!v.reasoning) summaryCard.appendChild(el('p',{},'The debate ended before it could be judged. No points awarded.'));
  } else {
    summaryCard.appendChild(el('h3',{},'Winner: ' + v.winner + (v.forfeit ? ' (by forfeit)' : '')));
    summaryCard.appendChild(el('p',{style:'font-size:13px;color:var(--parchment-dim);'},
      debate.unranked ? 'Unranked match — no debate points awarded.' : 'Ranked match — debate points awarded to both participants.'));
  }
  if(v.pointsNote){
    summaryCard.appendChild(el('p',{style:'font-size:13px;color:var(--gold);margin:6px 0 0;'}, v.pointsNote));
  }
  if(v.forcedAfterNoAnswer){
    summaryCard.appendChild(el('p',{style:'font-size:13px;color:var(--parchment-dim);margin:6px 0 0;'}, 'Judged after the other player didn\'t agree to end.'));
  }
  if(v.reasoning){
    summaryCard.appendChild(el('div',{style:'height:10px'}));
    if(v.aiJudged) summaryCard.appendChild(el('div',{class:'stat-label'},'AI reasoning'));
    summaryCard.appendChild(el('p',{style:'font-size:13.5px;color:var(--parchment-dim);'}, v.reasoning));
  }
  wrap.appendChild(summaryCard);
  if(aud) wrap.appendChild(aud);

  if((v.winner !== null || v.aiJudged) && !v.forfeit){
    wrap.appendChild(el('div',{style:'height:14px'}));
    const grid = el('div',{class:'grid grid-2'});
    debate.participants.forEach(u=>{
      const fallacies = (v.fallaciesFound && v.fallaciesFound[u]) || [];
      const card = el('div',{class:'card'},[
        el('h3',{}, u + (u===v.winner ? ' (winner)' : '')),
        el('div',{class:'stat-label'},'Judge score'),
        el('div',{class:'stat-big'}, String((v.scores && v.scores[u]) || 0)),
        el('div',{style:'height:10px'}),
        el('div',{class:'stat-label'},'Fallacies flagged this debate'),
        fallacies.length
          ? el('p',{style:'font-size:13px;'}, fallacies.map(f => FALLACY_LABELS[f] || f).join(', '))
          : el('p',{style:'font-size:13px;color:var(--parchment-dim);'},'None detected'),
      ]);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  }

  wrap.appendChild(el('div',{style:'height:18px'}));
  wrap.appendChild(el('button',{class:'btn', onclick:()=>{
    const finishedId = state.user.activeDebateId;
    state.user.activeDebateId = null;
    if(finishedId){ delete state.debates[finishedId]; clearDrafts('debate-msg-'+finishedId); }
    if(debateChannel){ sb.removeChannel(debateChannel); debateChannel = null; }
    navigateWithLoading('debate');
  }},'Return to Lobby'));

  return wrap;
}

function forumReplyCount(p){ return p.replies.length; }

function openThread(id){
  state.forumOpenThread = (state.forumOpenThread === id) ? null : id;
  if(state.forumOpenThread === id){
    const p = state.forum.find(x=>x.id===id);
    if(p){
      p.views = (p.views||0) + 1;
      sb.rpc('increment_forum_views', { pid: id }).then(({ error }) => { if(error) console.warn('increment_forum_views failed', error); });
    }
  }
  render();
}

function renderThreadDetail(p){
  const box = el('div',{class:'thread-detail'});
  box.appendChild(el('h3',{style:'margin:0;'}, p.title));
  box.appendChild(el('div',{class:'meta'}, nameWithTag(p.author, '', ' · '+timeAgo(p.createdAt)+' · '+p.category)));
  box.appendChild(el('div',{class:'t-detail-body'}, p.body));
  if(p.author !== state.currentUser && state.users[p.author] && (state.user && !state.user.isGuest)){
    box.appendChild(el('button',{class:'report-link', title:'Report this thread', onclick:(e)=>{ e.stopPropagation(); openReport(p.author, { type:'forum_post', id:p.id, preview:p.title }); }}, [icon('flag', 13), 'Report']));
  }
  if(canModerate() || p.authorId === (state.user && state.user.id)){
    box.appendChild(el('button',{class:'btn secondary', style:'padding:5px 12px;font-size:12px;color:var(--wine);border-color:var(--wine);', onclick:(e)=>{ e.stopPropagation(); deleteForumPost(p.id); }}, 'Delete thread'));
  }

  if(p.replies.length){
    const repliesWrap = el('div',{});
    p.replies.forEach(r=>{
      const replyRow = el('div',{class:'reply-row'},[
        avatarNode(r.author, 30),
        el('div',{style:'flex:1;'},[
          el('div',{class:'meta'}, nameWithTag(r.author, '', ' · '+timeAgo(r.createdAt))),
          el('div',{class:'r-body'}, r.body),
        ]),
      ]);
      if(r.author !== state.currentUser && state.users[r.author] && (state.user && !state.user.isGuest)){
        replyRow.appendChild(el('button',{class:'report-link', title:'Report this reply', onclick:(e)=>{ e.stopPropagation(); openReport(r.author, { type:'forum_reply', id:r.id, preview:r.body }); }}, icon('flag', 13)));
      }
      if(canModerate() || r.authorId === (state.user && state.user.id)){
        replyRow.appendChild(el('button',{class:'btn secondary', style:'padding:3px 8px;font-size:11px;color:var(--wine);border-color:var(--wine);align-self:flex-start;', onclick:(e)=>{ e.stopPropagation(); deleteForumReply(r.id); }}, 'Delete'));
      }
      repliesWrap.appendChild(replyRow);
    });
    box.appendChild(repliesWrap);
  }

  const replyIn = draft('forum-reply-'+p.id, el('textarea',{placeholder:'Write a reply...', style:'min-height:70px;margin-top:12px;'}));
  box.appendChild(replyIn);
  const replyBtn = el('button',{class:'btn secondary', style:'margin-top:8px;', onclick: async (e)=>{
    e.stopPropagation();
    const b = replyIn.value.trim();
    if(!b) return;
    if(state.user.isGuest){ alert('Create an account to reply.'); return; }
    replyBtn.disabled = true;
    const { data: r, error } = await sb.from('forum_replies').insert({ post_id: p.id, author_id: state.user.id, body: b }).select('id, created_at').single();
    replyBtn.disabled = false;
    if(error){ automodNote(error, 'forum', b); alert(friendlyDbError(error, 'That reply couldn\'t be posted.')); return; }
    clearDrafts('forum-reply-'+p.id);
    // Add it straight to the page (the live feed may also deliver it; duplicates are skipped by id).
    if(!p.replies.some(x => x.id === r.id)){
      p.replies.push({ id: r.id, author: state.currentUser, authorId: state.user.id, body: b, createdAt: new Date(r.created_at).getTime() });
    }
    render();
  }},'Post reply');
  box.appendChild(replyBtn);

  box.addEventListener('click', (e)=>e.stopPropagation());
  return box;
}

function renderForum(){
  forumTick();
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Forum — Discussions'));
  wrap.appendChild(el('p',{class:'section-sub'},'Open threads and unranked exchanges.'));

  const totalReplies = state.forum.reduce((s,p)=>s+forumReplyCount(p),0);
  const totalViews = state.forum.reduce((s,p)=>s+(p.views||0),0);
  const statsStrip = el('div',{class:'forum-stats-strip'},[
    el('div',{class:'fstat'},[el('b',{}, state.forum.length), el('span',{},'Threads')]),
    el('div',{class:'fstat'},[el('b',{}, totalReplies), el('span',{},'Replies')]),
    el('div',{class:'fstat'},[el('b',{}, totalViews), el('span',{},'Views')]),
  ]);
  wrap.appendChild(statsStrip);

  const newPostCard = el('div',{class:'card'});
  newPostCard.appendChild(el('h3',{},'Start a thread'));
  const titleIn = draft('forum-title', el('input',{type:'text', placeholder:'Thread title', maxlength:'200'}));
  const catIn = draft('forum-category', el('select',{}, FORUM_CATEGORIES.map(c=>el('option',{value:c},c))));
  const bodyIn = draft('forum-body', el('textarea',{placeholder:'Lay out your position or question...'}));
  newPostCard.appendChild(el('div',{class:'field'},[el('label',{},'Title'), titleIn]));
  newPostCard.appendChild(el('div',{class:'field'},[el('label',{},'Category'), catIn]));
  newPostCard.appendChild(el('div',{class:'field'},[el('label',{},'Body'), bodyIn]));
  const postBtn = el('button',{class:'btn', onclick: async ()=>{
    const t = titleIn.value.trim(), b = bodyIn.value.trim();
    if(state.user.isGuest){ alert('Create an account to post a thread.'); return; }
    if(!t || !b){ alert('Add a title and body.'); return; }
    postBtn.disabled = true; postBtn.textContent = 'Posting...';
    const category = catIn.value;
    const { data: row, error } = await sb.from('forum_posts').insert({ title: t, body: b, category, author_id: state.user.id }).select('id, created_at').single();
    postBtn.disabled = false; postBtn.textContent = 'Post thread';
    if(error){ automodNote(error, 'forum', t + ' ' + b); alert(friendlyDbError(error, 'That thread couldn\'t be posted.')); return; }
    clearDrafts('forum-title', 'forum-category', 'forum-body');
    if(!state.forum.some(x => x.id === row.id)){
      state.forum.unshift({ id: row.id, title: t, author: state.currentUser, authorId: state.user.id, category,
        createdAt: new Date(row.created_at).getTime(), views: 0, body: b, replies: [] });
    }
    render();
  }},'Post thread');
  newPostCard.appendChild(postBtn);
  wrap.appendChild(newPostCard);
  wrap.appendChild(el('div',{class:'divider'}));

  if(state.forum.length===0){
    wrap.appendChild(el('p',{class:'empty-note'},'No threads posted yet.'));
    return wrap;
  }

  const SORTS = [['new','Newest'],['active','Most replies'],['viewed','Most viewed']];
  const toolbar = el('div',{class:'forum-toolbar'},[
    el('span',{style:'font-size:12px;color:var(--parchment-dim);'}, state.forum.length+' thread'+(state.forum.length===1?'':'s')),
    el('div',{class:'sort-group'}, SORTS.map(([key,label])=>
      el('button',{class:'sort-chip'+(state.forumSort===key?' active':''), onclick:()=>{ state.forumSort = key; state.forumPage = 1; render(); }}, label)
    )),
  ]);
  wrap.appendChild(toolbar);

  let sorted = state.forum.slice();
  if(state.forumSort === 'active') sorted.sort((a,b)=>forumReplyCount(b)-forumReplyCount(a));
  else if(state.forumSort === 'viewed') sorted.sort((a,b)=>(b.views||0)-(a.views||0));
  else sorted.sort((a,b)=>b.createdAt-a.createdAt);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if(state.forumPage > totalPages) state.forumPage = totalPages;
  const start = (state.forumPage - 1) * PAGE_SIZE;

  const list = el('div',{class:'thread-list'});
  sorted.slice(start, start + PAGE_SIZE).forEach(p=>{
    const lastActivity = p.replies.length ? p.replies[p.replies.length-1] : null;
    const row = el('div',{class:'thread-row', onclick:()=>openThread(p.id)},[
      avatarNode(p.author, 38),
      el('div',{class:'t-main'},[
        el('div',{class:'t-title-line'},[
          el('span',{class:'cat-chip'}, p.category),
          el('span',{class:'t-title'}, p.title),
        ]),
        el('div',{class:'t-meta'}, nameWithTag(p.author, 'by ', ' · '+timeAgo(p.createdAt))),
      ]),
      el('div',{class:'t-nums'},[
        el('div',{class:'t-num'},[el('b',{}, forumReplyCount(p)), el('span',{},'Replies')]),
        el('div',{class:'t-num'},[el('b',{}, p.views||0), el('span',{},'Views')]),
      ]),
      el('div',{class:'t-last'},[
        avatarNode(lastActivity ? lastActivity.author : p.author, 28),
        el('div',{class:'t-last-info'},[
          el('span',{class:'t-last-who'}, nameWithTag(lastActivity ? lastActivity.author : p.author)),
          el('span',{class:'t-last-time'}, timeAgo(lastActivity ? lastActivity.createdAt : p.createdAt)),
        ]),
      ]),
    ]);
    list.appendChild(row);
    if(state.forumOpenThread === p.id){
      list.appendChild(renderThreadDetail(p));
    }
  });
  wrap.appendChild(list);

  if(totalPages > 1){
    const pager = el('div',{style:'display:flex;justify-content:center;gap:10px;align-items:center;margin-top:14px;'});
    pager.appendChild(el('button',{class:'btn secondary', style: state.forumPage<=1?'opacity:0.4;pointer-events:none;':'', onclick:()=>{ state.forumPage--; render(); }}, '← Prev'));
    pager.appendChild(el('span',{style:'font-size:13px;color:var(--parchment-dim);'}, 'Page '+state.forumPage+' of '+totalPages));
    pager.appendChild(el('button',{class:'btn secondary', style: state.forumPage>=totalPages?'opacity:0.4;pointer-events:none;':'', onclick:()=>{ state.forumPage++; render(); }}, 'Next →'));
    wrap.appendChild(pager);
  }

  return wrap;
}

let lastRivalTick = 0;
function renderLeaderboard(){
  if(Date.now() - lastRivalTick > 10 * 60 * 1000 && state.user && !state.user.isGuest){
    lastRivalTick = Date.now();
    callSecure('rivals_tick', {}).then(r => { if(r && r.data && (r.data.moved || r.data.retired || r.data.books)) loadAllProfiles().then(render); });
  }
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Leaderboard'));
  wrap.appendChild(el('p',{class:'section-sub'},'Active user rankings for reading and debating.'));
  
  // People who hid themselves from the leaderboard or made their profile private are left out.
  const accounts = Object.values(state.users).filter(u=>!u.isGuest && !u.hiddenStats && (!u.settings || u.settings.showOnLeaderboard !== false));
  if(!accounts.length){
    wrap.appendChild(el('p',{class:'empty-note'},'No registered accounts available on leaderboard.'));
    return wrap;
  }

  const grid = el('div',{class:'grid grid-2'});
  const debateCard = el('div',{class:'card'},[el('h3',{},'Top Debaters')]);
  [...accounts].sort((a,b)=>(b.debatePoints||0)-(a.debatePoints||0)).forEach((u,i)=>{
    debateCard.appendChild(el('div',{class:'book-row'},[
      leaderboardNameCell(u, i),
      el('div',{class:'points-tag'}, u.debateRank ? 'Rank '+u.debateRank : 'Unranked')
    ]));
  });
  grid.appendChild(debateCard);

  const readingCard = el('div',{class:'card'},[el('h3',{},'Top Readers')]);
  [...accounts].sort((a,b)=>(b.readingElo||0)-(a.readingElo||0)).forEach((u,i)=>{
    readingCard.appendChild(el('div',{class:'book-row'},[
      leaderboardNameCell(u, i),
      el('div',{class:'points-tag'}, 'Elo '+(u.readingElo||0))
    ]));
  });
  grid.appendChild(readingCard);

  wrap.appendChild(grid);
  return wrap;
}

function leaderboardNameCell(u, i){
  const isMe = u.username === state.currentUser;
  const parts = [
    el('div',{style:'display:flex;align-items:center;gap:10px;'},[
      el('span',{}, i+1+'.'),
      avatarNode(u, 28),
      el('button',{class:'user-link', onclick:()=>viewProfile(u.username)}, u.name),
    ])
  ];
  if(!isMe && !state.user.isGuest){
    parts.push(el('button',{
      class: 'btn secondary', style:'padding:2px 10px;font-size:11px;margin-left:10px;',
      onclick: (e)=>{ e.stopPropagation(); toggleFollow(u.username); }
    }, isFollowing(u.username) ? 'Following' : 'Follow'));
  }
  return el('div',{style:'display:flex;align-items:center;'}, parts);
}

function renderRanks(){
  const wrap = el('div',{});
  const u = state.user;
  const ranked = !u.isGuest && u.placementTaken;
  const rank = ranked ? rankFromPoints(u.debatePoints || 0) : 0;
  const tier = ranked ? Math.min(9, Math.floor((rank - 1) / 10)) : -1;
  const title = ranked ? titleFor(DEBATE_RANK_TITLES, rank) : '';

  wrap.appendChild(el('div',{class:'kicker'}, 'Your climb'));
  wrap.appendChild(el('h2',{class:'section-title ladder__title'}, ranked
    ? 'Rank ' + rank + ', ' + title + '. ' + (9 - tier === 0 ? 'You\'re in the top tier.' : (9 - tier) + (9 - tier === 1 ? ' tier' : ' tiers') + ' to the top.')
    : 'Ten tiers from Novice to Hakim.'));
  wrap.appendChild(el('p',{class:'section-sub'}, 'There are 100 ranks in ten tiers. Win debates and finish books to climb; each rank takes more points than the last, and you\'re matched with people near your rank.'));
  if(ranked){
    wrap.appendChild(el('div',{class:'hero__cta', style:'margin:-18px 0 28px;'},[
      el('button',{class:'btn', onclick:()=>navigateWithLoading('debate')}, ['Climb: debate now', icon('arrow', 16)]),
      el('button',{class:'btn secondary', onclick:()=>navigateWithLoading('reading')}, 'Climb: log a book'),
    ]));
  } else {
    wrap.appendChild(el('button',{class:'btn', style:'margin:-18px 0 28px;', onclick:()=>navigateWithLoading(u.isGuest ? 'home' : 'assessment')}, u.isGuest ? 'Create an account to get ranked' : 'Take the assessment to get ranked'));
  }

  const ladder = el('div',{class:'ladder'});
  DEBATE_RANK_TITLES.forEach((t, i) => {
    const cls = i < tier ? ' is-done' : i === tier ? ' is-here' : '';
    const step = el('div',{class:'ladder__step' + cls, style:'height:' + (26 + i * 7.4) + '%;'},[
      el('div',{class:'ladder__num'}, String(i + 1)),
      el('div',{class:'ladder__name'}, t.title),
      el('div',{class:'ladder__range'}, 'Ranks ' + t.min + '–' + t.max),
    ]);
    if(i === tier){
      step.appendChild(el('div',{class:'ladder__you'},[el('span',{class:'ladder__tag'}, 'You are here'), avatarNode(u, 40)]));
    }
    ladder.appendChild(step);
  });
  wrap.appendChild(ladder);

  if(ranked){
    wrap.appendChild(el('div',{style:'height:22px'}));
    const rankCard = el('div',{class:'card'});
    rankCard.appendChild(el('h3',{},'Next rank'));
    rankCard.appendChild(renderRankProgress(u));
    wrap.appendChild(rankCard);
  }
  return wrap;
}

// Everyone who has mapped their views and isn't hidden or blocked.
function compassCrowd(){
  return Object.values(state.users).filter(x => x.compass && !x.isGuest && !x.hiddenStats && !x.aiRetired && x.username !== state.currentUser && !isBlocked(x.username));
}

// Keep dots inside the map's rounded edges.
function clampDot(p){ return { x: Math.max(3, Math.min(97, p.x)), y: Math.max(3, Math.min(97, p.y)) }; }

// One big map. `dots` are other people; `focus` is the person the map is about.
function compassMap(section, focus, dots, farthest){
  const def = COMPASS_DEFS[section];
  const map = el('div',{class:'opposites__map'},[
    el('div',{class:'compass-quad q-tl'}), el('div',{class:'compass-quad q-tr'}),
    el('div',{class:'compass-quad q-bl'}), el('div',{class:'compass-quad q-br'}),
    el('div',{class:'compass-crosshair-v'}), el('div',{class:'compass-crosshair-h'}),
  ]);
  (dots || []).slice(0, 150).forEach(x => {
    const p = clampDot(x.compass[section]);
    const cls = 'opp-dot' + (farthest && farthest === x ? ' is-far' : '') + (x.username === state.currentUser ? ' is-me' : '');
    const dot = el('button',{class: cls, title: x.name, 'aria-label': x.name, style:'left:' + p.x + '%;top:' + (100 - p.y) + '%;', onclick:()=>viewProfile(x.username)});
    if(x.username === state.currentUser) dot.appendChild(el('span',{class:'opp-dot__label'}, 'You'));
    map.appendChild(dot);
  });
  if(focus && focus.compass){
    const fp = clampDot(focus.compass[section]);
    map.appendChild(el('span',{class:'opp-dot is-focus', style:'left:' + fp.x + '%;top:' + (100 - fp.y) + '%;'},
      el('span',{class:'opp-dot__label'}, focus.username === state.currentUser ? 'You' : focus.name)));
  }
  return el('div',{class:'opposites__mapwrap'},[
    el('div',{class:'opposites__axis is-top'}, def.yLabels[0]), map, el('div',{class:'opposites__axis is-bottom'}, def.yLabels[1]),
    el('div',{class:'opposites__axis is-left'}, def.xLabels[0]), el('div',{class:'opposites__axis is-right'}, def.xLabels[1]),
  ]);
}

function ideologyLabel(person, section){
  const ai = person && person.ideologies && person.ideologies[section];
  return (ai && ai.label) ? ai.label : deriveQuadrantIdeology(section, person.compass[section]);
}

// A single person's compass (profiles): their dot, plus yours to compare.
function renderQuadrantCompass(section, pair, person){
  const def = COMPASS_DEFS[section];
  const label = ideologyLabel(person, section);
  const isMe = person.username === state.currentUser;
  const me = state.user;
  const panel = el('section',{class:'opposites compass-panel'});
  const text = el('div',{class:'opposites__text'},[
    el('div',{class:'kicker'}, def.title),
    el('h3',{class:'opposites__title'}, label),
  ]);
  const aiIdeo = person.ideologies && person.ideologies[section];
  if(aiIdeo && aiIdeo.reasoning) text.appendChild(el('p',{class:'opposites__sub'}, aiIdeo.reasoning));
  if(!isMe && me && me.compass){
    text.appendChild(el('p',{class:'opposites__sub'}, 'You: ' + ideologyLabel(me, section) + '. Your dot is on the map too.'));
  }
  panel.appendChild(text);
  panel.appendChild(compassMap(section, person, (!isMe && me && me.compass) ? [me] : []));
  return panel;
}

function compassDistanceOn(section, a, b){
  return Math.hypot(a[section].x - b[section].x, a[section].y - b[section].y);
}

function renderCompass(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Compass'));
  wrap.appendChild(el('p',{class:'section-sub'},'Three separate ideological maps — economic, political, and social — each derived from its own set of mapping questions.'));

  if(!state.user.placementTaken || !state.user.compass){
    wrap.appendChild(el('div',{class:'card'},[
      el('h3',{},'Not yet mapped'),
      el('p',{},'Take the placement assessment to compute your ideological coordinates.'),
      el('button',{class:'btn', onclick:()=>navigateWithLoading('assessment')},'Go to Assessment'),
    ]));
    return wrap;
  }

  const c = state.user.compass;
  const card = el('div',{class:'card'});
  card.appendChild(el('h3',{},'Philosophical archetype: ' + state.user.archetype));
  if(state.user.archetypeReasoning){
    card.appendChild(el('p',{style:'font-size:13px;color:var(--parchment-dim);margin-bottom:8px;'}, state.user.archetypeReasoning));
  }
  card.appendChild(el('p',{style:'font-size:12px;color:var(--parchment-dim);margin-bottom:20px;'},
    state.user.ideologyAiAnalyzed
      ? 'Determined by AI, reasoning directly from your specific answers.'
      : 'The AI analysis wasn\'t reachable when you took this — a standard scoring pass was used instead.'));
  if(state.user.religion && state.user.religion !== 'Prefer not to say'){
    card.appendChild(el('div',{style:'height:6px'}));
    card.appendChild(el('h3',{},'Religious/spiritual identity: ' + state.user.religion + (state.user.denomination ? ' — '+state.user.denomination : '')));
    if(state.user.denominationReasoning){
      card.appendChild(el('p',{style:'font-size:13px;color:var(--parchment-dim);margin-bottom:20px;'}, state.user.denominationReasoning));
    } else {
      card.appendChild(el('div',{style:'height:20px'}));
    }
  }
  ['political', 'economic', 'social'].forEach(sec => wrap.appendChild(renderCompassSection(sec)));
  wrap.appendChild(card);
  return wrap;
}

// One compass on the Compass page: everyone's dots, yours in green, and who sits furthest away.
function renderCompassSection(section){
  const me = state.user;
  const def = COMPASS_DEFS[section];
  const crowd = compassCrowd();
  const ranked = crowd.map(x => ({ x, d: compassDistanceOn(section, me.compass, x.compass) })).sort((p, q) => q.d - p.d);
  const panel = el('section',{class:'opposites compass-panel'});
  const text = el('div',{class:'opposites__text'});
  text.appendChild(el('div',{class:'kicker'}, def.title));
  const label = ideologyLabel(me, section);
  text.appendChild(el('h3',{class:'opposites__title'}, 'You\'re ' + (/^[aeiou]/i.test(label) ? 'an ' : 'a ') + label + '. Here\'s who disagrees with you most.'));
  text.appendChild(el('p',{class:'opposites__sub'}, crowd.length
    ? 'Every dot is someone on Majlis (' + crowd.length + ' on this map). Tap a dot to see who it is. The furthest from you make the best debates.'
    : 'Nobody else has mapped their views yet.'));
  ranked.slice(0, 3).forEach(({ x }) => text.appendChild(el('div',{class:'opposite-row'},[
    avatarNode(x, 34),
    el('div',{class:'opposite-row__main'},[
      el('button',{class:'user-link', onclick:()=>viewProfile(x.username)}, x.name),
      el('div',{class:'opposite-row__meta'}, ideologyLabel(x, section) + (x.archetype ? ' · ' + x.archetype : '')),
    ]),
    el('button',{class:'btn secondary', onclick:()=>openDM(x.username)}, 'Challenge'),
  ])));
  panel.appendChild(text);
  panel.appendChild(compassMap(section, me, crowd, ranked.length ? ranked[0].x : null));
  return panel;
}

function renderProfile(){
  if(state.viewingProfile && state.viewingProfile !== state.currentUser){
    return renderOtherProfile(state.viewingProfile);
  }
  return renderOwnProfile();
}

function connectionsList(usernames, emptyText, opts={}){
  const box = el('div',{});
  if(!usernames.length){
    box.appendChild(el('p',{class:'empty-note'}, emptyText));
    return box;
  }
  usernames.forEach(uname=>{
    const person = state.users[uname];
    if(!person) return;
    const row = el('div',{class:'book-row'},[
      el('div',{style:'display:flex;align-items:center;gap:10px;'},[
        avatarNode(person, 30),
        el('button',{class:'user-link', onclick:()=>viewProfile(uname)}, person.name),
        areFriends(state.currentUser, uname) ? el('span',{class:'friend-badge'},'Friends') : null,
      ]),
    ]);
    if(opts.unfollowable){
      row.appendChild(el('button',{class:'btn secondary', style:'padding:4px 12px;font-size:12px;', onclick:()=>toggleFollow(uname)}, 'Unfollow'));
    } else if(opts.followBack){
      row.appendChild(el('button',{class:'btn secondary', style:'padding:4px 12px;font-size:12px;', onclick:()=>toggleFollow(uname)},
        isFollowing(uname) ? 'Following' : 'Follow back'));
    }
    box.appendChild(row);
  });
  return box;
}

function renderOwnProfile(){
  const wrap = el('div',{});
  const u = state.user;
  wrap.appendChild(el('div',{class:'profile-header-row'},[
    avatarNode(u, 76),
    el('div',{},[
      el('h2',{class:'section-title', style:'margin:0;'}, u.name + (u.isGuest ? ' (guest)' : '')),
    ]),
  ]));
  wrap.appendChild(el('p',{class:'section-sub'}, u.isGuest
    ? 'Guest session — nothing is saved. Create an account to keep your progress and use it on any device.'
    : 'Account profile and stats.'));
  if(!u.isGuest){
    wrap.appendChild(el('div',{class:'profile-badges'},[el('div',{class:'eyebrow'},['Badges ', streakChip()]), badgeRow(state.currentUser, 'lg')]));
  }
  if(u.bio){
    wrap.appendChild(el('p',{class:'bio-text', style:'margin:-18px 0 22px;'}, u.bio));
  }

  const grid = el('div',{class:'grid grid-2'});
  grid.appendChild(statCard('Reading Elo', u.readingElo));
  grid.appendChild(statCard('Debate Rank', u.debateRank ? '#'+u.debateRank : '—'));
  wrap.appendChild(grid);
  wrap.appendChild(el('div',{style:'height:14px'}));
  if(u.placementTaken){
    const rankCard = el('div',{class:'card'});
    rankCard.appendChild(renderRankProgress(u));
    wrap.appendChild(rankCard);
  }
  wrap.appendChild(el('div',{style:'height:18px'}));

  const connGrid = el('div',{class:'grid grid-2'});
  connGrid.appendChild(statCard('Following', (u.following||[]).length));
  connGrid.appendChild(statCard('Followers', (u.followers||[]).length));
  wrap.appendChild(connGrid);
  wrap.appendChild(el('div',{style:'height:18px'}));

  if(!u.isGuest){
    const connectionsCard = el('div',{class:'card'});
    connectionsCard.appendChild(el('h3',{},'Connections'));
    connectionsCard.appendChild(el('p',{style:'font-size:12px;color:var(--parchment-dim);margin:-4px 0 14px;'},'Following someone who follows you back marks you as friends.'));
    connectionsCard.appendChild(el('div',{style:'font-size:12.5px;color:var(--parchment-dim);margin-bottom:4px;'},'Following'));
    connectionsCard.appendChild(connectionsList(u.following||[], 'Not following anyone yet — find people on the Leaderboard or via search.', {unfollowable:true}));
    connectionsCard.appendChild(el('div',{class:'divider'}));
    connectionsCard.appendChild(el('div',{style:'font-size:12.5px;color:var(--parchment-dim);margin-bottom:4px;'},'Followers'));
    connectionsCard.appendChild(connectionsList(u.followers||[], 'No followers yet.', {followBack:true}));
    wrap.appendChild(connectionsCard);
    wrap.appendChild(el('div',{style:'height:18px'}));
  }

  const fallacyCard = el('div',{class:'card'});
  fallacyCard.appendChild(el('h3',{},'Fallacy record'));
  const stats = u.fallacyStats || { total: 0 };
  if(!stats.total){
    fallacyCard.appendChild(el('p',{class:'empty-note'},'No fallacies flagged yet.'));
  } else {
    Object.entries(FALLACY_LABELS).forEach(([key, label])=>{
      if(stats[key]){
        fallacyCard.appendChild(el('div',{class:'book-row'},[
          el('div',{}, label),
          el('div',{class:'points-tag'}, String(stats[key])),
        ]));
      }
    });
  }
  wrap.appendChild(fallacyCard);
  wrap.appendChild(el('div',{style:'height:18px'}));

  const historyCard = el('div',{class:'card'});
  historyCard.appendChild(el('h3',{},'Debate history'));
  const history = u.debateHistory || [];
  if(!history.length){
    historyCard.appendChild(el('p',{class:'empty-note'},'No completed debates yet.'));
  } else {
    history.slice(0,15).forEach(h=>{
      historyCard.appendChild(el('div',{class:'book-row'},[
        el('div',{},[
          el('div',{class:'book-title'}, h.topic),
          el('div',{class:'book-meta'}, h.mode+' vs. '+h.opponent+(h.unranked?' · unranked':' · ranked')),
        ]),
        el('div',{class:'points-tag', style: h.result==='win' ? 'color:var(--brass-bright);' : h.result==='loss' ? 'color:var(--wine);' : 'color:var(--parchment-dim);'},
          h.result==='win' ? 'Win' : h.result==='loss' ? 'Loss' : h.result==='draw' ? 'Draw' : 'No contest'),
      ]));
    });
  }
  wrap.appendChild(historyCard);

  wrap.appendChild(el('div',{style:'height:18px'}));
  const accountCard = el('div',{class:'card'});
  accountCard.appendChild(el('h3',{},'Account'));
  const accountBtns = el('div',{style:'display:flex;gap:10px;flex-wrap:wrap;'});
  accountBtns.appendChild(el('button',{class:'btn secondary', onclick:()=>navigateWithLoading('settings')}, 'Settings'));
  if(!u.isGuest){
    accountBtns.appendChild(el('button',{class:'btn secondary', onclick: logout}, 'Log out'));
  }
  accountCard.appendChild(accountBtns);
  wrap.appendChild(accountCard);

  return wrap;
}

function renderOtherProfile(username){
  const wrap = el('div',{});
  const person = state.users[username];
  if(!person){
    wrap.appendChild(el('h2',{class:'section-title'},'User not found'));
    wrap.appendChild(el('button',{class:'btn secondary', onclick: goToOwnProfile},'Back to your profile'));
    return wrap;
  }

  const titleRow = el('div',{class:'profile-header-row'},[
    avatarNode(person, 76),
    el('div',{class:'name-with-avatar'},[
      el('h2',{class:'section-title', style:'margin:0;'}, person.name),
      areFriends(state.currentUser, username) ? el('span',{class:'friend-badge'},'Friends') : null,
    ]),
  ]);
  wrap.appendChild(titleRow);
  const isPrivate = person.hiddenStats || (person.settings && person.settings.profileVisibility === 'private');
  wrap.appendChild(el('p',{class:'section-sub'}, (person.followers||[]).length + ' followers · ' + (person.following||[]).length + ' following'));

  if(person.bio){
    wrap.appendChild(el('p',{class:'bio-text', style:'margin-top:-14px;margin-bottom:14px;max-width:520px;'}, person.bio));
  }
  if(person.aiRetired){
    wrap.appendChild(el('p',{class:'field-caption', style:'margin-top:-6px;margin-bottom:14px;'}, 'This AI rival has retired.'));
  }

  const blockedByMe = isBlocked(username);

  if(!state.user.isGuest && !blockedByMe){
    const mutuals = getMutuals(username);
    if(mutuals.length){
      wrap.appendChild(el('div',{class:'mutuals-row'},[
        'Followed by ',
        mutuals.slice(0,3).map((mu,i)=> el('span',{},[
          el('button',{class:'user-link', style:'font-size:12.5px;', onclick:()=>viewProfile(mu)}, state.users[mu]?state.users[mu].name:mu),
          i < Math.min(mutuals.length,3)-1 ? ', ' : '',
        ])),
        mutuals.length>3 ? (' and '+(mutuals.length-3)+' more you follow') : (mutuals.length>1 ? ' — people you follow' : ' — someone you follow'),
      ]));
    }
  }

  wrap.appendChild(el('div',{style:'height:14px'}));

  if(blockedByMe){
    wrap.appendChild(el('div',{class:'blocked-banner'}, 'You have blocked '+person.name+'. Unblock them to interact again.'));
    wrap.appendChild(el('button',{class:'btn secondary', onclick:()=>toggleBlock(username)}, 'Unblock'));
    return wrap;
  }

  wrap.appendChild(el('div',{class:'profile-badges'},[el('div',{class:'eyebrow'}, 'Badges'), badgeRow(username, 'lg')]));
  const actionRow = el('div',{style:'display:flex;gap:10px;flex-wrap:wrap;'});
  if(!state.user.isGuest){
    actionRow.appendChild(el('button',{
      class: isFollowing(username) ? 'btn secondary' : 'btn',
      onclick: ()=>toggleFollow(username)
    }, isFollowing(username) ? 'Following' : 'Follow'));
    actionRow.appendChild(el('button',{class:'btn secondary', onclick:()=>openDM(username)}, 'Message'));
    actionRow.appendChild(el('button',{class:'btn secondary', style:'color:var(--wine);border-color:var(--wine);', onclick:()=>toggleBlock(username)}, 'Block'));
    actionRow.appendChild(el('button',{class:'btn secondary', onclick:()=>openReport(username, { type:'profile' })}, [icon('flag', 15), 'Report']));
  }
  wrap.appendChild(actionRow);
  wrap.appendChild(el('div',{style:'height:22px'}));

  if(isPrivate){
    wrap.appendChild(el('div',{class:'card'},[
      el('h3',{},'This profile is private'),
      el('p',{},'Only the name and connection counts above are visible.'),
    ]));
    return wrap;
  }

  const grid = el('div',{class:'grid grid-2'});
  grid.appendChild(statCard('Reading Elo', person.readingElo||0));
  grid.appendChild(statCard('Debate Rank', person.debateRank ? '#'+person.debateRank : '—'));
  wrap.appendChild(grid);
  if(person.placementTaken){
    wrap.appendChild(el('div',{style:'height:14px'}));
    const rankCard = el('div',{class:'card'});
    rankCard.appendChild(renderRankProgress(person));
    wrap.appendChild(rankCard);

    wrap.appendChild(el('div',{style:'height:14px'}));
    const beliefsCard = el('div',{class:'card'});
    beliefsCard.appendChild(el('h3',{},'Beliefs'));
    if(person.religion && person.religion !== 'Prefer not to say'){
      beliefsCard.appendChild(el('p',{style:'font-size:13.5px;color:var(--parchment-dim);margin-bottom:12px;'},
        'Religious/spiritual identity: '+person.religion+(person.denomination ? ' — '+person.denomination : '')));
    }
    if(person.compass){
      beliefsCard.appendChild(renderQuadrantCompass('economic', person.compass.economic, person));
      beliefsCard.appendChild(renderQuadrantCompass('political', person.compass.political, person));
      beliefsCard.appendChild(renderQuadrantCompass('social', person.compass.social, person));
    }
    wrap.appendChild(beliefsCard);
  }

  wrap.appendChild(el('div',{style:'height:14px'}));
  wrap.appendChild(renderBookshelf(person));

  return wrap;
}

// What someone else has read (public profiles only; the database checks this too).
const bookshelves = {};
function loadBookshelf(person){
  const key = person.id;
  const old = bookshelves[key];
  if(!key || (old && (old.loading || Date.now() - old.at < 60000))) return;
  bookshelves[key] = { loading: !old, books: old ? old.books : [], at: Date.now() };
  sb.rpc('reading_list', { p_user_id: key }).then(({ data, error }) => {
    bookshelves[key] = { loading: false, books: error ? [] : (data || []), failed: !!error, at: Date.now() };
    if(error) console.warn('bookshelf failed', error);
    if(state.tab === 'profile' && state.viewingProfile === person.username) render();
  });
}
function renderBookshelf(person){
  const card = el('div',{class:'card'});
  loadBookshelf(person);
  const shelf = bookshelves[person.id];
  const books = shelf ? shelf.books : [];
  const finished = books.filter(b => b.status === 'Finished');
  const reading = books.filter(b => b.status !== 'Finished');
  card.appendChild(el('h3',{}, 'Bookshelf' + (books.length ? ' · ' + finished.length + ' finished, ' + reading.length + ' reading' : '')));
  if(!shelf || shelf.loading){
    card.appendChild(el('p',{class:'empty-note'}, 'Loading books…'));
    return card;
  }
  if(shelf.failed){
    card.appendChild(el('p',{class:'empty-note'}, 'Couldn\'t load their books just now.'));
    return card;
  }
  if(!books.length){
    card.appendChild(el('p',{class:'empty-note'}, person.name + ' hasn\'t logged any books yet.'));
    return card;
  }
  const section = (label, list) => {
    if(!list.length) return;
    card.appendChild(el('div',{class:'eyebrow', style:'margin:6px 0 2px;'}, label));
    list.forEach(b => {
      const pages = Number(b.pages) || 0, read = Math.min(Number(b.pages_read) || 0, pages || Infinity);
      const pct = pages ? Math.round(read / pages * 100) : 0;
      card.appendChild(el('div',{class:'book-row'},[
        el('div',{style:'flex:1;min-width:200px;'},[
          el('div',{class:'book-title'}, b.title),
          el('div',{class:'book-meta'}, (b.author || 'Unknown author') + (pages ? ' · ' + (b.status === 'Finished' ? pages + ' pages' : read + '/' + pages + ' pages') : '')),
          b.status !== 'Finished' && pages ? el('div',{class:'progress-track mini-progress', style:'max-width:260px;'}, el('div',{class:'progress-fill', style:'width:'+pct+'%'})) : null,
        ]),
        el('div',{class:'result-pill' + (b.status === 'Finished' ? ' win' : '')}, b.status === 'Finished' ? 'Finished' : pct + '%'),
      ]));
    });
  };
  section('Reading now', reading);
  section('Finished', finished);
  return card;
}

function segControl(options, currentValue, onChange){
  return el('div',{class:'seg-control'}, options.map(([val,label])=>
    el('button',{
      class: 'sort-chip' + (currentValue===val ? ' active' : ''),
      onclick: ()=>onChange(val)
    }, label)
  ));
}

function renderSettings(){
  const wrap = el('div',{});
  const u = state.user;
  u.settings = u.settings || { profileVisibility:'public', showOnLeaderboard:true, allowFollowers:true };

  wrap.appendChild(el('h2',{class:'section-title'},'Settings'));
  wrap.appendChild(el('p',{class:'section-sub'},'Manage your photo, display name, and who can see your activity.'));
  wrap.appendChild(installCard());
  if(!u.isGuest) wrap.appendChild(el('div',{class:'card'},[
    el('h3',{}, 'Tour'), el('p',{}, 'A 30-second walk through the main parts of Majlis.'),
    el('button',{class:'btn secondary', onclick:()=>startTour()}, 'Show me the tour'),
  ]));

  const photoCard = el('div',{class:'card'});
  photoCard.appendChild(el('h3',{},'Profile picture'));
  const fileIn = el('input',{type:'file', accept:'image/*', style:'display:none;', onchange:(e)=>handleAvatarUpload(e.target.files[0])});
  const photoActions = el('div',{class:'avatar-upload-actions'},[
    el('button',{class:'btn secondary', onclick:()=>fileIn.click()}, u.avatar ? 'Change photo' : 'Upload photo'),
    u.avatar ? el('button',{class:'btn secondary', style:'color:var(--wine);border-color:var(--wine);', onclick:removeAvatar}, 'Remove photo') : null,
  ]);
  photoCard.appendChild(el('div',{class:'avatar-upload-row'},[avatarNode(u, 84), photoActions, fileIn]));
  photoCard.appendChild(el('p',{style:'font-size:12px;color:var(--parchment-dim);margin:0;'}, u.isGuest ? 'Create an account to set a profile picture.' : 'JPG or PNG, cropped to a square automatically.'));
  wrap.appendChild(photoCard);
  wrap.appendChild(el('div',{style:'height:18px'}));

  const nameCard = el('div',{class:'card'});
  nameCard.appendChild(el('h3',{},'Display name'));
  const nameIn = draft('settings-name', el('input',{type:'text', maxlength:'40'}), u.name);
  nameCard.appendChild(el('div',{class:'field'},[el('label',{},'Name shown to others'), nameIn]));
  nameCard.appendChild(el('button',{class:'btn secondary', onclick:()=>updateDisplayName(nameIn.value)}, 'Save name'));
  wrap.appendChild(nameCard);
  wrap.appendChild(el('div',{style:'height:18px'}));

  const bioCard = el('div',{class:'card'});
  bioCard.appendChild(el('h3',{},'Bio'));
  const bioIn = draft('settings-bio', el('textarea',{placeholder:'Tell people a bit about yourself...', style:'min-height:90px;', maxlength:'280'}), u.bio||'');
  bioCard.appendChild(el('div',{class:'field'},[el('label',{},'Shown on your profile (280 chars)'), bioIn]));
  bioCard.appendChild(el('button',{class:'btn secondary', onclick:()=>updateBio(bioIn.value)}, 'Save bio'));
  wrap.appendChild(bioCard);
  wrap.appendChild(el('div',{style:'height:18px'}));

  const themeCard = el('div',{class:'card'});
  themeCard.appendChild(el('h3',{},'Appearance'));
  themeCard.appendChild(el('div',{class:'settings-row'},[
    el('div',{},[el('div',{class:'settings-label'},'Theme'), el('div',{class:'settings-desc'},'Change how Majlis looks. Everything stays in the same place, only the style changes.')]),
  ]));
  themeCard.appendChild(el('div',{class:'theme-picker'}, THEME_LABELS.map(([key, label]) =>
    el('button',{class:'theme-swatch' + (state.theme === key ? ' is-on' : ''), 'data-swatch': key, onclick:()=>setTheme(key), 'aria-pressed': state.theme === key ? 'true' : 'false'},[
      el('span',{class:'theme-swatch__preview'},[el('span',{class:'theme-swatch__bar'}), el('span',{class:'theme-swatch__m', html:'<svg viewBox="40 45 120 110" fill="none"><path d="' + M_PATH + '" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>'})]),
      el('span',{class:'theme-swatch__name'}, label),
    ]))));
  wrap.appendChild(themeCard);
  wrap.appendChild(el('div',{style:'height:18px'}));

  const blockedCard = el('div',{class:'card'});
  blockedCard.appendChild(el('h3',{},'Blocked accounts'));
  const blockedList = u.blocked || [];
  if(!blockedList.length){
    blockedCard.appendChild(el('p',{class:'empty-note'},'You haven\'t blocked anyone.'));
  } else {
    blockedList.forEach(bu=>{
      const person = state.users[bu];
      blockedCard.appendChild(el('div',{class:'book-row'},[
        el('div',{style:'display:flex;align-items:center;gap:10px;'},[avatarNode(person||bu, 28), el('span',{}, person?person.name:bu)]),
        el('button',{class:'btn secondary', style:'padding:4px 12px;font-size:12px;', onclick:()=>toggleBlock(bu)},'Unblock'),
      ]));
    });
  }
  wrap.appendChild(blockedCard);
  wrap.appendChild(el('div',{style:'height:18px'}));

  const privacyCard = el('div',{class:'card'});
  privacyCard.appendChild(el('h3',{},'Privacy'));

  privacyCard.appendChild(el('div',{class:'settings-row'},[
    el('div',{},[
      el('div',{class:'settings-label'},'Profile visibility'),
      el('div',{class:'settings-desc'},'Public profiles show your stats and debate history to anyone. Private profiles show only your name and connection counts.'),
    ]),
    segControl([['public','Public'],['private','Private']], u.settings.profileVisibility, (v)=>updateSetting('profileVisibility', v)),
  ]));

  privacyCard.appendChild(el('div',{class:'settings-row'},[
    el('div',{},[
      el('div',{class:'settings-label'},'Show on leaderboard'),
      el('div',{class:'settings-desc'},'Turn this off to keep your reading and debate rankings out of the public Leaderboard page.'),
    ]),
    segControl([[true,'On'],[false,'Off']], u.settings.showOnLeaderboard, (v)=>updateSetting('showOnLeaderboard', v)),
  ]));

  privacyCard.appendChild(el('div',{class:'settings-row'},[
    el('div',{},[
      el('div',{class:'settings-label'},'Allow new followers'),
      el('div',{class:'settings-desc'},'Turn this off to stop new people from following you. Existing followers are unaffected.'),
    ]),
    segControl([[true,'On'],[false,'Off']], u.settings.allowFollowers, (v)=>updateSetting('allowFollowers', v)),
  ]));

  wrap.appendChild(privacyCard);
  wrap.appendChild(el('div',{style:'height:18px'}));
  wrap.appendChild(el('button',{class:'btn secondary', onclick:()=>navigateWithLoading('profile')}, '← Back to profile'));

  return wrap;
}

function renderMembers(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Members'));
  wrap.appendChild(el('p',{class:'section-sub'},'Everyone on Majlis. Follow, message, or view a profile.'));

  // Typing only rebuilds the list below, never the whole page, so the box keeps focus.
  const searchIn = el('input',{type:'text', placeholder:'Search @members by name or username...', 'data-key':'member-search'});
  searchIn.value = state.memberSearch;
  let list = buildMemberList();
  searchIn.addEventListener('input', (e)=>{
    state.memberSearch = e.target.value;
    const next = buildMemberList();
    list.replaceWith(next);
    list = next;
  });
  wrap.appendChild(el('div',{class:'field'},[searchIn]));
  wrap.appendChild(list);
  return wrap;
}

function buildMemberList(){
  const q = (state.memberSearch||'').toLowerCase().trim();
  const all = Object.values(state.users).filter(u=>!u.isGuest && !u.aiRetired && u.username!==state.currentUser);
  const filtered = q ? all.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) : all;

  const card = el('div',{class:'card'});
  if(!filtered.length){
    card.appendChild(el('p',{class:'empty-note'}, all.length ? 'No members match your search.' : 'No other members yet — invite some friends.'));
    return card;
  }
  filtered.forEach(person=>{
    const blockedByMe = isBlocked(person.username);
    const row = el('div',{class:'member-row'},[
      avatarNode(person, 42),
      el('div',{},[
        el('button',{class:'user-link', onclick:()=>viewProfile(person.username)}, person.name),
        el('div',{style:'font-size:12px;color:var(--parchment-dim);'}, '@'+person.username +
          (areFriends(state.currentUser, person.username) ? ' · Friends' : '')),
        person.bio ? el('div',{class:'member-bio'}, person.bio) : null,
      ]),
    ]);
    const actions = el('div',{class:'member-actions'});
    if(!state.user.isGuest && !blockedByMe){
      actions.appendChild(el('button',{
        class: isFollowing(person.username) ? 'btn secondary' : 'btn',
        style:'padding:5px 12px;font-size:12px;',
        onclick: ()=>toggleFollow(person.username),
      }, isFollowing(person.username) ? 'Following' : 'Follow'));
      actions.appendChild(el('button',{class:'btn secondary', style:'padding:5px 12px;font-size:12px;', onclick:()=>openDM(person.username)}, 'Message'));
    } else if(blockedByMe){
      actions.appendChild(el('span',{style:'font-size:12px;color:var(--wine);'}, 'Blocked'));
    }
    actions.appendChild(el('button',{class:'btn secondary', style:'padding:5px 12px;font-size:12px;', onclick:()=>viewProfile(person.username)}, 'View'));
    row.appendChild(actions);
    card.appendChild(row);
  });
  return card;
}

function renderNotifications(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Notifications'));
  wrap.appendChild(el('p',{class:'section-sub'},'Follows, messages, and other activity involving you.'));

  const notifs = state.user.notifications || [];
  if(notifs.length && unreadNotifCount()>0){
    wrap.appendChild(el('button',{class:'btn secondary', style:'margin-bottom:16px;', onclick:markAllNotifsRead}, 'Mark all as read'));
  }

  const card = el('div',{class:'card'});
  if(!notifs.length){
    card.appendChild(el('p',{class:'empty-note'},'No notifications yet.'));
  } else {
    notifs.forEach(n=>{
      const person = state.users[n.from];
      const item = el('div',{class:'notif-item'+(n.read?'':' unread')},[
        avatarNode(person||n.from, 34),
        el('div',{},[
          el('div',{class:'notif-text'}, n.text),
          el('div',{class:'notif-time'}, timeAgo(n.ts)),
        ]),
      ]);
      item.style.cursor = 'pointer';
      item.addEventListener('click', async ()=>{
        await markNotifRead(n);
        if(n.type === 'dm' && n.from){ openDM(n.from); }
        else if(n.from){ viewProfile(n.from); }
        else { render(); }
      });
      card.appendChild(item);
    });
  }
  wrap.appendChild(card);
  return wrap;
}

function renderMessages(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Messages'));
  wrap.appendChild(el('p',{class:'section-sub'},'Direct conversations with other members.'));

  if(state.user.isGuest){
    wrap.appendChild(el('div',{class:'card'},[
      el('h3',{},'Create an account to message people'),
      el('p',{},'Guests can browse Majlis but need an account to send and receive direct messages.'),
    ]));
    return wrap;
  }

  const convos = myConversations();
  const activeUser = state.activeDM && state.users[state.activeDM] ? state.activeDM : (convos[0] ? convos[0].other : null);

  const convoList = el('div',{class:'dm-convo-list'});
  if(!convos.length){
    convoList.appendChild(el('div',{style:'padding:16px;'}, el('p',{class:'empty-note', style:'padding:0;'}, 'No conversations yet. Message someone from their profile or the Members page.')));
  } else {
    convos.forEach(c=>{
      const person = state.users[c.other];
      if(!person) return;
      const preview = c.lastMsg ? ((c.lastMsg.from===state.currentUser?'You: ':'')+c.lastMsg.text) : '';
      const item = el('div',{class:'dm-convo-item'+(c.other===activeUser?' active':''), onclick:()=>openDM(c.other)},[
        avatarNode(person, 36),
        el('div',{style:'min-width:0;flex:1;'},[
          el('div',{class:'dm-convo-name'}, [person.name, hasUnreadDM(c.other) ? el('span',{class:'unread-dot', title:'Unread'}) : null]),
          el('div',{class:'dm-convo-preview'}, preview),
        ]),
      ]);
      convoList.appendChild(item);
    });
  }

  const threadWrap = el('div',{class:'dm-thread'});
  if(!activeUser || !state.users[activeUser]){
    threadWrap.appendChild(el('div',{class:'dm-empty'}, 'Select a conversation to start chatting.'));
  } else {
    const person = state.users[activeUser];
    const blockedByMe = isBlocked(activeUser);

    const lastTheirs = getConversation(activeUser).filter(m => m.from === activeUser && m.id).pop();
    threadWrap.appendChild(el('div',{class:'dm-thread-header'},[
      avatarNode(person, 32),
      el('button',{class:'user-link', onclick:()=>viewProfile(activeUser)}, person.name),
      el('div',{class:'dm-thread-header__tools'},[
        el('button',{class:'report-link', title:'Report ' + person.name, onclick:()=>openReport(activeUser, lastTheirs ? { type:'message', id:lastTheirs.id, preview:lastTheirs.text } : { type:'profile' })}, [icon('flag', 13), 'Report']),
        blockedByMe ? null : el('button',{class:'report-link', onclick:()=>toggleBlock(activeUser)}, 'Block'),
      ]),
    ]));

    const msgsBox = el('div',{class:'dm-messages'});
    const msgs = getConversation(activeUser);
    msgs.forEach(m=>{
      msgsBox.appendChild(el('div',{class:'dm-bubble '+(m.from===state.currentUser?'me':'them'), style: m.pending ? 'opacity:0.6;' : ''},[
        el('div',{}, m.text),
        el('div',{class:'dm-bubble-time'}, timeAgo(m.ts)),
      ]));
    });
    if(rivalDmTyping[activeUser]){
      msgsBox.appendChild(el('div',{class:'dm-bubble them'},[el('span',{class:'typing-dots', 'aria-label':'typing'},[el('i'),el('i'),el('i')])]));
    }
    if(person.aiRetired){
      msgsBox.appendChild(el('div',{class:'dm-empty', style:'padding:14px;'}, person.name+' has retired and won\'t reply any more.'));
    }
    threadWrap.appendChild(msgsBox);
    requestAnimationFrame(() => { msgsBox.scrollTop = msgsBox.scrollHeight; });

    if(blockedByMe){
      threadWrap.appendChild(el('div',{class:'blocked-banner', style:'margin:12px 16px;'},
        'You\'ve blocked '+person.name+'. Unblock them to keep messaging.'));
    } else {
      const textIn = draft('dm-'+activeUser, el('textarea',{placeholder:'Write a message...', maxlength:'4000'}));
      const sendBtn = el('button',{class:'btn', onclick: async ()=>{
        const text = textIn.value;
        if(!text.trim()) return;
        // Clear the box straight away; put the text back if sending fails.
        clearDrafts('dm-'+activeUser); textIn.value = '';
        const sent = await sendDM(activeUser, text);
        if(!sent){ state.drafts['dm-'+activeUser] = text; render(); }
      }}, 'Send');
      textIn.addEventListener('keydown',(e)=>{
        if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendBtn.click(); }
      });
      threadWrap.appendChild(el('div',{class:'dm-input-row'},[textIn, sendBtn]));
    }
  }

  wrap.appendChild(el('div',{class:'dm-layout'},[convoList, threadWrap]));
  return wrap;
}

function renderWiki(){
  const wrap = el('div',{});
  wrap.appendChild(el('h2',{class:'section-title'},'Knowledge Base Wiki'));
  wrap.appendChild(el('p',{class:'section-sub'},'Community summaries and conceptual breakdowns. Anyone can contribute an article.'));

  const createCard = el('div',{class:'card'});
  createCard.appendChild(el('h3',{},'Write an article'));
  const titleIn = draft('wiki-title', el('input',{type:'text', placeholder:'Article title (e.g. "Categorical Imperative")', maxlength:'200'}));
  const summaryIn = draft('wiki-summary', el('textarea',{placeholder:'One or two sentence summary shown in search results...'}));
  const bodyIn = draft('wiki-body', el('textarea',{placeholder:'Full article body...', style:'min-height:160px;'}));
  createCard.appendChild(el('div',{class:'field'},[el('label',{},'Title'), titleIn]));
  createCard.appendChild(el('div',{class:'field'},[el('label',{},'Summary'), summaryIn]));
  createCard.appendChild(el('div',{class:'field'},[el('label',{},'Body'), bodyIn]));
  const publishBtn = el('button',{class:'btn', onclick: async ()=>{
    const title = titleIn.value.trim();
    const summary = summaryIn.value.trim();
    const body = bodyIn.value.trim();
    if(state.user.isGuest){ alert('Create an account to publish an article.'); return; }
    if(!title || !summary || !body){ alert('Fill in title, summary, and body.'); return; }
    if(state.wiki.find(w=>w.title.toLowerCase()===title.toLowerCase())){ alert('An article with that title already exists.'); return; }
    publishBtn.disabled = true; publishBtn.textContent = 'Publishing...';
    const { data: row, error } = await sb.from('wiki_articles').insert({ title, summary, body, author_id: state.user.id }).select('id').single();
    publishBtn.disabled = false; publishBtn.textContent = 'Publish article';
    if(error){ automodNote(error, 'wiki', title + ' ' + summary + ' ' + body); alert(friendlyDbError(error, 'That article couldn\'t be published — please try again.')); return; }
    clearDrafts('wiki-title', 'wiki-summary', 'wiki-body');
    if(!state.wiki.some(x => x.id === row.id)){
      state.wiki.unshift({ id: row.id, title, summary, body, author: state.currentUser, authorId: state.user.id });
    }
    render();
  }},'Publish article');
  createCard.appendChild(publishBtn);
  wrap.appendChild(createCard);
  wrap.appendChild(el('div',{class:'divider'}));

  if(!state.wiki.length){
    wrap.appendChild(el('p',{class:'empty-note'},'No articles published yet. Be the first to contribute.'));
    return wrap;
  }

  state.wiki.forEach(w=>{
    const card = el('div',{class:'forum-post'});
    card.appendChild(el('h4',{}, w.title));
    card.appendChild(el('div',{class:'meta'}, 'by '+w.author));
    card.appendChild(el('p',{style:'font-style:italic;color:var(--parchment-dim);'}, w.summary));
    card.appendChild(el('p',{style:'white-space:pre-line;'}, w.body));
    if(w.author !== state.currentUser && state.users[w.author] && (state.user && !state.user.isGuest)){
      card.appendChild(el('button',{class:'report-link', onclick:()=>openReport(w.author, { type:'wiki', id:w.id, preview:w.title })}, [icon('flag', 13), 'Report article']));
    }
    if(canModerate() || w.authorId === (state.user && state.user.id)){
      card.appendChild(el('button',{class:'btn secondary', style:'margin-top:8px;padding:5px 12px;font-size:12px;color:var(--wine);border-color:var(--wine);', onclick:()=>deleteWikiArticle(w.id)}, 'Delete'));
    }
    wrap.appendChild(card);
  });

  return wrap;
}

/* ================= INIT ================= */
(async function start(){
  try {
    // Session, profiles, wiki and forum all load at the same time (was one after another).
    const [{ data }] = await Promise.all([sb.auth.getSession(), loadAllProfiles(), loadWikiFromSupabase(), loadForumFromSupabase()]);
    relinkAuthors();
    if(data && data.session){
      await loadCurrentUserProfile(data.session.user);
      if(state.user && !state.user.isGuest){
        subscribeToInbox();
        await Promise.all([loadSocialData(), loadMyBooks(), loadDebateHistory(), loadReports(), loadMyModerationStatus()]);
        loadExtrasForUser();
      }
    }
    subscribeToContent();
    checkForActiveDebate();
  } catch(e){
    console.error('Startup failed', e);
  }
  render();
  if(window.hideSplash) window.hideSplash();
})();

/* ================= SERVER CHECK =================
   If the server can't be reached (it's paused, or the visitor is offline), say so,
   instead of showing a site that quietly looks empty. */
(function checkServer(){
  function showBanner(){
    if(document.getElementById('server-banner')) return;
    const b = document.createElement('div');
    b.id = 'server-banner';
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:99999;max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px;'
      + 'padding:12px 14px;border-radius:12px;background:#2a1215;color:#ffd9dc;border:1px solid #6b2a30;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px #0008;';
    const t = document.createElement('span');
    t.style.flex = '1';
    t.textContent = 'We can\'t reach the server right now. Check your connection, then try again.';
    const btn = document.createElement('button');
    btn.textContent = 'Try again';
    btn.style.cssText = 'background:#ffd9dc;color:#2a1215;border:0;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;';
    btn.onclick = () => location.reload();
    b.append(t, btn);
    document.body.appendChild(b);
  }
  const hide = () => { const b = document.getElementById('server-banner'); if(b) b.remove(); };
  fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(9000) })
    .then(r => { if(!r.ok) showBanner(); })
    .catch(showBanner);
  window.addEventListener('online', hide);
})();
