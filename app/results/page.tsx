'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaged } from '@/lib/api';
import { VideoRow, ShortCard } from '@/components/cards';
import { Icon, Loader, Sentinel } from '@/components/ui';
import type { VideoItem } from '@/lib/types';

const TYPES: [string, string][] = [['all', 'すべて'], ['video', '動画'], ['shorts', 'ショート'], ['channel', 'チャンネル'], ['playlist', '再生リスト']];
const SORTS: [string, string][] = [['relevance', '関連度順'], ['upload_date', 'アップロード日'], ['view_count', '視聴回数'], ['rating', '評価']];

function Results() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get('search_query') || '';
  const type = sp.get('type') || 'all';
  const sort = sp.get('sort') || 'relevance';
  const set = (k: string, v: string) => { const p = new URLSearchParams(sp.toString()); p.set(k, v); router.push('/results?' + p.toString()); };
  const { items, more, hasMore, loading, error } = usePaged<VideoItem>(q ? { fn: 'search', q, type, sort } : null, (cont) => ({ fn: 'search', cont }));
  const shorts = items.filter((i) => i.kind === 'short');
  const rest = items.filter((i) => i.kind !== 'short');
  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="sticky-chips">
        <div className="chips">
          {TYPES.map(([k, l]) => <button key={k} className={`chip sl ${type === k ? 'on' : ''}`} onClick={() => set('type', k)}>{l}</button>)}
          <span style={{ width: 1, background: 'var(--md-outline-variant)', margin: '4px 4px' }} />
          {SORTS.map(([k, l]) => <button key={k} className={`chip sl ${sort === k ? 'on' : ''}`} onClick={() => set('sort', k)}>{k === sort && <Icon n="check" size={18} />}{l}</button>)}
        </div>
      </div>
      {error && <div className="empty"><div className="big"><Icon n="search_off" /></div>結果を読み込めませんでした</div>}
      {type === 'shorts' ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', margin: 0 }}>{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div>
      ) : (
        <div className="list">
          {rest.slice(0, 4).map((v) => <VideoRow key={v.kind + v.id} v={v} />)}
          {shorts.length > 0 && (
            <section className="shelf">
              <div className="shelf-h"><Icon n="bolt" fill />ショート</div>
              <div className="shorts-row">{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div>
            </section>
          )}
          {rest.slice(4).map((v) => <VideoRow key={v.kind + v.id} v={v} />)}
        </div>
      )}
      {!loading && !error && q && items.length === 0 && <div className="empty"><div className="big"><Icon n="search_off" /></div>結果が見つかりませんでした</div>}
      <Sentinel active={hasMore && !loading} onHit={more} />
      {loading && <Loader />}
    </div>
  );
}
export default function Page() { return <Suspense><Results /></Suspense>; }
