/**
 * Kerem AI layer — every AI call in the app goes through this module.
 *
 * Configure any OpenAI-compatible Chat Completions API with:
 *   AI_API_KEY   – API key (if empty, the app runs in clearly-labelled OFFLINE FALLBACK mode)
 *   AI_BASE_URL  – e.g. https://api.openai.com/v1 (default), https://api.groq.com/openai/v1, http://localhost:11434/v1
 *   AI_MODEL     – e.g. gpt-4o-mini (default)
 *
 * Offline fallbacks (no key):
 *   - Fact-check: messages that look like factual claims get an "AI fact-check not configured" badge.
 *   - Heated-thread detection: heuristic (hostile keywords, CAPS, !!, rapid two-person back-and-forth).
 *   - Summaries: simple extractive summarisation (keyword frequency + top-voted questions).
 */

export type Verdict = 'accurate' | 'partly_inaccurate' | 'inaccurate' | 'unverifiable' | 'not_configured' | 'error';
export type FactCheck = {
  status: Verdict;
  label: string;
  correction: string;
  source: string;
  method: 'ai' | 'offline' | 'demo';
  checkedAt: number;
};
export type ChatMsg = { id: string; userId: string | null; name: string; body: string; createdAt: number };
export type HeatResult = {
  heated: boolean;
  score: number;
  reasons: string[];
  title: string;
  topic: string;
  messageIds: string[];
  participants: string[];
  method: 'ai' | 'heuristic';
};
export type DiscussionSummary = {
  themes: string[];
  topQuestions: { body: string; votes: number; name?: string }[];
  insights: { text: string; name: string; note: string }[];
  overview: string;
  stats: { attended: number; comments: number; questions: number; durationMin: number };
  method: 'ai' | 'extractive';
  generatedAt: number;
};
export type LectureSummary = { summary: string; keyPoints: { text: string; ts: string }[]; method: 'ai' | 'extractive' };

