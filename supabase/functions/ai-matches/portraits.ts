// Majlis — automatic leader portraits.
// The first time a leader appears on anyone's card, their best photo is chosen and kept:
//   1. candidates: the photo Wikidata lists for them, then the files in their Wikimedia Commons category;
//   2. a quick filter on each file's listed size and shape (nothing is downloaded yet);
//   3. the AI (OpenRouter, or Gemini as the backup) looks at small previews of the shortlist and picks the clearest
//      single-person portrait;
//   4. the winner is copied (about 1280px wide, plus a 330px copy) into the public "portraits" bucket.
// Every later card for that leader uses the saved copy. If nothing is good enough, that is saved too and the card
// keeps the plain Wikipedia photo. Each leader is judged once (a failed attempt is retried a few times, a day apart).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiJson } from '../_shared/openrouter.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const UA = 'MajlisApp/1.0 (https://akskjjsjs6-alt.github.io/Majilis/; debate and reading site)';
const BUCKET = 'portraits';
const MIN_SCORE = 60;          // Gemini's 0-100; below this the card keeps the plain photo
const MAX_CANDIDATES = 8;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const keyOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
const slugOf = (name: string) => keyOf(name).normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'leader';

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(9000) });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
  }
  return null;
}
async function getBytes(url: string, maxBytes: number): Promise<{ buf: Uint8Array; type: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
        const buf = new Uint8Array(await r.arrayBuffer());
        return /^image\//.test(type) && buf.length <= maxBytes ? { buf, type } : null;
      }
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
  }
  return null;
}
function b64(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

// Things that are about the person but are not a portrait of them.
const NOT_PORTRAIT = /signature|autograph|logo|flag|\bmap\b|coat.?of.?arms|emblem|seal|stamp|coin|banknote|medal|grave|tomb|statue|monument|bust|sculpture|house|palace|building|street|memorial|museum|plaque|mausoleum|letter|document|manuscript|newspaper|poster|cover|cartoon|caricature|wedding|funeral|family|crowd|meeting|conference|visit|delegation|parade|ceremony|wax|mural|\bwith\b|\band\b|&|\.svg$|\.gif$|\.tiff?$|\.pdf$|\.webm$|\.ogv$/i;

type Cand = { file: string; w: number; h: number; thumb: string; big: string; small: string; main: boolean };

async function candidates(name: string): Promise<Cand[]> {
  // The person's Wikidata entry: through their English Wikipedia article first (it copes with names like
  // "Camillo Benso, Count of Cavour"), then by searching Wikidata.
  const wp = await getJson('https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=' + encodeURIComponent(name));
  let id: string | undefined = (Object.values(wp?.query?.pages ?? {}) as any[])[0]?.pageprops?.wikibase_item;
  if (!id) {
    const s = await getJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=1&search=' + encodeURIComponent(name));
    id = s?.search?.[0]?.id;
  }
  if (!id) return [];
  const e = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${id}`);
  const claims = e?.claims ?? {};
  const main: string[] = (claims.P18 ?? []).map((c: any) => c?.mainsnak?.datavalue?.value).filter(Boolean);
  const cat: string | undefined = claims.P373?.[0]?.mainsnak?.datavalue?.value;
  let files: string[] = [...main];
  if (cat) {
    const m = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=file&cmlimit=200&cmtitle=' + encodeURIComponent('Category:' + cat));
    for (const x of m?.query?.categorymembers ?? []) files.push(String(x.title).replace(/^File:/, ''));
  }
  files = [...new Set(files)].filter((f) => main.includes(f) || !NOT_PORTRAIT.test(f)).slice(0, 120);
  const out: Cand[] = [];
  for (let i = 0; i < files.length; i += 40) {
    const titles = files.slice(i, i + 40).map((f) => 'File:' + f).join('|');
    const q = (w: number) => getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=size|mime|url&iiurlwidth=${w}&titles=` + encodeURIComponent(titles));
    const d = await q(384);
    for (const p of Object.values(d?.query?.pages ?? {}) as any[]) {
      const ii = p?.imageinfo?.[0];
      if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime) || !ii.thumburl) continue;
      const file = String(p.title).replace(/^File:/, '');
      const w = ii.width, h = ii.height;
      // portrait-shaped and big enough to be sharp on the card
      if (w < 500 || h < w * 0.95 || h > w * 2.4) continue;
      const base = String(ii.thumburl);
      // the big copy: a 1280px copy of large originals, the original itself when it is smaller than that would be
      // worth (Wikipedia only makes copies at standard widths, so an 800px original would otherwise drop to 500px)
      out.push({ file, w, h, thumb: base, main: main.includes(file),
        big: w > 1600 ? base.replace(/\/\d+px-([^/]+)$/, '/1280px-$1') : String(ii.url),
        small: base.replace(/\/\d+px-([^/]+)$/, '/330px-$1') });
    }
  }
  // the listed photo first, then the largest
  out.sort((a, b) => (Number(b.main) - Number(a.main)) || (b.w * b.h - a.w * a.h));
  return out.slice(0, MAX_CANDIDATES);
}

const JUDGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    photos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      index: { type: 'INTEGER' },
      onePerson: { type: 'BOOLEAN' }, adult: { type: 'BOOLEAN' }, likelyThisPerson: { type: 'BOOLEAN' },
      kind: { type: 'STRING', format: 'enum', enum: ['photograph', 'realistic painting', 'drawing or engraving', 'statue or object', 'other'] },
      framing: { type: 'STRING', format: 'enum', enum: ['head and shoulders', 'half body', 'full body', 'scene'] },
      faceClear: { type: 'BOOLEAN' }, score: { type: 'INTEGER' },
    }, required: ['index', 'onePerson', 'adult', 'likelyThisPerson', 'kind', 'framing', 'faceClear', 'score'] } },
    best: { type: 'INTEGER' }, reason: { type: 'STRING' },
  },
  required: ['photos', 'best', 'reason'],
};

// The AI's verdict on the photos, as the card needs it.
function verdict(j: any) {
  const p = (j.photos ?? []).find((x: any) => x.index === j.best);
  const ok = p && p.onePerson && p.adult && p.likelyThisPerson && p.faceClear && p.framing !== 'scene'
    && (p.kind === 'photograph' || p.kind === 'realistic painting');
  return { best: ok ? j.best : -1, score: p ? p.score : 0, reason: String(j.reason ?? '').slice(0, 300) };
}
async function judge(name: string, cands: Cand[], images: string[]): Promise<{ best: number; score: number; reason: string } | null> {
  const parts: any[] = [{ text: `These are candidate photos of ${name} for a large portrait on a results card. The face will be shown big, `
    + `cut out of its background, in black and white. For each photo (numbered from 0, with its file name), judge:\n`
    + `- onePerson: exactly one person clearly in focus (no group).\n- adult: the person is an adult.\n`
    + `- likelyThisPerson: it is plausibly ${name} (use the file name and what you know; a different person is false).\n`
    + `- kind, framing, faceClear (the face is large, in focus, facing the camera roughly, not covered).\n`
    + `- score 0-100 for how good it would look as a big, sharp portrait: sharp detail, clean focus, little grain or damage, `
    + `a clear well-lit face, head and shoulders or half body. Statues, objects, scenes, groups, children, drawings and blurry or tiny `
    + `faces score under 30.\nThen give "best": the index of the best photo, or -1 if none would look good, and a short reason.` }];
  cands.forEach((c, i) => {
    parts.push({ text: `Photo ${i}: ${c.file} (${c.w}x${c.h})` });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: images[i] } });
  });
  const viaOpenRouter = await aiJson(parts[0].text, JUDGE_SCHEMA, 0.1, 50_000, 'portrait ' + name,
    { images: cands.map((c, i) => ({ text: `Photo ${i}: ${c.file} (${c.w}x${c.h})`, mime: 'image/jpeg', data: images[i] })) });
  if (viaOpenRouter) return verdict(viaOpenRouter);
  if (!GEMINI_API_KEY) return null;
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: JUDGE_SCHEMA, temperature: 0.1 } }),
        signal: AbortSignal.timeout(45000),
      });
      if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 2500)); }
      if (!r.ok) { console.warn('portrait judge', model, r.status); continue; }
      const d = await r.json();
      const j = JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'null');
      if (!j) continue;
      return verdict(j);
    } catch (e) { console.warn('portrait judge', model, String(e).slice(0, 80)); }
  }
  return null;
}

