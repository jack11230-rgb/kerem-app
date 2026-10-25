// End-to-end check of Kerem's core flows. Run against a running server:
//   BASE=http://localhost:3000 node tests/e2e.mjs
// Credentials are read at runtime from DEMO_LOGINS.md (written by `npm run seed`).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOTS = path.join(ROOT, 'screenshots');
const SHOT = process.env.SHOTS !== '0';
fs.mkdirSync(SHOTS, { recursive: true });

const logins = fs.readFileSync(path.join(ROOT, 'DEMO_LOGINS.md'), 'utf8');
const cred = (email) => { const m = logins.match(new RegExp(`${email.replace(/[.]/g, '\\.')}\\s*\\|\\s*\`([^\`]+)\``)); if (!m) throw new Error('no cred for ' + email); return m[1]; };
const ADMIN = { email: 'admin@kerem.local', pw: cred('admin@kerem.local') };
const AVI = { email: 'avi@demo.kerem.local', pw: cred('avi@demo.kerem.local') };

const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log(`✓ ${name} (${Date.now() - t}ms)`); }
  catch (e) { results.push({ name, ok: false, err: String(e?.message || e).split('\n')[0] }); console.log(`✗ ${name}\n   ${e?.stack || e}`); }
};
const shot = async (page, name) => { if (!SHOT) return; await page.getByTestId('notif-banner').waitFor({ state: 'hidden', timeout: 7000 }).catch(() => {}); await page.waitForTimeout(450); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };

