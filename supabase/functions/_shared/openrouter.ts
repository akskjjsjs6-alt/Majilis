// Majlis — the AI through OpenRouter (openrouter.ai), shared by the edge functions.
// Every function asks OpenRouter first and falls back to its own Gemini code if OpenRouter isn't set up, is busy or
// gives an unusable answer. The functions' schemas are in Gemini's format, so they are converted to JSON Schema here,
// sent as the answer format, and every answer is checked against them before it is used (not every model guarantees
// the shape). The key is the NVIDIA_API secret (or OPENROUTER_API_KEY).

const KEY = Deno.env.get('NVIDIA_API') ?? Deno.env.get('OPENROUTER_API_KEY');
const URL = 'https://openrouter.ai/api/v1/chat/completions';
// Text jobs: NVIDIA Nemotron 3 Ultra (free) first, then Nemotron 3 Super (free), then fast, inexpensive paid backups
// (used whenever the free models hit OpenRouter's rate limit); if one is busy, fails or answers in the wrong shape,
// the next is tried.
const MODELS = ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'deepseek/deepseek-v4.1-flash', 'nvidia/nemotron-3.5-lightning'];
// For jobs that look at pictures (choosing a leader's portrait or an ideology's symbol, which is then kept for
// everyone): Gemini first, the model these were tuned on and very good at judging pictures, then other image models.
const VISION_MODELS = ['google/gemini-3.8-flash', 'deepseek/deepseek-v4.1-flash', 'nvidia/nemotron-3.5-super-vl'];

// Extra for a request: pictures to look at, each with a line of text before it.
export type AiExtra = { images?: { text: string; mime: string; data: string }[] };
const busyUntil: Record<string, number> = {};   // a model that said it's overloaded is skipped for a minute
const formatFor: Record<string, 'schema' | 'json' | 'plain'> = {};   // the request format each model last accepted

// Gemini schema ({ type: 'OBJECT', ... }) to JSON Schema ({ type: 'object', ... }).
function toJsonSchema(s: any): any {
  if (!s || typeof s !== 'object') return s;
  const out: any = {};
  if (s.type) out.type = String(s.type).toLowerCase();
  if (s.enum) out.enum = s.enum;
  if (s.description) out.description = s.description;
  if (s.properties) {
    out.properties = {};
    for (const k of Object.keys(s.properties)) out.properties[k] = toJsonSchema(s.properties[k]);
    out.additionalProperties = false;
  }
  if (s.required) out.required = s.required;
  if (s.items) out.items = toJsonSchema(s.items);
  return out;
}

// Where the answer departs from the shape the schema asks for ('' if it fits), for the logs. Numbers are accepted for
// integers (the callers round them).
function misfit(v: any, s: any, at = 'answer'): string {
  if (!s || !s.type) return '';
  const show = (x: any) => JSON.stringify(x)?.slice(0, 40);
  switch (String(s.type).toUpperCase()) {
    case 'OBJECT': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return `${at} is not an object`;
      for (const k of (s.required ?? [])) if (!(k in v) || v[k] === null) return `${at}.${k} is missing`;
      for (const k of Object.keys(s.properties ?? {})) {
        if (!(k in v) || v[k] === null) continue;
        const m = misfit(v[k], s.properties[k], `${at}.${k}`);
        if (m) return m;
      }
      return '';
    }
    case 'ARRAY': {
      if (!Array.isArray(v)) return `${at} is not a list`;
      for (let i = 0; i < v.length; i++) { const m = misfit(v[i], s.items, `${at}[${i}]`); if (m) return m; }
      return '';
    }
    case 'STRING':
      if (typeof v !== 'string') return `${at} is not text (${show(v)})`;
      return s.enum && !s.enum.includes(v) ? `${at} = ${show(v)}, not one of the allowed values` : '';
    case 'INTEGER': case 'NUMBER': return typeof v === 'number' && Number.isFinite(v) ? '' : `${at} is not a number (${show(v)})`;
    case 'BOOLEAN': return typeof v === 'boolean' ? '' : `${at} is not true/false (${show(v)})`;
    default: return '';
  }
}

