'use client';
import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaged } from '@/lib/api';
import { VideoCard, ShortCard, SkeletonGrid } from '@/components/cards';
import { Icon, Loader, Sentinel } from '@/components/ui';
import type { VideoItem } from '@/lib/types';
import { useStore } from '@/lib/store';

const CHIPS: [string, string][] = [
  ['all', 'すべて'], ['music', '音楽'], ['game', 'ゲーム'], ['live', 'ライブ'], ['news', 'ニュース'], ['anime', 'アニメ'],
  ['sports', 'スポーツ'], ['cooking', '料理'], ['vlog', 'Vlog'], ['tech', 'テクノロジー'], ['comedy', 'お笑い'], ['animals', '動物'],
];

function Home() {
  const sp = useSearchParams();
  const router = useRouter();
  const chip = sp.get('chip') || 'all';
  const hist = useStore((s) => s.history);
  const { items, extra, more, hasMore, loading, error } = usePaged<VideoItem>({ fn: 'home', chip }, (cont) => ({ fn: 'home', cont }));
  const shorts: VideoItem[] = extra?.shorts || [];
  const cont = useMemo(() => hist.filter((h) => h.pos && h.len && h.pos / h.len < 0.92 && h.pos > 30).slice(0, 4), [hist]);
  const videos = items.filter((v) => v.kind === 'video');
  return (
    <div className="page">
      <div className="sticky-chips">
        <div className="chips">
          {CHIPS.map(([k, l]) => (
            <button key={k} className={`chip sl ${chip === k ? 'on' : ''}`} onClick={() => router.push(k === 'all' ? '/' : `/?chip=${k}`)}>{l}</button>
          ))}
        </div>
      </div>
      {chip === 'all' && cont.length > 0 && (
        <section className="shelf">
          <div className="shelf-h"><Icon n="resume" fill />続きを見る</div>
          <div className="grid">{cont.map((v) => <VideoCard key={v.id} v={v} />)}</div>
        </section>
      )}
      {error && <div className="empty"><div className="big"><Icon n="cloud_off" /></div>読み込めませんでした<div className="small">{error}</div></div>}
      {!items.length && loading && <SkeletonGrid />}
      {videos.length > 0 && <div className="grid">{videos.slice(0, 8).map((v) => <VideoCard key={v.id} v={v} />)}</div>}
      {shorts.length > 0 && (
        <section className="shelf" style={{ marginTop: 32 }}>
          <div className="shelf-h"><Icon n="bolt" fill />ショート</div>
          <div className="shorts-row">{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div>
        </section>
      )}
      {videos.length > 8 && <div className="grid">{videos.slice(8).map((v) => <VideoCard key={v.id} v={v} />)}</div>}
      <Sentinel active={hasMore && !loading} onHit={more} />
      {loading && items.length > 0 && <Loader />}
    </div>
  );
}
export default function Page() { return <Suspense><Home /></Suspense>; }
