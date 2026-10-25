'use client';
import { useState, type ReactNode } from 'react';
import { toEmbed } from '@/lib/client';
export function Player({ url, mediaType, thumb, children, autoplay }: { url?: string | null; mediaType?: string; thumb?: number | null; children?: ReactNode; autoplay?: boolean }) {
  const [on, setOn] = useState(!!autoplay);
  const e = toEmbed(url, mediaType);
  return (
    <div className={`stagevid t${thumb || 1}`} data-testid="player">
      {!on || !e ? (
        <>
          <div className={`thumb t${thumb || 1}`} style={{ position: 'absolute', inset: 0, height: '100%' }} />
          {e ? (
            e.type === 'link'
              ? <a className="bigplay" href={e.src} target="_blank" rel="noreferrer" aria-label="Open media"><svg width="18" height="18" viewBox="0 0 12 12"><path d="M3 1.5l7 4.5-7 4.5z" fill="#0B1426" /></svg></a>
              : <button className="bigplay" onClick={() => setOn(true)} aria-label="Play"><svg width="18" height="18" viewBox="0 0 12 12"><path d="M3 1.5l7 4.5-7 4.5z" fill="#0B1426" /></svg></button>
          ) : <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', fontSize: 12, color: 'var(--muted)', zIndex: 2 }}>No recording linked yet</div>}
        </>
      ) : e.type === 'iframe' ? (
        <iframe src={`${e.src}${e.src.includes('?') ? '&' : '?'}autoplay=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title="Recording" />
      ) : e.type === 'video' ? (
        <video src={e.src} controls autoPlay playsInline />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 16, zIndex: 3 }}><audio src={e.src} controls autoPlay style={{ width: '100%' }} /></div>
      )}
      {children}
    </div>
  );
}
