'use client';
export type DSum = { themes: string[]; topQuestions: { body: string; votes: number; name?: string }[]; insights: { text: string; name: string; note: string }[]; overview: string; stats: { attended: number; comments: number; questions: number; durationMin: number }; method: 'ai' | 'extractive'; generatedAt: number };
export function DiscussionSummary({ s, title }: { s: DSum; title?: string }) {
  return (
    <div data-testid="discussion-summary">
      <div className="card" style={{ padding: 16, background: 'linear-gradient(160deg,#1E2E52,#16233F)' }}>
        <div className="row between"><div className="eyebrow">✦ Discussion Summary</div><span className={s.method === 'ai' ? 'pill new' : 'pill offline'}>{s.method === 'ai' ? 'AI' : 'Extractive · AI off'}</span></div>
        {title ? <div className="serif" style={{ fontSize: 20, fontWeight: 600, marginTop: 6, lineHeight: 1.25 }}>{title}</div> : null}
        <div className="row" style={{ gap: 16, marginTop: 10, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <span><b style={{ color: 'var(--cream)' }}>{s.stats.attended}</b> attended</span>
          <span><b style={{ color: 'var(--cream)' }}>{s.stats.comments}</b> comment{s.stats.comments === 1 ? '' : 's'}</span>
          <span><b style={{ color: 'var(--cream)' }}>{s.stats.questions}</b> question{s.stats.questions === 1 ? '' : 's'}</span>
          <span><b style={{ color: 'var(--cream)' }}>{s.stats.durationMin}</b> min</span>
        </div>
      </div>
      {s.overview ? <div className="tldr mt12">{s.overview}</div> : null}
      {s.themes.length ? <><div className="eyebrow" style={{ margin: '16px 0 8px' }}>Themes</div><div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>{s.themes.map((t, i) => <span key={i} className="chip">{t}</span>)}</div></> : null}
      {s.topQuestions.length ? <><div className="eyebrow" style={{ margin: '16px 0 6px' }}>Top questions</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#D9D3C5' }}>{s.topQuestions.map((q, i) => <div key={i}>{i + 1}. {q.body} <span className="muted">· {q.votes} ▲</span></div>)}</div></> : null}
      {s.insights.length ? <><div className="eyebrow" style={{ margin: '16px 0 8px' }}>Notable insights</div>
        {s.insights.map((x, i) => <div key={i} className="card" style={{ padding: '11px 12px', fontSize: 13, lineHeight: 1.45, marginBottom: 8 }}><span className="corm" style={{ fontSize: 24, color: 'var(--gold)', lineHeight: 0, verticalAlign: -8, marginRight: 3 }}>“</span>{x.text}<div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{x.name}{x.note ? ` · ${x.note}` : ''}</div></div>)}</> : null}
      {!s.themes.length && !s.topQuestions.length && !s.insights.length ? <div className="empty mt12">The session was quiet — no comments or questions to summarize.</div> : null}
    </div>
  );
}
