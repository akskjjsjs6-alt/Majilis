// Majlis — the AI through OpenRouter (openrouter.ai), shared by the edge functions.
// Every function asks OpenRouter first and falls back to its own Gemini code if OpenRouter isn't set up, is busy or
// gives an unusable answer. The functions' schemas are in Gemini's format, so they are converted to JSON Schema here,
// sent as the answer format, and every answer is checked against them before it is used (not every model guarantees
// the shape). The key is the NVIDIA_API secret (or OPENROUTER_API_KEY).

const KEY = Deno.env.get('NVIDIA_API') ?? Deno.env.get('OPENROUTER_API_KEY');
const URL = 'https://openrouter.ai/api/v1/chat/completions';
// Free models first, then a few inexpensive paid ones. If one is busy, fails, is too slow or answers in the wrong
// shape, the next is tried, and Gemini (in each function) comes after all of them. openrouter/free is OpenRouter's
// own pick from whatever free models are up at the moment, as the last free try.
const FREE_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',      // fastest
  'nvidia/nemotron-3.5-super-vl:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'thinkingmachines/inkling-small:free',
  'openrouter/free',
];
const PAID_MODELS = ['deepseek/deepseek-v4.1-flash', 'z-ai/glm-5.3-flash', 'nvidia/nemotron-3.5-lightning'];
const MODELS = [...FREE_MODELS, ...PAID_MODELS];
const isFree = (m: string) => FREE_MODELS.includes(m);
const TRY_MS = 20_000;   // one model gets at most this long, so a slow one can't use up the whole wait
const busyUntil: Record<string, number> = {};   // a model that said it's overloaded is skipped for a minute
// Free models share a daily allowance on the account; once it's used up, every free model says so, so they are all
// skipped for a while instead of each being asked in turn.
let freeOut = 0;

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

// Does the answer have the shape the schema asks for? Numbers are accepted for integers (the callers round them).
function fits(v: any, s: any): boolean {
  if (!s || !s.type) return true;
  switch (String(s.type).toUpperCase()) {
    case 'OBJECT':
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      for (const k of (s.required ?? [])) if (!(k in v) || v[k] === null) return false;
      for (const k of Object.keys(s.properties ?? {})) if (k in v && v[k] !== null && !fits(v[k], s.properties[k])) return false;
      return true;
    case 'ARRAY': return Array.isArray(v) && v.every((x) => fits(x, s.items));
    case 'STRING': return typeof v === 'string' && (!s.enum || s.enum.includes(v));
    case 'INTEGER': case 'NUMBER': return typeof v === 'number' && Number.isFinite(v);
    case 'BOOLEAN': return typeof v === 'boolean';
    default: return true;
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
// take a schema); the schema is in the system message either way.
async function ask(model: string, prompt: string, schema: unknown, temperature: number, timeoutMs: number, format: 'schema' | 'json'): Promise<any> {
  const js = toJsonSchema(schema);
  const system = 'You answer with ONE JSON object and nothing else: no explanation, no markdown. It must match this JSON Schema exactly ' +
    '(every required field present, every enum value spelled exactly):\n' + JSON.stringify(js);
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://akskjjsjs6-alt.github.io/Majilis/', 'X-Title': 'Majlis' },
    body: JSON.stringify({
      model, temperature, max_tokens: 8192, stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      response_format: format === 'schema' ? { type: 'json_schema', json_schema: { name: 'answer', strict: false, schema: js } } : { type: 'json_object' },
      provider: { sort: 'throughput' },   // the fastest provider OpenRouter has for this model
      reasoning: { enabled: false },   // answers straight away; these jobs don't need long thinking
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const status = res.ok ? Number(data?.error?.code) || 500 : res.status;
    if (format === 'schema' && status === 400) return ask(model, prompt, schema, temperature, timeoutMs, 'json');   // this model doesn't take a schema
    const msg = String(data?.error?.message ?? '');
    const err: any = new Error(`OpenRouter ${status} (${model}): ${msg.slice(0, 140)}`);
    err.busy = status === 429 || status >= 500;
    err.freeOut = status === 429 && isFree(model) && /per[- ]day|daily/i.test(msg);
    err.fatal = status === 401;   // a bad key: no other model will do better
    err.noCredit = status === 402;   // no credit: only the free models can still answer
    throw err;
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter ${model}: empty answer (${data?.choices?.[0]?.finish_reason ?? 'no choices'})`);
  const out = readJson(text);
  if (!fits(out, schema)) throw new Error(`OpenRouter ${model}: answer doesn't match the schema`);
  return out;
}

// The answer as an object, or null if OpenRouter isn't set up or every model failed within the time allowed (the
// caller then uses Gemini). label names the job in the logs.
export async function aiJson(prompt: string, schema: unknown, temperature = 0.3, budgetMs = 45_000, label = ''): Promise<any | null> {
  if (!KEY) return null;
  const start = Date.now();
  const usable = MODELS.filter((m) => !(isFree(m) && freeOut > start));
  const order = [...usable.filter((m) => !(busyUntil[m] > start)), ...usable.filter((m) => busyUntil[m] > start)];
  let noCredit = false;
  for (const model of order) {
    if (noCredit && !isFree(model)) continue;
    if (isFree(model) && freeOut > Date.now()) continue;
    const left = start + budgetMs - Date.now();
    if (left < 4000) break;
    try {
      const out = await ask(model, prompt, schema, temperature, Math.min(TRY_MS, left), 'schema');
      console.log(`ai: openrouter ${model} ${Date.now() - start}ms ${label}`);
      return out;
    } catch (e: any) {
      if (e?.name === 'TimeoutError' || e?.busy) busyUntil[model] = Date.now() + 60_000;
      if (e?.freeOut) freeOut = Date.now() + 15 * 60_000;
      console.warn(`ai: openrouter ${model} failed ${label}: ${String(e?.message ?? e).slice(0, 180)}`);
      if (e?.fatal) break;
      if (e?.noCredit) noCredit = true;
    }
  }
  return null;
}
