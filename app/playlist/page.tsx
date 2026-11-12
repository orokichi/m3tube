'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePaged } from '@/lib/api';
import { actions, useStore } from '@/lib/store';
import { VideoRow } from '@/components/cards';
import { Icon, Loader, Sentinel } from '@/components/ui';
import type { VideoItem } from '@/lib/types';

function PL() {
  const sp = useSearchParams();
  const list = sp.get('list') || '';
  const local = list === 'WL' || list === 'LL';
  const wl = useStore((s) => s.wl);
  const liked = useStore((s) => s.liked);
  const remote = usePaged<VideoItem>(!local && list ? { fn: 'playlist', id: list } : null, (cont) => ({ fn: 'playlist', cont }));
  const items = local ? (list === 'WL' ? wl : liked) : remote.items;
  const info = local ? { title: list === 'WL' ? '後で見る' : '高く評価した動画', author: 'あなた', count: `${items.length} 本の動画` } : remote.extra?.info;
  const first = items.find((x) => x.kind === 'video');
  return (
    <div className="page" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', maxWidth: 1500 }}>
      <div style={{ flex: '0 0 360px', maxWidth: '100%' }}>
        <div className="card" style={{ padding: 24, background: 'linear-gradient(160deg, var(--md-primary-container), var(--md-tertiary-container))', color: 'var(--md-on-primary-container)', position: 'sticky', top: 'calc(var(--top-h) + 12px)' }}>
          {first && <img src={first.thumb} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 20 }} referrerPolicy="no-referrer" />}
          <div className="h1" style={{ margin: '16px 0 4px' }}>{info?.title || '再生リスト'}</div>
          <div style={{ fontWeight: 600 }}>{info?.author}</div>
          <div className="small" style={{ opacity: 0.8 }}>{[info?.count, info?.views].filter(Boolean).join(' • ')}</div>
          <div className="row-flex" style={{ marginTop: 16, flexWrap: 'wrap' }}>
            {first && <Link className="btn inverse lg" href={`/watch?v=${first.id}${local ? `&list=${list}` : ''}`}><Icon n="play_arrow" fill />すべて再生</Link>}
            {first && <Link className="btn surface lg" href={`/watch?v=${items[Math.floor(Math.random() * items.length)].id}${local ? `&list=${list}` : ''}`}><Icon n="shuffle" />シャッフル</Link>}
          </div>
        </div>
      </div>
      <div style={{ flex: '1 1 500px', minWidth: 0 }}>
        {items.length === 0 && !remote.loading && <div className="empty"><div className="big"><Icon n="playlist_play" /></div>この再生リストには動画がありません</div>}
        <div className="list">
          {items.map((v, i) => (
            <div key={v.id + i} className="row-flex" style={{ alignItems: 'flex-start' }}>
              <span className="muted small" style={{ width: 24, textAlign: 'center', paddingTop: 30 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <VideoRow v={v} compact />
                {local && <button className="icon-btn sl" style={{ position: 'absolute', right: 0, bottom: 0 }} aria-label="削除" onClick={() => (list === 'WL' ? actions.toggleWL(v) : actions.toggleLike(v))}><Icon n="delete" /></button>}
              </div>
            </div>
          ))}
        </div>
        {!local && <Sentinel active={remote.hasMore && !remote.loading} onHit={remote.more} />}
        {remote.loading && <Loader />}
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><PL /></Suspense>; }