// The JSON in a reply: thinking and code fences are stripped, then the outermost object is taken.
function readJson(text: string): any {
  const t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(t); } catch { /* look for the object inside */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON in the answer');
  return JSON.parse(t.slice(a, b + 1));
}

// format: 'schema' sends the JSON Schema as the answer format; 'json' only asks for JSON (for a model that doesn't
// take a schema); 'plain' leaves out every optional setting (for a model that turns one of them down). The schema is in
// the system message every time.
async function ask(model: string, prompt: string, schema: unknown, temperature: number, timeoutMs: number, format: 'schema' | 'json' | 'plain', extra: AiExtra = {}): Promise<any> {
  const js = toJsonSchema(schema);
  const system = 'You answer with ONE JSON object and nothing else: no explanation, no markdown. It must match this JSON Schema exactly ' +
    '(every required field present, every enum value spelled exactly):\n' + JSON.stringify(js);
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://akskjjsjs6-alt.github.io/Majilis/', 'X-Title': 'Majlis' },
    body: JSON.stringify({
      model, temperature, max_tokens: 8192, stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: extra.images?.length
        ? [{ type: 'text', text: prompt }, ...extra.images.flatMap((im) => [
            { type: 'text', text: im.text }, { type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.data}` } }])]
        : prompt }],
      ...(format === 'plain' ? {} : {
        response_format: format === 'schema' ? { type: 'json_schema', json_schema: { name: 'answer', strict: false, schema: js } } : { type: 'json_object' },
        provider: { sort: 'throughput' },   // the fastest provider OpenRouter has for this model
        reasoning: { enabled: false },   // answers straight away; these jobs don't need long thinking
      }),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const status = res.ok ? Number(data?.error?.code) || 500 : res.status;
    if (status === 400 && format !== 'plain') return ask(model, prompt, schema, temperature, timeoutMs, format === 'schema' ? 'json' : 'plain', extra);   // a setting this model doesn't take
    const err: any = new Error(`OpenRouter ${status} (${model}): ${String(data?.error?.message ?? '').slice(0, 140)}`);
    err.busy = status === 429 || status >= 500;
    err.fatal = status === 401 || status === 402;   // a bad key or no credit: no other model will do better
    throw err;
  }
  formatFor[model] = format;   // next time, start with the format this model took
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter ${model}: empty answer (${data?.choices?.[0]?.finish_reason ?? 'no choices'})`);
  const out = readJson(text);
  const wrong = misfit(out, schema);
  if (wrong) { const err: any = new Error(`OpenRouter ${model}: wrong shape (${wrong})`); err.shape = true; throw err; }
  return out;
}

// The answer as an object, or null if OpenRouter isn't set up or every model failed within the time allowed (the
// caller then uses Gemini). label names the job in the logs.
export async function aiJson(prompt: string, schema: unknown, temperature = 0.3, budgetMs = 45_000, label = '', extra: AiExtra = {}): Promise<any | null> {
  if (!KEY) return null;
  const start = Date.now();
  const list = extra.images?.length ? VISION_MODELS : MODELS;
  const order = [...list.filter((m) => !(busyUntil[m] > start)), ...list.filter((m) => busyUntil[m] > start)];
  for (const model of order) {
    // A wrong-shaped answer is usually a one-off: the same model is asked once more before moving on.
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = start + budgetMs - Date.now();
      if (left < 4000) return null;
      try {
        const out = await ask(model, prompt, schema, temperature, Math.min(30_000, left), formatFor[model] ?? 'schema', extra);
        console.log(`ai: openrouter ${model} ${Date.now() - start}ms ${label}${attempt ? ' (second try)' : ''}`);
        return out;
      } catch (e: any) {
        if (e?.name === 'TimeoutError' || e?.busy) busyUntil[model] = Date.now() + 60_000;
        console.warn(`ai: openrouter ${model} failed ${label}: ${String(e?.message ?? e).slice(0, 220)}`);
        if (e?.fatal) return null;
        if (!e?.shape) break;
      }
    }
  }
  return null;
}
