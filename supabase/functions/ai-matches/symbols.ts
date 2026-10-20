// Majlis — automatic ideology symbols.
// The first time an ideology appears on anyone's card, the real symbol people associate with it is found and kept,
// so the card never shows a made-up icon:
//   1. candidates: the pictures in the ideology's English Wikipedia article (Wikipedia gives most ideologies a
//      symbol, for example the colour flag in its sidebar, a party logo or a historical emblem), the flag, logo or
//      icon on its Wikidata item, and a Wikimedia Commons search for "<ideology> symbol / flag / logo";
//   2. Gemini looks at small previews and picks the one most recognisably associated with that ideology (or none);
//   3. the winner is copied as a 256px PNG into the public "portraits" bucket (under symbols/).
// Each ideology is judged once; a failed attempt is retried a few times, a day apart.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const UA = 'MajlisApp/1.0 (https://akskjjsjs6-alt.github.io/Majilis/; debate and reading site)';
const BUCKET = 'portraits';
const MAX_CANDIDATES = 12;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
export const symbolKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
const slugOf = (name: string) => symbolKey(name).normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'ideology';

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
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
      if (r.ok) {
        const type = (r.headers.get('content-type') || 'image/png').split(';')[0];
        const buf = new Uint8Array(await r.arrayBuffer());
        return /^image\/(png|jpeg|webp)$/.test(type) && buf.length <= maxBytes ? { buf, type } : null;
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

// Wikipedia's own interface pictures and other files that are never the ideology's symbol.
const SKIP = /commons-logo|wiktionary|wikiquote|wikibooks|wikisource|wikinews|wikiversity|wikidata|wikimedia|symbol category class|emblem-money|question[_ ]book|edit-clear|ambox|padlock|portal|crystal[_ ]clear|nuvola|text[_ ]document|folder|speakerlink|sound-icon|disambig|stub|ballot|map\b|locator|population|chart|graph|diagram|signature/i;

type Cand = { file: string; thumb: string };

async function candidates(name: string): Promise<Cand[]> {
  const files: string[] = [];
  // the article (following redirects; a search finds it when the name isn't an exact title)
  const q = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops|images&ppprop=wikibase_item&imlimit=80&redirects=1';
  let wp = await getJson(q + '&titles=' + encodeURIComponent(name));
  let page = (Object.values(wp?.query?.pages ?? {}) as any[])[0];
  if (!page || page.missing !== undefined) {
    wp = await getJson(q + '&generator=search&gsrlimit=1&gsrsearch=' + encodeURIComponent(name + ' ideology'));
    page = (Object.values(wp?.query?.pages ?? {}) as any[])[0];
  }
  const qid = page?.pageprops?.wikibase_item;
  if (qid) {
    const e = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${qid}`);
    for (const p of ['P41', 'P154', 'P8972', 'P2910', 'P94']) {
      const v = e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
      if (v) files.push(String(v));
    }
  }
  for (const im of page?.images ?? []) files.push(String(im.title).replace(/^File:/, ''));
  const cs = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=8&srsearch='
    + encodeURIComponent(`${name} symbol OR flag OR logo OR emblem`));
  for (const x of cs?.query?.search ?? []) files.push(String(x.title).replace(/^File:/, ''));

  const unique = [...new Set(files)].filter((f) => !SKIP.test(f)).slice(0, 40);
  if (!unique.length) return [];
  const d = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=mime|url&iiurlwidth=256&titles='
    + encodeURIComponent(unique.map((f) => 'File:' + f).join('|')));
  const out: Cand[] = [];
  const byFile = new Map<string, string>();
  for (const p of Object.values(d?.query?.pages ?? {}) as any[]) {
    const ii = p?.imageinfo?.[0];
    if (!ii?.thumburl || !/^image\/(svg\+xml|png|jpeg)$/.test(ii.mime)) continue;
    byFile.set(String(p.title).replace(/^File:/, ''), String(ii.thumburl));
  }
  for (const f of unique) { const t = byFile.get(f); if (t) out.push({ file: f, thumb: t }); }
  // Most likely symbols first: files named as a flag, symbol, logo or emblem, or naming the ideology, then the rest.
  const words = name.toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter((w) => w.length > 3);
  const rank = (f: string) => {
    const l = f.toLowerCase();
    return (/flag|symbol|logo|emblem|torch|rose|fist|star|banner|icon/.test(l) ? 2 : 0) + (words.some((w) => l.includes(w.slice(0, 6))) ? 2 : 0)
      + (/^flag of /.test(l) ? -2 : 0);
  };
  out.sort((a, b) => rank(b.file) - rank(a.file));
  return out.slice(0, MAX_CANDIDATES);
}

const JUDGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    best: { type: 'INTEGER' },
    kind: { type: 'STRING', format: 'enum', enum: ['flag', 'emblem or symbol', 'party logo', 'other'] },
    reason: { type: 'STRING' },
  },
  required: ['best', 'kind', 'reason'],
};

async function judge(name: string, cands: Cand[], images: string[]): Promise<{ best: number; reason: string } | null> {
  if (!GEMINI_API_KEY) return null;
  const parts: any[] = [{ text: `The political ideology "${name}" needs one small round icon on a results card. These are pictures `
    + `found for it (numbered from 0, with file names). Pick the one that is most recognisably the symbol people associate with `
    + `"${name}": its flag or flag colour (Wikipedia marks each ideology with a colour flag, which counts), its emblem or symbol `
    + `(for example the rose, the red flag, the torch of liberty), or the logo of the party or movement most identified with it. `
    + `It must be a symbol, not a photo of people, a portrait, a map, a chart, a building or a document, and it must be about `
    + `this ideology (a country's national flag only if the ideology is about that one country). Prefer a clear, simple symbol `
    + `that reads well when small. A generic stock icon that is not specifically tied to this ideology (a plain ballot box, money, a `
    + `gear, a book) does not count. Give "best" (the index, or -1 if none of them fits), "kind", and a short reason.` }];
  cands.forEach((c, i) => {
    parts.push({ text: `Picture ${i}: ${c.file}` });
    parts.push({ inline_data: { mime_type: 'image/png', data: images[i] } });
  });
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: JUDGE_SCHEMA, temperature: 0.1 } }),
        signal: AbortSignal.timeout(40000),
      });
      if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 2500)); }
      if (!r.ok) { console.warn('symbol judge', model, r.status); continue; }
      const dd = await r.json();
      const j = JSON.parse(dd?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'null');
      if (!j) continue;
      return { best: j.kind === 'other' ? -1 : j.best, reason: String(j.reason ?? '').slice(0, 300) };
    } catch (e) { console.warn('symbol judge', model, String(e).slice(0, 80)); }
  }
  return null;
}