const browser = await chromium.launch();
const mk = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
async function login(ctx, who) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login?mode=signin`);
  await p.fill('input[name=email]', who.email);
  await p.fill('input[name=password]', who.pw);
  await p.click('button:has-text("Sign in")');
  await p.waitForURL(`${BASE}/`);
  return p;
}

const ctxA = await mk(), ctxB = await mk(), ctxAdmin = await mk();
let A, B, Adm;
const stamp = Date.now().toString(36);
const newUser = { name: `Test Member ${stamp}`, email: `test+${stamp}@example.com`, pw: `e2e-${stamp}-pass` };

await step('gate screen renders', async () => {
  const p = await ctxA.newPage();
  await p.goto(`${BASE}/`);
  await p.waitForURL(/\/login/);
  await p.getByText('By invitation only').waitFor();
  await shot(p, '01-login');
  await p.close();
});

await step('signup with invite code (KRM742)', async () => {
  A = await ctxA.newPage();
  await A.goto(`${BASE}/join?code=KRM742`);
  await A.waitForURL(/\/login\?code=KRM742/);
  await A.click('button:has-text("Enter the Kerem")');
  await A.getByText('✓ Invitation verified').first().waitFor();
  await A.fill('input[name=name]', newUser.name);
  await A.fill('input[name=email]', newUser.email);
  await A.fill('input[name=password]', newUser.pw);
  await A.click('button:has-text("Create my membership")');
  await A.waitForURL(`${BASE}/`);
  await A.getByTestId('featured').waitFor();
  await shot(A, '02-home');
});

await step('bad invite code is rejected', async () => {
  const c = await mk(); const p = await c.newPage();
  await p.goto(`${BASE}/login?code=ZZZZZ9`);
  await p.click('button:has-text("Enter the Kerem")');
  await p.getByRole('alert').waitFor();
  await c.close();
});

await step('RSVP toggle updates live count (and second context sees it)', async () => {
  B = await login(ctxB, AVI);
  const btn = A.locator('[data-testid^=rsvp-]').first();
  const id = (await btn.getAttribute('data-testid')).slice(5);
  await B.goto(`${BASE}/events/${id}`);
  const countB = B.getByTestId('going-count').first();
  const before = parseInt(await countB.innerText());
  const wasGoing = (await btn.getAttribute('aria-pressed')) === 'true';
  await btn.click();
  const expected = before + (wasGoing ? -1 : 1);
  await A.waitForFunction((n) => document.querySelector('[data-testid=going-count]')?.textContent?.startsWith(String(n)), expected);
  await B.waitForFunction((n) => document.querySelector('[data-testid=going-count]')?.textContent?.startsWith(String(n)), expected, { timeout: 8000 });
  if ((await btn.getAttribute('aria-pressed')) !== String(!wasGoing)) throw new Error('rsvp state did not flip');
  if (wasGoing) await btn.click(); // leave the new member going
  await shot(B, '04-event-detail');
});

await step('calendar + .ics export', async () => {
  await A.goto(`${BASE}/calendar`);
  await A.locator('.cal, [data-testid=calendar]').first().waitFor().catch(() => {});
  await shot(A, '03-calendar');
  const r = await A.request.get(`${BASE}/api/events/${(await (await A.request.get(`${BASE}/api/events`)).json()).events[0].id}/ics`);
  const t = await r.text();
  if (!t.includes('BEGIN:VCALENDAR') || !t.includes('BEGIN:VEVENT')) throw new Error('bad ics');
});

await step('library list, filter, detail with key points, save highlight to notes', async () => {
  await A.goto(`${BASE}/library`);
  await A.locator('a[href^="/library/"]').first().waitFor();
  await shot(A, '05-library');
  const lib = await (await A.request.get(`${BASE}/api/library`)).json();
  const items = lib.items || lib.library || [];
  const withMedia = items.find((i) => i.mediaUrl) || items[0];
  await A.goto(`${BASE}/library/${withMedia.id}`);
  await A.getByTestId('keypoint').first().waitFor();
  await shot(A, '06-library-detail');
  await A.getByTestId('keypoint').first().click();
  await A.waitForTimeout(600);
  const notes = await (await A.request.get(`${BASE}/api/notes`)).json();
  if (!(notes.notes || []).length) throw new Error('no note saved: ' + JSON.stringify(notes).slice(0, 200));
  await A.getByTestId('tab-notes').click();
  await A.getByTestId('tab-notes').filter({ hasText: '· 1' }).waitFor({ timeout: 4000 });
});

await step('Hall chat is realtime across two browser contexts', async () => {
  await A.goto(`${BASE}/hall`); await B.goto(`${BASE}/hall`);
  await A.getByTestId('composer').waitFor(); await B.getByTestId('composer').waitFor();
  await A.waitForTimeout(800);
  const msg = `Hello from the new member ${stamp}`;
  await A.fill('[data-testid=composer]', msg); await A.press('[data-testid=composer]', 'Enter');
  await B.getByText(msg).waitFor({ timeout: 8000 });
  const reply = `Welcome aboard ${stamp}, glad you joined`;
  await B.fill('[data-testid=composer]', reply); await B.press('[data-testid=composer]', 'Enter');
  await A.getByText(reply).waitFor({ timeout: 8000 });
});

await step('heated exchange → heuristic opens a side room with Join card', async () => {
  const lines = [
    [A, `Free will is OBVIOUSLY incompatible with foreknowledge!! You are ignoring the Rambam ${stamp}`],
    [B, `That's simply wrong!! Seriously, the Rambam says no such thing, come on`],
    [A, `NONSENSE. You always do this, admit it, it is a category error!!`],
    [B, `Ridiculous! You never read the text, that is absurd, full stop!!`],
    [A, `No way, you are WRONG and you know it!! Seriously!!`],
  ];
  await A.waitForTimeout(500);
  for (const [p, t] of lines) { await p.fill('[data-testid=composer]', t); await p.press('[data-testid=composer]', 'Enter'); await p.waitForTimeout(350); }
  const card = B.getByTestId('roomcard').last();
  await card.waitFor({ timeout: 15000 });
  await A.getByTestId('roomcard').last().waitFor({ timeout: 8000 });
  const cardText = await card.innerText();
  if (!/On Free Will/.test(cardText)) throw new Error('unexpected room title: ' + cardText.split('\n').slice(0, 3).join(' | '));
  await A.getByText(`Hello from the new member ${stamp}`).waitFor(); // calm lead-in stays in the Hall
  await shot(A, '07-hall');
  await B.getByTestId('roomcard-join').last().click();
  await B.waitForURL(/\/rooms\//);
  await B.getByText(/messages moved/).waitFor({ timeout: 8000 });
  await B.getByText('Seriously, the Rambam says no such thing').first().waitFor();
  await shot(B, '08-side-room');
  await B.goto(`${BASE}/rooms`);
  await B.getByTestId('room-row').first().waitFor();
  await shot(B, '09-rooms');
});

