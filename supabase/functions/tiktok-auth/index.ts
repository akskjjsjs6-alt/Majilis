// Majlis — tiktok-auth edge function
//
// "Continue with TikTok". Supabase has no TikTok login of its own, and TikTok's login doesn't follow the usual
// standard closely enough for Supabase's custom providers, so this function does the TikTok part itself:
//
//   start  → builds the TikTok sign-in link (with a signed `state`), the site sends the person there.
//   finish → TikTok sends them back to the site with a one-time `code`; the site passes it here. We swap it for
//            their TikTok id and name, find or create their Majlis account, and return a normal Supabase session.
//
// TikTok never shares an email address, so each TikTok account gets a placeholder address that can't receive mail.
// Which Majlis account belongs to which TikTok account is kept in public.tiktok_identities (server-only table).
//
// Secrets (Supabase dashboard → Edge Functions → Secrets): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
// The redirect URI registered in the TikTok developer portal must be exactly SITE_URL below.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const SITE_URL = 'https://akskjjsjs6-alt.github.io/Majilis/';
const CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY') ?? '';
const CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://akskjjsjs6-alt.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(text: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
async function sha256(text: string) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(text))); }

// state = "<time>.<random>.<signature>": proves the sign-in started here and recently.
async function makeState() {
  const body = Date.now() + '.' + crypto.randomUUID().replace(/-/g, '');
  return body + '.' + (await hmac(body));
}
async function stateOk(state: string) {
  const parts = String(state || '').split('.');
  if (parts.length !== 3) return false;
  const body = parts[0] + '.' + parts[1];
  if ((await hmac(body)) !== parts[2]) return false;
  const age = Date.now() - Number(parts[0]);
  return age >= 0 && age < STATE_MAX_AGE_MS;
}

async function tiktokUser(code: string) {
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: SITE_URL }),
  });
  const token = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !token?.access_token || !token?.open_id) {
    console.warn('tiktok token failed', tokenRes.status, token?.error, token?.error_description);
    throw new Error('TikTok sign-in didn\'t go through. Please try again.');
  }
  const infoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
    headers: { Authorization: 'Bearer ' + token.access_token },
  });
  const info = await infoRes.json().catch(() => null);
  const u = info?.data?.user ?? {};
  return { openId: String(token.open_id), name: String(u.display_name || '').slice(0, 60), avatar: typeof u.avatar_url === 'string' ? u.avatar_url : null };
}

// A placeholder address for the account (TikTok shares no email). Two forms in case Auth rejects the first.
async function placeholderEmails(openId: string) {
  const id = (await sha256('tiktok:' + openId)).slice(0, 24);
  return ['tiktok-' + id + '@tiktok.majlis.invalid', 'tiktok-' + id + '@majlis-tiktok.example.com'];
}

async function findOrCreateUser(t: { openId: string; name: string; avatar: string | null }) {
  const meta = { full_name: t.name, name: t.name, avatar_url: t.avatar, provider: 'tiktok' };
  const { data: link } = await admin.from('tiktok_identities').select('user_id').eq('open_id', t.openId).maybeSingle();
  if (link) {
    const { data: got } = await admin.auth.admin.getUserById(link.user_id);
    if (got?.user?.email) {
      await admin.auth.admin.updateUserById(got.user.id, { user_metadata: { ...(got.user.user_metadata || {}), avatar_url: t.avatar } });
      return got.user.email;
    }
    // The account was deleted since; forget the old link and make a fresh account.
    await admin.from('tiktok_identities').delete().eq('open_id', t.openId);
  }
  let lastErr = '';
  for (const email of await placeholderEmails(t.openId)) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta, app_metadata: { provider: 'tiktok', providers: ['tiktok'] } });
    if (error || !data?.user) {
      lastErr = error?.message || 'no user';
      // Same TikTok account signing in twice at once: the other request already made it.
      const { data: again } = await admin.from('tiktok_identities').select('user_id').eq('open_id', t.openId).maybeSingle();
      if (again) { const { data: got } = await admin.auth.admin.getUserById(again.user_id); if (got?.user?.email) return got.user.email; }
      continue;
    }
    const { error: insErr } = await admin.from('tiktok_identities').insert({ open_id: t.openId, user_id: data.user.id });
    if (insErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      const { data: again } = await admin.from('tiktok_identities').select('user_id').eq('open_id', t.openId).maybeSingle();
      const { data: got } = again ? await admin.auth.admin.getUserById(again.user_id) : { data: null };
      if (got?.user?.email) return got.user.email;
      throw new Error('Couldn\'t finish making your account. Please try again.');
    }
    return email;
  }
  console.error('tiktok createUser failed', lastErr);
  throw new Error('Couldn\'t make your account. Please try again.');
}

async function sessionFor(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) throw new Error('Couldn\'t sign you in. Please try again.');
  const v = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  if (v.error || !v.data.session) throw new Error('Couldn\'t sign you in. Please try again.');
  return { access_token: v.data.session.access_token, refresh_token: v.data.session.refresh_token };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!CLIENT_KEY || !CLIENT_SECRET) return json({ error: 'TikTok sign-in isn\'t switched on yet.' }, 503);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'start') {
      const state = await makeState();
      const url = 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({
        client_key: CLIENT_KEY, response_type: 'code', scope: 'user.info.basic', redirect_uri: SITE_URL, state,
      });
      return json({ url, state });
    }

    if (body.action === 'finish') {
      const code = String(body.code || '');
      if (!code || code.length > 1000 || !(await stateOk(String(body.state || '')))) {
        return json({ error: 'That TikTok sign-in link has expired. Please try again.' }, 400);
      }
      const t = await tiktokUser(code);
      const email = await findOrCreateUser(t);
      return json({ session: await sessionFor(email) });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Something went wrong. Please try again.' }, 500);
  }
});