// Finds and saves the symbol for one ideology. Safe to call more than once: the row is claimed first.
export async function pickSymbol(name: string): Promise<void> {
  const key = symbolKey(name);
  const { data: row } = await admin.from('ideology_symbols').select('status, tries, updated_at, reason').eq('key', key).maybeSingle();
  if (row) {
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (row.status === 'ok') return;
    if (row.status === 'pending' && age < 10 * 60_000) return;
    const busy = /unavailable|did not load|error:/.test(row.reason ?? '');
    if (row.status === 'none' && (row.tries >= 3 || age < (busy ? 120_000 : 24 * 3600_000))) return;
  }
  const tries = (row?.tries ?? 0) + 1;
  await admin.from('ideology_symbols').upsert({ key, name, status: 'pending', tries, updated_at: new Date().toISOString() });
  const done = (fields: Record<string, unknown>) => admin.from('ideology_symbols').update({ ...fields, updated_at: new Date().toISOString() }).eq('key', key);
  try {
    const cands = await candidates(name);
    if (!cands.length) { await done({ status: 'none', reason: 'no pictures found for it' }); return; }
    const imgs = await Promise.all(cands.map((c) => getBytes(c.thumb, 300_000)));
    const usable = cands.filter((_, i) => imgs[i]);
    const data = imgs.filter(Boolean).map((x) => b64(x!.buf));
    if (!usable.length) { await done({ status: 'none', reason: 'previews did not load' }); return; }
    const v = await judge(name, usable, data);
    if (!v) { await done({ status: 'none', reason: 'the AI judge was unavailable' }); return; }
    if (v.best < 0 || v.best >= usable.length) { await done({ status: 'none', reason: v.reason || 'nothing fitted' }); return; }
    const c = usable[v.best];
    const img = imgs[cands.indexOf(c)]!;
    const path = `symbols/${slugOf(name)}.${img.type === 'image/jpeg' ? 'jpg' : 'png'}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, img.buf, { contentType: img.type, upsert: true, cacheControl: '31536000' });
    if (error) { await done({ status: 'none', reason: 'could not save it: ' + error.message }); return; }
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await done({ status: 'ok', url, source: c.file, reason: v.reason });
    console.log(`symbol: ${name} -> ${c.file}`);
  } catch (e) {
    await done({ status: 'none', reason: 'error: ' + String(e).slice(0, 120) });
  }
}

// The saved symbols for these ideologies, by name (only the ones that are ready).
export async function savedSymbols(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!names.length) return out;
  const { data } = await admin.from('ideology_symbols').select('key, url').eq('status', 'ok').in('key', names.map(symbolKey));
  for (const r of data ?? []) if (r.url) out.set(r.key, r.url);
  return out;
}