await step('live shiur: go live, chat, Q&A upvotes, end → AI discussion summary', async () => {
  Adm = await login(ctxAdmin, ADMIN);
  Adm.on('dialog', (d) => d.accept());
  const evs = (await (await Adm.request.get(`${BASE}/api/events`)).json()).events;
  const ev = evs.find((e) => e.status === 'scheduled');
  await Adm.goto(`${BASE}/live/${ev.id}`);
  await Adm.getByTestId('start-live').click();
  await Adm.getByTestId('livebadge').waitFor({ timeout: 8000 });
  await A.goto(`${BASE}/live/${ev.id}`);
  await A.getByTestId('livebadge').waitFor({ timeout: 8000 });
  await B.goto(`${BASE}/live/${ev.id}`);
  const comments = [
    [A, 'The point about lashon hara applying to online posts is powerful — intent matters.'],
    [B, 'Does the Chofetz Chaim distinguish between public figures and private people?'],
    [A, 'I think the speech-as-creation idea from Bereishit is the key theme tonight.'],
  ];
  for (const [p, t] of comments) { await p.fill('[data-testid=composer]', t); await p.press('[data-testid=composer]', 'Enter'); await p.waitForTimeout(300); }
  await Adm.getByText('speech-as-creation').waitFor({ timeout: 8000 });
  for (const [, t] of comments) await B.getByText(t).waitFor({ timeout: 8000 });
  await A.getByTestId('tab-qa').click();
  await A.fill('[data-testid=ask-input]', 'How should we handle forwarding a message that might be lashon hara?');
  await A.press('[data-testid=ask-input]', 'Enter');
  await B.getByTestId('tab-qa').click();
  await B.getByTestId('question').first().waitFor({ timeout: 8000 });
  // the asker's own vote counts as 1; B's upvote should take it to 2 on A's screen in realtime
  await A.waitForFunction(() => document.querySelector('[data-testid=upvote] span')?.textContent === '1', null, { timeout: 8000 });
  await B.getByTestId('upvote').first().click();
  await A.waitForFunction(() => document.querySelector('[data-testid=upvote] span')?.textContent === '2', null, { timeout: 8000 });
  await B.getByTestId('tab-discussion').click();
  await shot(B, '10-live');
  await Adm.getByTestId('end-live').click();
  await Adm.getByTestId('discussion-summary').waitFor({ timeout: 30000 });
  await A.getByTestId('discussion-summary').waitFor({ timeout: 10000 });
  await A.goto(`${BASE}/events/${ev.id}/summary`);
  await A.getByTestId('discussion-summary').waitFor();
  await shot(A, '11-summary');
  // summary also lands in the library
  const lib = await (await A.request.get(`${BASE}/api/library`)).json();
  if (!(lib.items || []).some((i) => i.eventId === ev.id || (i.title || '').includes(ev.title))) throw new Error('summary not in library');
});

await step('profile, notifications, members, admin screens', async () => {
  await B.goto(`${BASE}/profile`); await B.getByTestId('profile-name').waitFor(); await shot(B, '12-profile');
  await B.goto(`${BASE}/notifications`); await B.waitForTimeout(500); await shot(B, '13-notifications');
  await B.goto(`${BASE}/members`); await B.waitForTimeout(500); await shot(B, '14-members');
  await B.goto(`${BASE}/live`); await B.waitForTimeout(500); await shot(B, '15-live-list');
  await Adm.goto(`${BASE}/admin`); await Adm.waitForTimeout(700); await shot(Adm, '16-admin');
  const r = await B.request.get(`${BASE}/api/admin/overview`); if (r.status() !== 403 && r.status() !== 401) throw new Error('member reached admin API: ' + r.status());
});

await step('admin creates invite + approves application', async () => {
  const r = await Adm.request.post(`${BASE}/api/admin/invites`, { data: { note: 'e2e', maxUses: 1 } });
  if (!r.ok()) throw new Error('invite ' + r.status());
  await Adm.goto(`${BASE}/admin?tab=applications`);
  const ap = Adm.getByTestId('approve').first();
  await ap.waitFor({ timeout: 5000 }); await ap.click(); await Adm.getByTestId('approved').first().waitFor();
  await shot(Adm, '17-admin-applications');
});

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
fs.writeFileSync(path.join(ROOT, 'tests', 'last-run.json'), JSON.stringify({ at: new Date().toString(), results }, null, 2));
process.exit(bad.length ? 1 : 0);