const cfg = () => ({
  key: process.env.AI_API_KEY?.trim() || '',
  base: (process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
  model: process.env.AI_MODEL?.trim() || 'gpt-4o-mini',
});
export function aiStatus() {
  const c = cfg();
  return { configured: !!c.key, model: c.key ? c.model : null, mode: c.key ? 'ai' : 'offline' as const };
}

async function chatJSON<T>(system: string, user: string, timeoutMs = 20000): Promise<T> {
  const c = cfg();
  if (!c.key) throw new Error('AI not configured');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${c.base}/chat/completions`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${c.key}` },
      body: JSON.stringify({
        model: c.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system + '\nRespond with a single JSON object only.' },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const txt: string = data?.choices?.[0]?.message?.content ?? '{}';
    const m = txt.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : txt) as T;
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------------ text utils */
const STOP = new Set(('a an the and or but if then so of to in on at by for with from is are was were be been being it its this that these those i im i\'m you your youre you\'re we our they their he she his her him them me my mine not no yes do does did dont don\'t just very really can could would should will about into than too also as what which who whom how why when where there here all any some more most such only own same other over out up down off again once like get got make made think thats that\'s it\'s isnt isn\'t one two even still ok okay well much many way thing things lot let lets let\'s have has had going go say said know knows see because who\'s whats what\'s im').split(/\s+/));
function words(s: string) {
  return s.toLowerCase().replace(/[“”"'’]/g, "'").match(/[a-z\u0590-\u05FF][a-z\u0590-\u05FF']+/g) ?? [];
}
function contentWords(s: string) { return words(s).map((w) => w.replace(/'s$/, '')).filter((w) => w.length > 2 && !STOP.has(w)); }
function sentences(s: string) { return s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 20); }
const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ fact-check */
const CLAIM_RX = [
  /\b(1[0-9]{3}|20[0-9]{2})\b/,
  /\b(fun fact|in fact|actually|did you know|according to|historically|was written|wrote|written in|was born|died in|invented|discovered|founded|the first|the oldest|the largest|was the|is the only|composed|authored|translated)\b/i,
  /\b\d+(\.\d+)?\s?(%|percent|million|billion|years|centuries|km|miles)\b/i,
];
export function looksLikeClaim(text: string) {
  const t = text.trim();
  if (t.length < 25) return false;
  if (/^(lol|haha|thanks|thank you|who|what|when|where|why|how)\b/i.test(t) && t.endsWith('?')) return false;
  return CLAIM_RX.some((r) => r.test(t));
}

const LABELS: Record<Verdict, string> = {
  accurate: 'Accurate',
  partly_inaccurate: 'Partly inaccurate',
  inaccurate: 'Inaccurate',
  unverifiable: 'Unverifiable',
  not_configured: 'AI fact-check not configured',
  error: 'Fact-check unavailable',
};

/** Returns null when the message makes no checkable factual claim. */
export async function factCheck(text: string): Promise<FactCheck | null> {
  const ai = aiStatus();
  if (!ai.configured) {
    if (!looksLikeClaim(text)) return null;
    return {
      status: 'not_configured', label: LABELS.not_configured,
      correction: 'This looks like a factual claim. Set AI_API_KEY to verify claims automatically.',
      source: 'Offline mode · no AI key', method: 'offline', checkedAt: Date.now(),
    };
  }
  try {
    const r = await chatJSON<{ hasClaim: boolean; verdict: string; correction: string; source: string }>(
      'You are the fact-checker for a Jewish learning & philosophy members club chat. Decide whether the message makes a concrete, checkable factual claim (history, texts, dates, authorship, science). Opinions, interpretations, jokes and questions are NOT claims. If it is a claim, judge it: "accurate", "partly_inaccurate", "inaccurate" or "unverifiable". Give a one or two sentence correction/confirmation (max 240 chars) and a short source note (a well-known reference work, e.g. "Encyclopaedia Judaica, \'Guide of the Perplexed\'"). Never invent URLs. JSON keys: hasClaim (bool), verdict, correction, source.',
      `Message: ${text}`,
    );
    if (!r.hasClaim) return null;
    const v = (['accurate', 'partly_inaccurate', 'inaccurate', 'unverifiable'] as Verdict[]).includes(r.verdict as Verdict) ? (r.verdict as Verdict) : 'unverifiable';
    return { status: v, label: LABELS[v], correction: String(r.correction || '').slice(0, 300), source: String(r.source || '').slice(0, 160), method: 'ai', checkedAt: Date.now() };
  } catch (e) {
    console.warn('[ai] factCheck failed', (e as Error).message);
    if (!looksLikeClaim(text)) return null;
    return { status: 'error', label: LABELS.error, correction: 'The AI service could not be reached.', source: 'Kerem AI', method: 'ai', checkedAt: Date.now() };
  }
}

/* ------------------------------------------------------------------ heat detection */
const HOSTILE = ['wrong', 'nonsense', 'ridiculous', 'absurd', 'category error', 'ignoring', 'ignore', 'rejecting', 'reject', 'full stop', 'period.', 'not listening', "don't understand", 'dont understand', 'talking past', 'come on', 'seriously', 'stupid', 'idiot', 'ignorant', 'obviously', 'rubbish', 'garbage', 'heresy', 'heretic', 'how can you', 'you always', 'you never', 'admit it', 'no way', 'utter', 'pathetic', 'shut up', 'give me a break', 'makes no sense', 'feel better', 'just a word'];
const ACRONYMS = new Set(['AI', 'OK', 'USA', 'UK', 'PM', 'AM', 'RSVP', 'FAQ', 'LOL', 'HQ', 'TV', 'CE', 'BCE']);

const TOPICS: [string, RegExp][] = [
  ['On Free Will', /\b(free ?will|free|freedom|choice|choices|choose|chose|determinis\w*|predestin\w*|foreknow\w*)\b/gi],
  ['On Lashon Hara', /\b(lashon ?hara|gossip|speech|slander|tongue)\b/gi],
  ['On the Existence of God', /\b(god|creator|existence|atheis\w*|theis\w*)\b/gi],
  ['On Ethics Without God', /\b(ethic\w*|moral\w*|virtue|good and evil)\b/gi],
  ['On the Problem of Evil', /\b(evil|suffering|iyov|job|theodicy)\b/gi],
  ['On Faith & Reason', /\b(faith|reason|rational\w*|proof|belief)\b/gi],
  ['On Shabbat', /\b(shabbat|shabbos|sabbath|rest)\b/gi],
  ['On Halacha', /\b(halach\w*|halakh\w*|law|mitzv\w*|psak)\b/gi],
  ['On Prophecy', /\b(prophe\w*|revelation|sinai)\b/gi],
  ['On Zionism & Israel', /\b(zionis\w*|israel|medinah|state)\b/gi],
];
function isCalmGreeting(t: string) { return /\b(hello|hi|welcome|thanks|thank you|shalom|good (morning|evening))\b/i.test(t) && !/!{2,}/.test(t); }
function topicTitle(texts: string[]) {
  const all = texts.join(' ');
  let best = ''; let bestN = 0;
  for (const [title, rx] of TOPICS) {
    const n = (all.match(rx) ?? []).length;
    if (n > bestN) { best = title; bestN = n; }
  }
  if (bestN >= 2) return { title: best, topic: best.replace(/^On (the )?/, '') };
  if (bestN === 1) return { title: best, topic: best.replace(/^On (the )?/, '') };
  // fall back to a proper noun / recurring word that looks like a real word
  const proper = (all.match(/\b[A-Z][a-z]{3,}\b/g) ?? []).filter((w) => !/^(That|This|What|When|Where|Which|There|They|Your|With|Seriously|Ridiculous|Obviously|Come)$/.test(w));
  const freq = new Map<string, number>();
  for (const w of [...proper, ...contentWords(all).filter((w) => /^[a-z]{4,}$/i.test(w) && !/\d/.test(w))]) freq.set(cap(w.toLowerCase()), (freq.get(cap(w.toLowerCase())) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2 && !proper.length) return { title: 'On the Hall Debate', topic: 'the debate' };
  return { title: `On ${top[0]}`, topic: top[0] };
}

export function heuristicHeat(msgs: ChatMsg[]): HeatResult {
  const empty: HeatResult = { heated: false, score: 0, reasons: [], title: '', topic: '', messageIds: [], participants: [], method: 'heuristic' };
  if (msgs.length < 4) return empty;
  const reasons: string[] = [];
  let kw = 0, capsMsgs = 0, bangMsgs = 0, youMsgs = 0;
  const hot = new Set<number>();
  msgs.forEach((m, i) => {
    const low = m.body.toLowerCase();
    let k0 = 0;
    for (const k of HOSTILE) if (low.includes(k)) k0++;
    kw += k0;
    const caps = (m.body.match(/\b[A-Z]{3,}\b/g) ?? []).filter((w) => !ACRONYMS.has(w));
    if (caps.length) capsMsgs++;
    const bang = /!{2,}|\?!|!\?/.test(m.body);
    if (bang) bangMsgs++;
    if (k0 || caps.length || bang) hot.add(i);
    if (/\byou('re|r| are)?\b/i.test(m.body)) youMsgs++;
  });
  // rapid back-and-forth between the two most active people
  const counts = new Map<string, number>();
  for (const m of msgs) if (m.userId) counts.set(m.userId, (counts.get(m.userId) ?? 0) + 1);
  const pair = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  let alternations = 0; let prev = ''; let firstIdx = -1; let firstAt = 0; let lastAt = 0;
  msgs.forEach((m, i) => {
    if (!m.userId || !pair.includes(m.userId)) return;
    if (firstIdx < 0) { firstIdx = i; firstAt = m.createdAt; }
    if (prev && prev !== m.userId) alternations++;
    prev = m.userId; lastAt = m.createdAt;
  });
  const rapid = pair.length === 2 && alternations >= 3 && lastAt - firstAt < 4 * 60_000;
  let score = 0.12 * kw + 0.15 * capsMsgs + 0.1 * bangMsgs + 0.06 * youMsgs + (rapid ? 0.35 : 0);
  score = Math.min(1, Math.round(score * 100) / 100);
  if (kw) reasons.push(`${kw} confrontational phrase${kw > 1 ? 's' : ''}`);
  if (capsMsgs) reasons.push('shouting (CAPS)');
  if (bangMsgs) reasons.push('repeated !!');
  if (rapid) reasons.push(`rapid back-and-forth (${alternations} exchanges)`);
  const heated = score >= 0.8 && pair.length === 2;
  if (!heated) return { ...empty, score, reasons };
  // move from the first heated message by one of the pair (calm lead-in stays in the Hall)
  let start = msgs.findIndex((m, i) => hot.has(i) && !!m.userId && pair.includes(m.userId));
  if (start < 0) start = Math.max(0, firstIdx);
  // include the message the first heated one is replying to, if it was by the other participant
  if (start > 0 && msgs[start - 1].userId && pair.includes(msgs[start - 1].userId!) && msgs[start - 1].userId !== msgs[start].userId && hot.size >= 3 && start - 1 >= firstIdx && !isCalmGreeting(msgs[start - 1].body)) start--;
  const moved = msgs.slice(start);
  const { title, topic } = topicTitle(moved.map((m) => m.body));
  return { heated, score, reasons, title, topic, messageIds: moved.map((m) => m.id), participants: pair, method: 'heuristic' };
}

export async function detectHeat(msgs: ChatMsg[]): Promise<HeatResult> {
  const h = heuristicHeat(msgs);
  if (!aiStatus().configured || msgs.length < 4) return h;
  if (h.score < 0.3 && !h.heated) return h; // cheap gate so we don't call the model on every calm message
  try {
    const r = await chatJSON<{ heated: boolean; title: string; topic: string; startId: string; reasons: string[] }>(
      'You moderate a respectful Jewish philosophy club chat. Given recent messages (oldest first), decide if two or more members are in a HEATED exchange (escalating tone, personal frustration, shouting) — passionate but civil debate is NOT heated. If heated, give a short side-room title in the form "On <Topic>" (max 5 words), the topic, and the id of the first message of the heated exchange. JSON keys: heated, title, topic, startId, reasons (string[]).',
      msgs.map((m) => `[${m.id}] ${m.name}: ${m.body}`).join('\n'),
    );
    if (!r.heated) return { ...h, heated: false, method: 'ai' };
    const idx = Math.max(0, msgs.findIndex((m) => m.id === r.startId));
    const moved = msgs.slice(idx);
    const ppl = [...new Set(moved.map((m) => m.userId).filter(Boolean) as string[])];
    return { heated: true, score: Math.max(h.score, 0.8), reasons: r.reasons?.slice(0, 4) ?? [], title: String(r.title || topicTitle(moved.map((m) => m.body)).title).slice(0, 60), topic: String(r.topic || ''), messageIds: moved.map((m) => m.id), participants: ppl, method: 'ai' };
  } catch (e) {
    console.warn('[ai] detectHeat failed, using heuristic', (e as Error).message);
    return h;
  }
}

/* ------------------------------------------------------------------ summaries */
function topTerms(texts: string[], n: number) {
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  for (const t of texts) {
    const ws = contentWords(t);
    const seen = new Set<string>();
    ws.forEach((w, i) => {
      if (!seen.has(w)) { uni.set(w, (uni.get(w) ?? 0) + 1); seen.add(w); }
      if (i > 0) { const b = `${ws[i - 1]} ${w}`; bi.set(b, (bi.get(b) ?? 0) + 1); }
    });
  }
  const bis = [...bi.entries()].filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const used = new Set(bis.flatMap((b) => b.split(' ')));
  const unis = [...uni.entries()].filter((x) => !used.has(x[0]) && x[1] >= 2).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  return { terms: [...bis, ...unis].slice(0, n), uni };
}

type SumInput = {
  title: string; speaker: string;
  messages: { name: string; body: string }[];
  questions: { body: string; votes: number; name?: string }[];
  attended: number; durationMin: number;
};
export function extractiveDiscussionSummary(i: SumInput): DiscussionSummary {
  const texts = i.messages.map((m) => m.body);
  const { terms, uni } = topTerms([...texts, ...i.questions.map((q) => q.body)], 4);
  const themes = terms.map(cap);
  const topQuestions = [...i.questions].sort((a, b) => b.votes - a.votes).slice(0, 3);
  const scored = i.messages
    .filter((m) => m.body.length >= 30 && !m.body.trim().endsWith('?'))
    .map((m) => {
      const ws = new Set(contentWords(m.body));
      let s = 0; ws.forEach((w) => (s += (uni.get(w) ?? 1) - 1));
      const echoes = i.messages.filter((o) => o !== m && contentWords(o.body).filter((w) => ws.has(w)).length >= 2).length;
      return { m, s: s + echoes * 2 + Math.min(m.body.length, 160) / 80, echoes };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  const insights = scored.map(({ m, echoes }) => ({ text: m.body, name: m.name, note: echoes ? `echoed by ${echoes} member${echoes > 1 ? 's' : ''}` : 'notable comment' }));
  const overview = i.messages.length || i.questions.length
    ? `${i.messages.length} comment${i.messages.length === 1 ? '' : 's'} and ${i.questions.length} question${i.questions.length === 1 ? '' : 's'} during “${i.title}” with ${i.speaker}.${themes.length ? ` Most discussed: ${themes.slice(0, 3).join(', ')}.` : ''}`
    : `No live discussion was recorded for “${i.title}”.`;
  return { themes, topQuestions, insights, overview, stats: { attended: i.attended, comments: i.messages.length, questions: i.questions.length, durationMin: i.durationMin }, method: 'extractive', generatedAt: Date.now() };
}

export async function summarizeDiscussion(i: SumInput): Promise<DiscussionSummary> {
  const base = extractiveDiscussionSummary(i);
  if (!aiStatus().configured || (!i.messages.length && !i.questions.length)) return base;
  try {
    const r = await chatJSON<{ overview: string; themes: string[]; insights: { text: string; name: string; note: string }[] }>(
      'Summarise the live discussion of a shiur/lecture at a Jewish learning & philosophy club. Return: overview (2 sentences), themes (3-4 short phrases, each may start with one emoji), insights (2-3 notable member insights: text paraphrased in <=15 words, name of member, note like "echoed by several members"). JSON keys: overview, themes, insights.',
      `Title: ${i.title}\nSpeaker: ${i.speaker}\nChat:\n${i.messages.slice(-200).map((m) => `${m.name}: ${m.body}`).join('\n')}\nQuestions:\n${i.questions.map((q) => `(${q.votes} votes) ${q.body}`).join('\n')}`,
      40000,
    );
    return { ...base, overview: r.overview || base.overview, themes: (r.themes ?? base.themes).slice(0, 4), insights: (r.insights?.length ? r.insights : base.insights).slice(0, 3), method: 'ai' };
  } catch (e) {
    console.warn('[ai] summarizeDiscussion failed, extractive used', (e as Error).message);
    return base;
  }
}

export function extractiveLectureSummary(text: string): LectureSummary {
  const ss = sentences(text);
  if (!ss.length) return { summary: text.slice(0, 280), keyPoints: [], method: 'extractive' };
  const { uni } = topTerms(ss, 10);
  const ranked = ss.map((s, idx) => ({ s, idx, score: contentWords(s).reduce((a, w) => a + (uni.get(w) ?? 0), 0) / Math.sqrt(contentWords(s).length + 1) }))
    .sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.idx - b.idx);
  return { summary: ss.slice(0, 2).join(' '), keyPoints: ranked.map((r) => ({ text: r.s, ts: '' })), method: 'extractive' };
}

export async function summarizeLecture(title: string, text: string): Promise<LectureSummary> {
  const base = extractiveLectureSummary(text);
  if (!aiStatus().configured || text.length < 80) return base;
  try {
    const r = await chatJSON<{ summary: string; keyPoints: { text: string; ts?: string }[] }>(
      'Summarise this lecture/shiur for members of a Jewish learning & philosophy club. Return summary (2 sentences, starts with the central question) and keyPoints (3-5 items, each <=20 words, ts = timestamp like "12:40" if present in the text else ""). JSON keys: summary, keyPoints.',
      `Title: ${title}\n\n${text.slice(0, 24000)}`, 40000,
    );
    return { summary: r.summary || base.summary, keyPoints: (r.keyPoints ?? []).map((k) => ({ text: String(k.text), ts: String(k.ts ?? '') })).slice(0, 5), method: 'ai' };
  } catch {
    return base;
  }
}

export async function recapRoom(title: string, msgs: { name: string; body: string }[]): Promise<string> {
  const names = [...new Set(msgs.map((m) => m.name))];
  const { terms } = topTerms(msgs.map((m) => m.body), 3);
  const fallback = `${msgs.length} messages from ${names.slice(0, 4).join(', ')}${names.length > 4 ? ' and others' : ''}.${terms.length ? ` Key threads: ${terms.join(', ')}.` : ''}${msgs.length ? ` Last word: “${msgs[msgs.length - 1].body.slice(0, 120)}” — ${msgs[msgs.length - 1].name}` : ''}`;
  if (!aiStatus().configured || msgs.length < 3) return fallback;
  try {
    const r = await chatJSON<{ recap: string }>('Write a warm, neutral 2-sentence recap of this side-room debate for the main hall. JSON key: recap.', `Room: ${title}\n${msgs.slice(-80).map((m) => `${m.name}: ${m.body}`).join('\n')}`);
    return r.recap || fallback;
  } catch { return fallback; }
}
