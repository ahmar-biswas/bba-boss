const MAX_PROMPT_CHARS = 40000;
const MAX_OUTPUT_TOKENS = 8192;
const TOKEN_HOURS = 6;
const PER_MINUTE = 40;
const minuteHits = new Map();

export function envOf() {
  const e = (typeof process !== 'undefined' && process.env) || {};
  return {
    GEMINI_API_KEY: e.GEMINI_API_KEY, TAVILY_API_KEY: e.TAVILY_API_KEY, TOKEN_SECRET: e.TOKEN_SECRET,
    KV_URL: e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL, KV_TOKEN: e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN,
    DAILY_PDFS: e.DAILY_PDFS, IP_DAILY_PDFS: e.IP_DAILY_PDFS, GLOBAL_DAILY_PDFS: e.GLOBAL_DAILY_PDFS,
    GEMINI_MODEL: e.GEMINI_MODEL, ALLOWED_ORIGIN: e.ALLOWED_ORIGIN,
  };
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
}
function allowedList(env) { return (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean); }
function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (origin && allowedList(env).includes(origin)) return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
  return {};
}
function originOk(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  try { if (new URL(origin).host === host) return true; } catch (e) { return false; }
  return allowedList(env).includes(origin);
}
function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for');
  return (xf && xf.split(',')[0].trim()) || request.headers.get('x-real-ip') || 'unknown';
}
function dhakaDay() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
const enc = new TextEncoder();
function b64url(bytes) { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}
async function makeToken(env, payload) { const body = b64url(enc.encode(JSON.stringify(payload))); return body + '.' + (await hmac(env.TOKEN_SECRET, body)); }
async function readToken(env, token) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  if ((await hmac(env.TOKEN_SECRET, body)) !== sig) return null;
  try { const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))); if (!p.exp || Date.now() > p.exp) return null; return p; } catch (e) { return null; }
}
function cleanPid(pid) { return String(pid || '').replace(/[^a-z0-9]/gi, '').slice(0, 40) || 'anon'; }
function throttled(ip) {
  const now = Date.now();
  const arr = (minuteHits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); minuteHits.set(ip, arr);
  if (minuteHits.size > 5000) minuteHits.clear();
  return arr.length > PER_MINUTE;
}
async function redis(env, commands) {
  const r = await fetch(env.KV_URL.replace(/\/+$/, '') + '/pipeline', { method: 'POST', headers: { authorization: `Bearer ${env.KV_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(commands) });
  if (!r.ok) throw new Error('kv ' + r.status);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error('kv ' + x.error); return x.result; });
}
const TTL = 60 * 60 * 48;
async function claim(env, key, n, limit) {
  const [val] = await redis(env, [['INCRBY', key, n], ['EXPIRE', key, TTL]]);
  const now = Number(val);
  if (now > limit) { await redis(env, [['DECRBY', key, n]]); return { ok: false, used: now - n }; }
  return { ok: true, used: now };
}
async function handleStart(request, env, body) {
  const ip = clientIp(request);
  const pid = cleanPid(body.pid);
  const pdfs = Math.max(1, Math.min(6, parseInt(body.pdfs, 10) || 1));
  const limit = parseInt(env.DAILY_PDFS || '10', 10);
  const ipLimit = parseInt(env.IP_DAILY_PDFS || '40', 10);
  const globalLimit = parseInt(env.GLOBAL_DAILY_PDFS || '500', 10);
  const day = dhakaDay();
  const kp = `bba:pid:${day}:${pid}`, ki = `bba:ip:${day}:${ip}`, kg = `bba:all:${day}`;
  const p = await claim(env, kp, pdfs, limit);
  if (!p.ok) {
    const left = Math.max(0, limit - p.used);
    return json({ error: 'daily_limit', left, limit, message: left > 0 ? `You only have ${left} AI PDF build${left === 1 ? '' : 's'} left today (limit ${limit}). Pick fewer PDFs.` : `You have used today's ${limit} AI PDF builds. They reset at midnight Bangladesh time.` }, 429);
  }
  const i = await claim(env, ki, pdfs, ipLimit);
  if (!i.ok) { await redis(env, [['DECRBY', kp, pdfs]]); return json({ error: 'daily_limit', message: 'This network has used its AI builds for today. They reset at midnight Bangladesh time.' }, 429); }
  const g = await claim(env, kg, pdfs, globalLimit);
  if (!g.ok) { await redis(env, [['DECRBY', kp, pdfs], ['DECRBY', ki, pdfs]]); return json({ error: 'daily_limit', message: 'BBA Boss has hit its AI limit for today. Try again tomorrow.' }, 429); }
  const token = await makeToken(env, { pid, n: pdfs, exp: Date.now() + TOKEN_HOURS * 3600 * 1000 });
  return json({ token, left: limit - p.used, limit });
}
async function tavily(env, query) {
  if (!env.TAVILY_API_KEY || !query) return { notes: '', sources: [] };
  try {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.TAVILY_API_KEY}` }, body: JSON.stringify({ query: String(query).slice(0, 200), search_depth: 'basic', max_results: 4, include_answer: false }) });
    if (!r.ok) return { notes: '', sources: [] };
    const j = await r.json();
    const res = (j.results || []).slice(0, 4);
    const notes = res.map((x) => `- ${String(x.title || '').slice(0, 120)}: ${String(x.content || '').replace(/\s+/g, ' ').slice(0, 400)} (${x.url})`).join('\n');
    return { notes, sources: res.map((x) => ({ title: x.title, url: x.url })) };
  } catch (e) { return { notes: '', sources: [] }; }
}
async function gemini(env, prompt, maxTokens) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const generationConfig = { temperature: 0.4, maxOutputTokens: maxTokens, responseMimeType: 'application/json' };
  // Only Gemini 2.5 Flash accepts thinkingBudget 0; newer models reject it, so leave their defaults alone.
  if (/^gemini-2\.5-flash/i.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }) });
  if (r.status === 429) return { status: 429, error: 'rate_limited', message: 'The AI is busy. Trying again shortly.' };
  if (!r.ok) { let detail = ''; try { detail = (await r.json()).error.message; } catch (e) {} return { status: 502, error: 'upstream', message: 'The AI service returned an error.' + (detail ? ' ' + String(detail).slice(0, 200) : '') }; }
  const j = await r.json();
  const cand = (j.candidates || [])[0];
  if (!cand) return { status: 422, error: 'blocked', message: 'The AI declined this request.' };
  const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
  if (!text) return { status: 422, error: 'empty', message: 'The AI returned nothing (' + (cand.finishReason || 'unknown') + ').' };
  return { status: 200, text };
}
async function handleAi(request, env, body) {
  if (throttled(clientIp(request))) return json({ error: 'rate_limited', message: 'Too many AI requests. Slow down a little.' }, 429);
  const tok = await readToken(env, body.token);
  if (!tok || tok.pid !== cleanPid(body.pid)) return json({ error: 'bad_token', message: 'This build has expired. Build the level again.' }, 403);
  const prompt = String(body.prompt || '');
  if (!prompt) return json({ error: 'bad_request', message: 'Empty prompt.' }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) return json({ error: 'too_long', message: 'That request is too long.' }, 413);
  const maxTokens = Math.max(256, Math.min(MAX_OUTPUT_TOKENS, parseInt(body.maxTokens, 10) || 4096));
  let full = prompt, sources = [];
  if (body.search && body.search.query) {
    const t = await tavily(env, body.search.query);
    sources = t.sources;
    if (t.notes) full = 'WEB SEARCH NOTES (real-world facts for examples only; never use them to write questions):\n' + t.notes + '\n\n' + prompt;
  }
  const g = await gemini(env, full, maxTokens);
  if (g.status !== 200) return json({ error: g.error, message: g.message }, g.status);
  return json({ text: g.text, sources });
}
export async function handle(request, which, env = envOf()) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method', message: 'Use POST.' }, 405, cors);
  if (!originOk(request, env)) return json({ error: 'origin', message: 'Not allowed from this site.' }, 403, cors);
  if (!env.GEMINI_API_KEY || !env.TOKEN_SECRET || !env.KV_URL || !env.KV_TOKEN) return json({ error: 'not_configured', message: 'The AI server is not set up yet.' }, 503, cors);
  let body = {};
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request', message: 'Bad JSON.' }, 400, cors); }
  let res;
  try { res = which === 'start' ? await handleStart(request, env, body) : await handleAi(request, env, body); }
  catch (e) { res = json({ error: 'server', message: 'Server error.' }, 500); }
  Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