async function upload(path: string, url: string): Promise<string | null> {
  const img = await getBytes(url, 3_000_000);
  if (!img) return null;
  const { error } = await admin.storage.from(BUCKET).upload(path, img.buf, { contentType: img.type, upsert: true, cacheControl: '31536000' });
  if (error) { console.warn('portrait upload', error.message); return null; }
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Picks and saves the portrait for one leader. Safe to call more than once: the row is claimed first.
export async function pickPortrait(name: string): Promise<void> {
  const key = keyOf(name);
  const { data: row } = await admin.from('leader_portraits').select('status, tries, updated_at, reason').eq('key', key).maybeSingle();
  if (row) {
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (row.status === 'ok') return;
    if (row.status === 'pending' && age < 10 * 60_000) return;              // someone else is on it
    const busy = /unavailable|did not load|could not copy|error:/.test(row.reason ?? '');
    if (row.status === 'none' && (row.tries >= 3 || age < (busy ? 120_000 : 24 * 3600_000))) return;
  }
  const tries = (row?.tries ?? 0) + 1;
  await admin.from('leader_portraits').upsert({ key, name, status: 'pending', tries, updated_at: new Date().toISOString() });
  const done = (fields: Record<string, unknown>) => admin.from('leader_portraits').update({ ...fields, updated_at: new Date().toISOString() }).eq('key', key);
  try {
    const cands = await candidates(name);
    if (!cands.length) { await done({ status: 'none', reason: 'no portrait-shaped photo on Wikimedia Commons' }); return; }
    const imgs = await Promise.all(cands.map((c) => getBytes(c.thumb, 400_000)));
    const usable = cands.filter((_, i) => imgs[i]);
    const data = imgs.filter(Boolean).map((x) => b64(x!.buf));
    if (!usable.length) { await done({ status: 'none', reason: 'previews did not load' }); return; }
    const verdict = await judge(name, usable, data);
    if (!verdict) { await done({ status: 'none', reason: 'the AI judge was unavailable' }); return; }
    if (verdict.best < 0 || verdict.best >= usable.length || verdict.score < MIN_SCORE) {
      await done({ status: 'none', score: verdict.score, reason: verdict.reason || 'no photo was good enough' }); return;
    }
    const c = usable[verdict.best];
    const slug = slugOf(name);
    const [big, small] = await Promise.all([upload(`${slug}.jpg`, c.big), upload(`${slug}-s.jpg`, c.small)]);
    if (!big || !small) { await done({ status: 'none', reason: 'could not copy the chosen photo' }); return; }
    await done({ status: 'ok', big_url: big, small_url: small, source: c.file, score: verdict.score, reason: verdict.reason });
    console.log(`portrait: ${name} -> ${c.file} (${verdict.score})`);
  } catch (e) {
    await done({ status: 'none', reason: 'error: ' + String(e).slice(0, 120) });
  }
}

// The saved portraits for these leaders, by name (only the ones that are ready).
export async function savedPortraits(names: string[]): Promise<Map<string, { big: string; small: string }>> {
  const out = new Map<string, { big: string; small: string }>();
  if (!names.length) return out;
  const { data } = await admin.from('leader_portraits').select('key, big_url, small_url').eq('status', 'ok').in('key', names.map(keyOf));
  for (const r of data ?? []) if (r.big_url && r.small_url) out.set(r.key, { big: r.big_url, small: r.small_url });
  return out;
}
export { keyOf };
