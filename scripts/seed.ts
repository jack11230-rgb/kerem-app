/* Seeds a fresh Kerem database with realistic demo content.
 * Usage: npm run seed   (deletes ./data/kerem.db first unless --keep is passed)
 * Writes generated logins to ./DEMO_LOGINS.md (git-ignored). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dbUrl = process.env.DATABASE_URL || 'file:./data/kerem.db';
// --if-empty: keep the existing DB and only seed when it has no users (used on every production start).
const IF_EMPTY = process.argv.includes('--if-empty');
if (!process.argv.includes('--keep') && !IF_EMPTY && dbUrl.startsWith('file:')) {
  const f = path.resolve(dbUrl.slice(5));
  for (const s of ['', '-wal', '-shm', '-journal']) fs.rmSync(f + s, { force: true });
}

async function main() {
  const { db, schema, ensureDb } = await import('../lib/db');
  const { hashPassword } = await import('../lib/auth');
  const { uid, initialsOf } = await import('../lib/util');
  await ensureDb();
  if (IF_EMPTY) {
    const { client } = await import('../lib/db');
    const r = await client.execute('SELECT COUNT(*) AS n FROM users');
    if (Number(r.rows[0]?.n ?? 0) > 0) { console.log('[seed] database already has users; skipping seed'); return; }
  }
  const T = Date.now();
  const MIN = 60_000, H = 60 * MIN, D = 24 * H;
  const at = (days: number, hour: number, minute = 0) => { const d = new Date(T + days * D); d.setHours(hour, minute, 0, 0); return d.getTime(); };
  const pw = () => crypto.randomBytes(9).toString('base64url');

  /* ---------------- users */
  // Passwords come from ADMIN_PASSWORD / DEMO_PASSWORD when set (e.g. on a host), otherwise random per seed.
  const envPw = Boolean(process.env.ADMIN_PASSWORD || process.env.DEMO_PASSWORD);
  const adminPw = process.env.ADMIN_PASSWORD || pw(), demoPw = process.env.DEMO_PASSWORD || pw();
  type U = { id: string; name: string; email: string; color: number; role?: string; title: string; bio: string; interests: string[]; isDemo: number; pw?: string; since: number };
  const mk = (name: string, email: string, color: number, title: string, bio: string, interests: string[], isDemo = 1, role = 'member', since = 400): U => ({ id: uid(), name, email, color, role, title, bio, interests, isDemo, since });
  const admin = mk('Kerem Admin', 'admin@kerem.local', 1, 'Club administrator', 'Runs the calendar, the library and the invitation list.', ['Halacha', 'Community'], 0, 'admin', 500);
  const avi = mk('Avi Rosen', 'avi@demo.kerem.local', 5, 'Founding Circle', 'Engineer by day, Rambam enthusiast by night. Always up for a chavruta on Moreh Nevuchim.', ['Rambam', 'Ethics', 'Talmud', 'Spinoza', 'Mussar'], 1, 'member', 480);
  const miriam = mk('Miriam Stern', 'miriam@demo.kerem.local', 3, 'Founding Circle', 'Teaches Tanach to high-schoolers. Collects commentaries on Mishlei.', ['Tanach', 'Mishlei', 'Ethics'], 1, 'member', 470);
  const yoni = mk('Yoni Baram', 'yoni@demo.kerem.local', 2, 'Member', 'Philosophy grad student. Spinoza brought me back to Jewish texts.', ['Spinoza', 'Kant', 'Free will'], 1, 'member', 300);
  const dani = mk('Dani Katz', 'dani@demo.kerem.local', 4, 'Member', 'Lawyer, amateur historian, devil’s advocate on demand.', ['Halacha', 'History', 'Zionism'], 1, 'member', 260);
  const eli = mk('Eli Gold', 'eli@demo.kerem.local', 6, 'Member', 'Physician. Interested in where science and emunah meet.', ['Science & faith', 'Rav Kook', 'Ethics'], 1, 'member', 200);
  const noa = mk('Noa Friedman', 'noa@demo.kerem.local', 4, 'New member', 'Three years learning the Guide in chavruta. Happy to finally have a circle.', ['Moreh Nevuchim', 'Arendt', 'Mussar'], 1, 'member', 20);
  const people = [admin, avi, miriam, yoni, dani, eli, noa];
  const demoOthers = [miriam, yoni, dani, eli, noa];
  for (const u of people) {
    const password = u === admin ? adminPw : u === avi ? demoPw : pw() + pw(); // other demo members: random, unpublished
    await db.insert(schema.users).values({ id: u.id, email: u.email, passwordHash: await hashPassword(password), name: u.name, initials: initialsOf(u.name), color: u.color, role: u.role ?? 'member', title: u.title, bio: u.bio, interests: JSON.stringify(u.interests), isDemo: u.isDemo, lastSeenAt: T - 2 * H, createdAt: T - u.since * D });
  }

  /* ---------------- invites + applications */
  await db.insert(schema.invites).values([
    { code: 'KRM742', createdBy: admin.id, note: 'Demo invite (multi-use)', email: null, maxUses: 50, uses: 0, role: 'member', expiresAt: null, createdAt: T - 30 * D },
    { code: 'SHIUR8', createdBy: admin.id, note: 'Guest of Miriam', email: null, maxUses: 1, uses: 0, role: 'member', expiresAt: T + 14 * D, createdAt: T - 2 * D },
    { code: 'NOA2F9', createdBy: admin.id, note: 'Noa Friedman (application)', email: noa.email, maxUses: 1, uses: 1, role: 'member', expiresAt: T + 10 * D, createdAt: T - 20 * D },
  ]);
  await db.insert(schema.applications).values([
    { id: uid(), name: 'Ben Adler', email: 'ben.adler@example.com', sponsor: 'Yoni B.', reason: 'Philosophy grad student. Spinoza brought me back to Jewish texts and I want serious company for the road.', status: 'pending', inviteCode: null, createdAt: T - 1 * D },
    { id: uid(), name: 'Talia Gross', email: 'talia.gross@example.com', sponsor: 'Miriam S.', reason: 'I’ve been coming to the Thursday shiur as a guest for months and would love to be part of the conversation in between.', status: 'pending', inviteCode: null, createdAt: T - 3 * H },
    { id: uid(), name: 'Noa Friedman', email: noa.email, sponsor: 'Miriam S.', reason: 'I’ve learned the Guide in chavruta for three years and want a serious community to keep growing with.', status: 'approved', inviteCode: 'NOA2F9', createdAt: T - 21 * D },
  ]);

  /* ---------------- library */
  // Media: public sample clips (Blender Foundation open movies, CC-BY) used purely as PLACEHOLDERS so the embed player can be demoed.
  const SAMPLE_MP4 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  const SAMPLE_MP4_2 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
  type L = { id: string; title: string; speaker: string; category: string; mediaType: string; mediaUrl: string; duration: string; daysAgo: number; summary: string; keyPoints: { ts: string; text: string }[]; transcript: string; thumb: number };
  const lib: L[] = [
    { id: uid(), title: 'Free Will & Providence', speaker: 'Rabbi D. Levi', category: 'philosophy', mediaType: 'video', mediaUrl: SAMPLE_MP4, duration: '58 min', daysAgo: 7, thumb: 1,
      summary: 'Rabbi Levi walks through the Rambam’s answer to the ancient puzzle: if God knows what I will choose, am I really choosing? He contrasts Hilchot Teshuvah 5 with Moreh Nevuchim III:20 and argues that the Rambam deliberately refuses a neat solution — divine knowledge is not like human knowledge, so the contradiction we feel is a limit of our categories, not of reality.',
      keyPoints: [
        { ts: '04:12', text: 'The Rambam treats free will as a foundation of the Torah — without it, commandments and teshuvah are meaningless.' },
        { ts: '17:40', text: 'Divine knowledge is not “prediction”; it is identical with God’s essence and so not comparable to ours.' },
        { ts: '29:05', text: 'Ra’avad’s famous gloss objects that the Rambam raises a question he cannot answer.' },
        { ts: '38:02', text: 'Responsibility can survive even if our choices are knowable in advance.' },
        { ts: '51:30', text: 'Practical takeaway: act as if everything depends on you; trust as if everything depends on Him.' },
      ],
      transcript: 'Shalom everyone. Tonight we are going to take on what may be the oldest question in Jewish philosophy...\n\n[04:12] The Rambam opens Hilchot Teshuvah chapter five with a striking claim: every person is granted the power to be righteous like Moshe Rabbeinu or wicked like Yerovam...\n\n[17:40] Now the problem. If God knows everything, He knows what I will choose tomorrow. So can I choose otherwise?...\n\n[38:02] Here is where I want to push us. Responsibility does not require unpredictability. It requires that the choice be mine...' },
    { id: uid(), title: 'Lashon Hara in the Age of the Group Chat', speaker: 'Rabbi D. Levi', category: 'shiur', mediaType: 'none', mediaUrl: '', duration: '47 min', daysAgo: 21, thumb: 3,
      summary: 'A practical shiur on the Chofetz Chaim’s categories applied to screenshots, forwards and group chats. When is sharing information to protect someone permitted (to’elet), and what conditions must be met?',
      keyPoints: [{ ts: '06:30', text: 'Forwarding is speaking: a screenshot carries the same weight as the words themselves.' }, { ts: '22:15', text: 'To’elet requires accuracy, a constructive purpose, and no less-harmful alternative.' }, { ts: '35:50', text: 'Silence can also be a failure when someone is about to be harmed.' }], transcript: '' },
    { id: uid(), title: 'Spinoza’s Excommunication Revisited', speaker: 'Dr. Sarah Cohen', category: 'lecture', mediaType: 'video', mediaUrl: SAMPLE_MP4_2, duration: '1h 12m', daysAgo: 35, thumb: 2,
      summary: 'Dr. Cohen reconstructs the 1656 cherem against Baruch Spinoza from the Amsterdam community records, separating what we actually know from the romantic legends, and asks what the community was protecting.',
      keyPoints: [{ ts: '08:00', text: 'The cherem text is unusually harsh but gives no specific doctrines.' }, { ts: '31:20', text: 'The Amsterdam community was made of former conversos rebuilding a fragile identity.' }, { ts: '55:45', text: 'Spinoza never sought readmission — the break was mutual.' }], transcript: '' },
    { id: uid(), title: 'Mussar Vaad: The Middah of Patience', speaker: 'Rav Y. Adler', category: 'shiur', mediaType: 'none', mediaUrl: '', duration: '39 min', daysAgo: 14, thumb: 4,
      summary: 'Using Orchot Tzaddikim and Rav Yisrael Salanter’s letters, Rav Adler frames savlanut not as passivity but as the discipline of not letting the moment define you.',
      keyPoints: [{ ts: '03:10', text: 'Savlanut shares a root with sevel (suffering) and sabal (porter): patience is carrying weight.' }, { ts: '19:45', text: 'Rav Yisrael: change happens through small, repeated practices — not insight alone.' }], transcript: '' },
    { id: uid(), title: 'Hannah Arendt and the Banality of Evil', speaker: 'Prof. M. Weiss', category: 'philosophy', mediaType: 'none', mediaUrl: '', duration: '1h 05m', daysAgo: 49, thumb: 5,
      summary: 'Prof. Weiss revisits Eichmann in Jerusalem — the controversy, Gershom Scholem’s rebuke of Arendt, and whether “thoughtlessness” is an adequate account of evil.',
      keyPoints: [{ ts: '12:00', text: 'Arendt’s claim was about thoughtlessness, not about evil being small.' }, { ts: '40:30', text: 'Scholem accused her of lacking ahavat Yisrael; she replied she loved friends, not peoples.' }], transcript: '' },
    { id: uid(), title: 'Negative Theology in the Guide', speaker: 'Rabbi D. Levi', category: 'philosophy', mediaType: 'none', mediaUrl: '', duration: '52 min', daysAgo: 63, thumb: 6,
      summary: 'Why the Rambam insists we can only say what God is not — and how that shapes prayer, which is full of positive descriptions.',
      keyPoints: [{ ts: '09:20', text: 'Every positive attribute implies composition, which is incompatible with absolute unity.' }, { ts: '33:00', text: 'The Rambam limits liturgical praise to what the Anshei Knesset HaGedolah fixed.' }], transcript: '' },
    { id: uid(), title: 'Daf Yomi Deep Dive: Bava Metzia 59b', speaker: 'Rav Y. Adler', category: 'shiur', mediaType: 'none', mediaUrl: '', duration: '44 min', daysAgo: 28, thumb: 3,
      summary: 'The Oven of Akhnai: “Lo bashamayim hi.” What it means for a heavenly voice to be overruled, and the cost of winning an argument.',
      keyPoints: [{ ts: '05:00', text: 'The halacha follows the majority even against a bat kol.' }, { ts: '30:10', text: 'The story ends not with triumph but with the pain caused to Rabbi Eliezer — ona’at devarim.' }], transcript: '' },
  ];
  for (const l of lib) await db.insert(schema.libraryItems).values({ id: l.id, title: l.title, speaker: l.speaker, category: l.category, mediaType: l.mediaType, mediaUrl: l.mediaUrl, duration: l.duration, recordedAt: at(-l.daysAgo, 20), summary: l.summary, keyPoints: JSON.stringify(l.keyPoints), transcript: l.transcript, thumb: l.thumb, eventId: null, summaryMethod: 'editor', createdAt: at(-l.daysAgo, 22) });

  /* ---------------- events */
  type E = { id: string; title: string; speaker: string; series: string; kind: string; description: string; startsAt: number; endsAt: number; location: string; onlineUrl?: string; streamUrl?: string; status?: string; libraryItemId?: string | null; summary?: string | null };
  const ev = (o: Omit<E, 'id' | 'endsAt'> & { durMin?: number }): E => ({ id: uid(), endsAt: o.startsAt + (o.durMin ?? 60) * MIN, ...o });
  const soonStart = Math.ceil((T + 12 * MIN) / MIN) * MIN;
  const upcoming: E[] = [
    ev({ title: 'The Ethics of Speech in a Digital Age', speaker: 'Rabbi D. Levi', series: 'Thursday Night Shiur', kind: 'shiur', description: 'Lashon hara, screenshots and the responsibility of the listener. Bring your questions — Q&A runs live during the shiur.', startsAt: soonStart, location: 'Main Hall · 14 Elm St', durMin: 75 }),
    ev({ title: 'Rambam on Prophecy', speaker: 'Rabbi D. Levi', series: 'Moreh Nevuchim', kind: 'philosophy', description: 'Guide II:32–48. Is prophecy a natural perfection or a divine gift — and why does the Rambam say both?', startsAt: at(1, 20), location: 'Main Hall · 14 Elm St' }),
    ev({ title: 'Spinoza and the Jewish Tradition', speaker: 'Dr. Sarah Cohen', series: 'Philosophers’ Circle', kind: 'philosophy', description: 'Was Spinoza the first secular Jew, or the last medieval Jewish philosopher?', startsAt: at(3, 19, 30), location: 'Library Room', durMin: 90 }),
    ev({ title: 'Daf Yomi Deep Dive: Bava Metzia 84a', speaker: 'Rav Y. Adler', series: 'Daf Yomi', kind: 'shiur', description: 'Reish Lakish and Rabbi Yochanan: the friendship, the argument, and the grief.', startsAt: at(5, 7, 30), location: 'Online', onlineUrl: 'https://example.com/kerem-daf', durMin: 45 }),
    ev({ title: 'The Kuzari: Proof from History', speaker: 'Prof. M. Weiss', series: 'Monthly Lecture', kind: 'lecture', description: 'Rabbi Yehuda HaLevi’s argument from national revelation — strengths, weaknesses, and modern restatements.', startsAt: at(8, 20), location: 'Main Hall · 14 Elm St', durMin: 75 }),
    ev({ title: 'Mussar Vaad: Gratitude', speaker: 'Rav Y. Adler', series: 'Mussar Vaad', kind: 'shiur', description: 'Hakarat hatov as a spiritual practice. Small groups after the shiur.', startsAt: at(12, 20, 30), location: 'Library Room' }),
    ev({ title: 'Levinas: The Face of the Other', speaker: 'Dr. Sarah Cohen', series: 'Philosophers’ Circle', kind: 'philosophy', description: 'An introduction to Emmanuel Levinas and his Talmudic readings.', startsAt: at(17, 19, 30), location: 'Library Room', durMin: 90 }),
    ev({ title: 'Halacha and the Modern State', speaker: 'Rabbi D. Levi', series: 'Monthly Lecture', kind: 'lecture', description: 'Can a halachic framework govern a modern democracy? Sources from Rav Herzog to Rav Yisraeli.', startsAt: at(24, 20), location: 'Main Hall · 14 Elm St' }),
  ];
  // past events (12 weeks of attendance history), two with discussion summaries
  const pastTitles: [string, string, string][] = [
    ['Free Will & Providence', 'Rabbi D. Levi', 'philosophy'], ['Mussar Vaad: The Middah of Patience', 'Rav Y. Adler', 'shiur'], ['Lashon Hara in the Age of the Group Chat', 'Rabbi D. Levi', 'shiur'],
    ['Daf Yomi Deep Dive: Bava Metzia 59b', 'Rav Y. Adler', 'shiur'], ['Spinoza’s Excommunication Revisited', 'Dr. Sarah Cohen', 'lecture'], ['Rav Kook on Teshuvah', 'Rabbi D. Levi', 'shiur'],
    ['Hannah Arendt and the Banality of Evil', 'Prof. M. Weiss', 'philosophy'], ['The Akeidah and Kierkegaard', 'Dr. Sarah Cohen', 'philosophy'], ['Negative Theology in the Guide', 'Rabbi D. Levi', 'philosophy'],
    ['Shabbat as a Palace in Time', 'Rav Y. Adler', 'lecture'], ['Yetziat Mitzrayim and Freedom', 'Rabbi D. Levi', 'shiur'],
  ];
  const past: E[] = pastTitles.map(([title, speaker, kind], i) => {
    const daysAgo = 7 * (i + 1);
    const libItem = lib.find((l) => l.title === title);
    return ev({ title, speaker, series: '', kind, description: libItem?.summary ?? '', startsAt: at(-daysAgo, 20), location: 'Main Hall · 14 Elm St', status: 'ended', libraryItemId: libItem?.id ?? null });
  });
  const fw = past[0];
  fw.summary = JSON.stringify({
    themes: ['Divine knowledge vs. human choice', 'Ra’avad’s objection', 'Responsibility without unpredictability'],
    topQuestions: [{ body: 'If God already knows, is my teshuvah real?', votes: 14, name: 'Noa Friedman' }, { body: 'How is this different from Spinoza’s determinism?', votes: 11, name: 'Yoni Baram' }, { body: 'Does the Ra’avad actually disagree, or just complain?', votes: 6, name: 'Dani Katz' }],
    insights: [{ text: 'Responsibility needs the choice to be mine, not unpredictable.', name: 'Avi Rosen', note: 'echoed by 5 members' }, { text: 'The Rambam’s refusal to resolve it is itself the answer — our categories run out.', name: 'Miriam Stern', note: 'notable comment' }],
    overview: 'Members wrestled with whether divine foreknowledge undermines free choice, compared the Rambam and the Ra’avad, and kept returning to Spinoza as the counter-example.',
    stats: { attended: 34, comments: 87, questions: 9, durationMin: 62 }, method: 'extractive', generatedAt: fw.endsAt,
  });
  const lh = past[2];
  lh.summary = JSON.stringify({
    themes: ['Screenshots & forwarding', 'To’elet (constructive purpose)', 'The listener’s responsibility'],
    topQuestions: [{ body: 'Where’s the line between warning someone and gossip?', votes: 19, name: 'Miriam Stern' }, { body: 'Is staying silent ever a form of lashon hara?', votes: 12, name: 'Eli Gold' }],
    insights: [{ text: 'Words are irreversible acts, not just opinions.', name: 'Miriam Stern', note: 'echoed by 6 members' }, { text: 'Mishlei 18:21 as the source for speech’s power.', name: 'Eli Gold', note: 'notable comment' }],
    overview: 'A lively session on applying the Chofetz Chaim’s categories to group chats; most questions focused on when warning someone is permitted.',
    stats: { attended: 29, comments: 64, questions: 7, durationMin: 49 }, method: 'extractive', generatedAt: lh.endsAt,
  });
  for (const e of [...upcoming, ...past]) await db.insert(schema.events).values({ id: e.id, title: e.title, speaker: e.speaker, series: e.series, kind: e.kind, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, onlineUrl: e.onlineUrl ?? '', streamUrl: e.streamUrl ?? '', status: e.status ?? 'scheduled', liveStartedAt: e.status === 'ended' ? e.startsAt : null, endedAt: e.status === 'ended' ? e.endsAt : null, summary: e.summary ?? null, libraryItemId: e.libraryItemId ?? null, createdAt: T - 30 * D });
  for (const e of past) if (e.libraryItemId) await db.update(schema.libraryItems).set({ eventId: e.id }).where((await import('drizzle-orm')).eq(schema.libraryItems.id, e.libraryItemId));

  // RSVPs
  const rs: [E, U[]][] = [[upcoming[0], [miriam, yoni, eli, dani, noa]], [upcoming[1], [miriam, eli, noa]], [upcoming[2], [yoni, dani]], [upcoming[3], [dani]], [upcoming[4], [miriam, yoni, eli]], [upcoming[6], [noa]]];
  for (const [e, us] of rs) for (const [i, u] of us.entries()) await db.insert(schema.rsvps).values({ eventId: e.id, userId: u.id, createdAt: T - (i + 1) * 3 * H });
  // attendance: Avi very regular, others patchy
  const pattern: [U, number[]][] = [[avi, [0, 1, 2, 3, 4, 5, 6, 8, 9, 10]], [miriam, [0, 1, 2, 4, 5, 7, 9]], [yoni, [0, 2, 4, 7]], [dani, [1, 3, 5, 6]], [eli, [0, 2, 3, 8]], [noa, [0, 1]], [admin, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]];
  for (const [u, idx] of pattern) for (const i of idx) await db.insert(schema.attendance).values({ eventId: past[i].id, userId: u.id, at: past[i].startsAt + 5 * MIN });

  /* ---------------- Members' Hall + side rooms */
  await db.insert(schema.rooms).values({ id: 'hall', kind: 'hall', title: "Members' Hall", topic: '', eventId: null, parentRoomId: null, status: 'active', detectedBy: null, lastActivityAt: T - 20 * MIN, archivedAt: null, createdAt: T - 500 * D });
  for (const u of people) await db.insert(schema.roomMembers).values({ roomId: 'hall', userId: u.id, joinedAt: T - u.since * D });
  type Mm = { u: U | null; body: string; t: number; kind?: string; meta?: unknown; fc?: unknown; room?: string; moved?: string };
  const msgs: Mm[] = [];
  const say = (u: U | null, body: string, t: number, extra: Partial<Mm> = {}) => { msgs.push({ u, body, t, ...extra }); };
  const demoFc = (status: string, label: string, correction: string, source: string) => ({ status, label, correction, source, method: 'demo', checkedAt: T - 3 * H });

  // yesterday
  say(miriam, 'Shavua tov everyone! Slides from Thursday’s shiur are in the Library now.', at(-1, 9, 5));
  say(eli, 'Thank you Miriam 🙏 The part about to’elet was exactly what I needed this week.', at(-1, 9, 20));
  say(dani, 'Anyone want to chavruta on the Kuzari before next week’s lecture?', at(-1, 12, 40));
  say(noa, 'Me! I’ve only read the first ma’amar though.', at(-1, 12, 52));
  // archived room (2 days ago) — recap posted in hall
  const archived = { id: uid(), title: 'On Shabbat Elevators', topic: 'Shabbat', start: at(-2, 21, 0) };
  say(null, `Side room “${archived.title}” was archived after 24h of quiet.`, at(-1, 21, 30), { kind: 'recap', meta: { roomId: archived.id, title: archived.title } });
  msgs[msgs.length - 1].body = 'Dani and Yoni disagreed about whether a Shabbat elevator is a leniency or a design solution; they converged on the view that intent matters less than function, and agreed to bring the question to Rav Adler.';
  // today
  const t0 = T - 3 * H;
  say(yoni, 'Random thought from last week’s shiur: the Rambam wrote the Guide for the Perplexed in Hebrew, right? It reads so differently from the Mishneh Torah.', t0, { fc: demoFc('partly_inaccurate', 'Partly inaccurate', 'The Guide was written in Judeo-Arabic (Arabic in Hebrew letters). The Hebrew version most people know is Shmuel ibn Tibbon’s translation (1204). The Mishneh Torah, by contrast, was written in Hebrew.', 'Moreh Nevuchim, ibn Tibbon translation; Encyclopaedia Judaica “Guide of the Perplexed”') });
  say(miriam, 'That explains the style difference! Mishlei 18:21 says death and life are in the power of the tongue — language shapes everything.', t0 + 6 * MIN, { fc: demoFc('accurate', 'Accurate', 'Mishlei 18:21: “Death and life are in the power of the tongue, and those who love it will eat its fruit.”', 'Mishlei 18:21') });
  say(avi, 'Ibn Tibbon actually corresponded with the Rambam about the translation. There’s a famous letter where the Rambam tells him not to translate word-for-word.', t0 + 11 * MIN);
  say(eli, 'Love this. Is that letter in English anywhere?', t0 + 14 * MIN);
  // hot side room: free will (from ~1h ago)
  const fwRoom = { id: uid(), title: 'On Free Will & Foreknowledge', topic: 'Free Will', start: T - 70 * MIN };
  const heated: Mm[] = [
    { u: eli, body: 'Honestly if God knows what I’ll do, I’m not choosing. Full stop.', t: fwRoom.start },
    { u: avi, body: 'That’s exactly the category error the Rambam warns about — His knowing isn’t like ours.', t: fwRoom.start + 1 * MIN },
    { u: eli, body: 'That’s not an answer, that’s giving up on the question!!', t: fwRoom.start + 2 * MIN },
    { u: avi, body: 'It IS an answer. The Ra’avad complains but doesn’t refute it.', t: fwRoom.start + 3 * MIN },
    { u: dani, body: 'You’re both ignoring Spinoza — he just accepted determinism and moved on.', t: fwRoom.start + 4 * MIN },
    { u: eli, body: 'Spinoza got excommunicated for that, so…', t: fwRoom.start + 5 * MIN },
  ];
  for (const h of heated) say(h.u, h.body, h.t, { moved: fwRoom.id });
  say(null, `This debate moved to a side room: “${fwRoom.title}”`, fwRoom.start + 6 * MIN, { kind: 'roomcard', meta: { roomId: fwRoom.id, title: fwRoom.title, reasons: ['confrontational phrases', 'repeated !!', 'rapid back-and-forth (4 exchanges)'], method: 'heuristic' } });
  // quieter side room: spinoza (from ~3h ago)
  const spRoom = { id: uid(), title: 'On Spinoza: Heretic or Misunderstood?', topic: 'Spinoza', start: T - 5 * H };
  say(null, `This debate moved to a side room: “${spRoom.title}”`, spRoom.start + 5 * MIN, { kind: 'roomcard', meta: { roomId: spRoom.id, title: spRoom.title, reasons: ['rapid back-and-forth'], method: 'heuristic' } });
  say(noa, 'Reminder: the Ethics of Speech shiur is tonight — Rabbi Levi said to bring questions for the live Q&A.', T - 40 * MIN);
  say(miriam, 'Saving a seat up front 🙂', T - 22 * MIN);

  // side room contents
  const side: Mm[] = [];
  const sideSay = (room: string, u: U | null, body: string, t: number, extra: Partial<Mm> = {}) => side.push({ u, body, t, room, ...extra });
  sideSay(fwRoom.id, null, `↳ ${heated.length} messages moved from Members' Hall`, fwRoom.start - 1, { kind: 'system', meta: { movedCount: heated.length, from: 'hall' } });
  for (const h of heated) sideSay(fwRoom.id, h.u, h.body, h.t, { meta: { movedFrom: 'hall' } });
  sideSay(fwRoom.id, yoni, 'Joining late — Spinoza wasn’t excommunicated for determinism specifically, the cherem never lists the doctrines.', T - 50 * MIN);
  sideSay(fwRoom.id, avi, 'Fair. But my point stands: knowledge ≠ causation. Knowing you’ll eat breakfast doesn’t make you eat it.', T - 30 * MIN);
  sideSay(fwRoom.id, eli, 'OK, that analogy actually helps. Still think it dodges the timeless-knowledge problem.', T - 18 * MIN);
  sideSay(fwRoom.id, dani, 'Bring it to Rabbi Levi tonight — perfect live Q&A question.', T - 9 * MIN);
  sideSay(spRoom.id, null, '↳ 4 messages moved from Members\' Hall', spRoom.start - 1, { kind: 'system', meta: { movedCount: 4, from: 'hall' } });
  sideSay(spRoom.id, yoni, 'Spinoza is the most misunderstood Jewish thinker. He took the Rambam to its logical end.', spRoom.start);
  sideSay(spRoom.id, dani, 'Or he took the Rambam and removed the one thing that made it Jewish.', spRoom.start + 1 * MIN);
  sideSay(spRoom.id, yoni, 'You can’t call it un-Jewish just because it’s uncomfortable!!', spRoom.start + 2 * MIN);
  sideSay(spRoom.id, dani, 'I can when it denies revelation, seriously.', spRoom.start + 3 * MIN);
  sideSay(spRoom.id, noa, 'Ben-Gurion wanted the cherem lifted, for what it’s worth.', spRoom.start + 40 * MIN, { fc: demoFc('accurate', 'Accurate', 'In 1953 David Ben-Gurion publicly called for the ban on Spinoza to be revoked; the Amsterdam community declined.', 'Ben-Gurion, “Let Us Make Amends”, Davar 1953') });
  sideSay(spRoom.id, yoni, 'Exactly. Dr. Cohen’s lecture on Thursday will be good for this.', spRoom.start + 2 * H);
  sideSay(archived.id, null, '↳ 5 messages moved from Members\' Hall', archived.start - 1, { kind: 'system', meta: { movedCount: 5, from: 'hall' } });
  sideSay(archived.id, dani, 'A Shabbat elevator is a heter dressed up as engineering.', archived.start);
  sideSay(archived.id, yoni, 'No way — it’s engineering that makes a heter unnecessary!!', archived.start + 1 * MIN);
  sideSay(archived.id, dani, 'Come on, the intent is obviously to get around the melacha.', archived.start + 2 * MIN);
  sideSay(archived.id, yoni, 'Intent matters less than function. Ask Rav Adler.', archived.start + 3 * MIN);
  sideSay(archived.id, dani, 'Deal. Bringing it to the next Vaad.', archived.start + 6 * MIN);

  await db.insert(schema.rooms).values([
    { id: fwRoom.id, kind: 'side', title: fwRoom.title, topic: fwRoom.topic, eventId: null, parentRoomId: 'hall', status: 'active', detectedBy: 'heuristic', lastActivityAt: T - 9 * MIN, archivedAt: null, createdAt: fwRoom.start + 6 * MIN },
    { id: spRoom.id, kind: 'side', title: spRoom.title, topic: spRoom.topic, eventId: null, parentRoomId: 'hall', status: 'active', detectedBy: 'heuristic', lastActivityAt: spRoom.start + 2 * H, archivedAt: null, createdAt: spRoom.start + 5 * MIN },
    { id: archived.id, kind: 'side', title: archived.title, topic: archived.topic, eventId: null, parentRoomId: 'hall', status: 'archived', detectedBy: 'heuristic', lastActivityAt: archived.start + 6 * MIN, archivedAt: at(-1, 21, 30), createdAt: archived.start },
  ]);
  for (const [r, us] of [[fwRoom.id, [eli, avi, dani, yoni]], [spRoom.id, [yoni, dani, noa]], [archived.id, [dani, yoni]]] as [string, U[]][]) for (const u of us) await db.insert(schema.roomMembers).values({ roomId: r, userId: u.id, joinedAt: T - 2 * H });
  for (const m of msgs) await db.insert(schema.messages).values({ id: uid(), roomId: 'hall', userId: m.u?.id ?? null, kind: m.kind ?? 'text', body: m.body, meta: m.meta ? JSON.stringify(m.meta) : null, factCheck: m.fc ? JSON.stringify(m.fc) : null, movedToRoomId: m.moved ?? null, createdAt: m.t });
  for (const m of side) await db.insert(schema.messages).values({ id: uid(), roomId: m.room!, userId: m.u?.id ?? null, kind: m.kind ?? 'text', body: m.body, meta: m.meta ? JSON.stringify(m.meta) : null, factCheck: m.fc ? JSON.stringify(m.fc) : null, movedToRoomId: null, createdAt: m.t });

  /* ---------------- notes / highlights + notifications for the demo member */
  const fwLib = lib[0];
  await db.insert(schema.notes).values([
    { id: uid(), userId: avi.id, libraryItemId: fwLib.id, eventId: null, text: fwLib.keyPoints[3].text, ts: fwLib.keyPoints[3].ts, createdAt: T - 6 * D },
    { id: uid(), userId: avi.id, libraryItemId: fwLib.id, eventId: null, text: fwLib.keyPoints[1].text, ts: fwLib.keyPoints[1].ts, createdAt: T - 6 * D - H },
    { id: uid(), userId: avi.id, libraryItemId: lib[3].id, eventId: null, text: lib[3].keyPoints[0].text, ts: lib[3].keyPoints[0].ts, createdAt: T - 13 * D },
    { id: uid(), userId: miriam.id, libraryItemId: lib[1].id, eventId: null, text: lib[1].keyPoints[0].text, ts: lib[1].keyPoints[0].ts, createdAt: T - 20 * D },
  ]);
  await db.insert(schema.notifications).values([
    { id: uid(), userId: avi.id, kind: 'summary', title: 'Discussion summary ready', body: 'Free Will & Providence', link: `/events/${fw.id}/summary`, dedupeKey: null, readAt: T - 6 * D, createdAt: T - 7 * D + 2 * H },
    { id: uid(), userId: avi.id, kind: 'room', title: 'Your debate moved to a side room', body: `“${fwRoom.title}” — keep the conversation going there.`, link: `/rooms/${fwRoom.id}`, dedupeKey: `room:${fwRoom.id}`, readAt: null, createdAt: fwRoom.start + 6 * MIN },
    { id: uid(), userId: admin.id, kind: 'application', title: 'New membership application', body: 'Talia Gross · sponsored by Miriam S.', link: '/admin?tab=applications', dedupeKey: null, readAt: null, createdAt: T - 3 * H },
  ]);

  /* ---------------- logins file */
  const md = `# Kerem — demo logins

Generated by \`npm run seed\` on ${new Date().toString()}. Re-running the seed resets the database and generates **new** passwords.
This file is git-ignored. Do not commit it or deploy it.

| Role | Email | Password |
|---|---|---|
| Admin | ${admin.email} | \`${adminPw}\` |
| Demo member (Avi Rosen, marked “demo”) | ${avi.email} | \`${demoPw}\` |

Invite code for testing signup: **KRM742** (multi-use, 50 uses) — open \`/join?code=KRM742\`.

The other demo members (${demoOthers.map((u) => u.name).join(', ')}) have random, unpublished passwords; they exist to populate chats and RSVPs and are labelled “demo” in the app.
`;
  console.log(`Seeded: ${people.length} users, ${upcoming.length + past.length} events, ${lib.length} library items, ${msgs.length + side.length} messages.`);
  if (envPw) {
    console.log('Passwords taken from ADMIN_PASSWORD / DEMO_PASSWORD env vars; DEMO_LOGINS.md not written.');
  } else {
    fs.writeFileSync(path.resolve('DEMO_LOGINS.md'), md, { mode: 0o600 });
    console.log('Logins written to DEMO_LOGINS.md');
  }
}
/* Give admin to existing users listed in OWNER_EMAILS (runs on every production start). */
async function promoteOwners() {
  const { ownerEmails } = await import('../lib/owners');
  const list = ownerEmails();
  if (!list.length) return;
  const { client } = await import('../lib/db');
  const r = await client.execute({ sql: `UPDATE users SET role = 'admin' WHERE lower(email) IN (${list.map(() => '?').join(',')}) AND role != 'admin'`, args: list });
  console.log(`[seed] OWNER_EMAILS: ${list.length} configured, ${r.rowsAffected} promoted to admin`);
}

main().then(async () => { await promoteOwners(); }).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
