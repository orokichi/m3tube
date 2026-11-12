'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { agoSeconds, api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { VideoCard, ShortCard, SkeletonGrid } from '@/components/cards';
import { Avatar, Icon } from '@/components/ui';
import type { VideoItem } from '@/lib/types';

export default function Subs() {
  const subs = useStore((s) => s.subs);
  const [items, setItems] = useState<VideoItem[] | null>(null);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const key = subs.map((s) => s.id).join(',');
  useEffect(() => {
    if (!subs.length) { setItems([]); return; }
    let alive = true;
    setItems(null);
    (async () => {
      const out: VideoItem[] = [];
      const queue = [...subs.slice(0, 40)];
      const worker = async () => {
        while (queue.length) {
          const s = queue.shift()!;
          try {
            const d = await api({ fn: 'channel', id: s.id, tab: 'videos' });
            d.items.filter((x: VideoItem) => x.kind === 'video').slice(0, 12).forEach((v: VideoItem) => out.push({ ...v, author: v.author || s.name, authorId: s.id, avatar: s.avatar }));
            if (alive) setItems([...out].sort((a, b) => agoSeconds(a.published) - agoSeconds(b.published)));
          } catch {}
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (alive) setItems([...out].sort((a, b) => agoSeconds(a.published) - agoSeconds(b.published)));
      try {
        const sh: VideoItem[] = [];
        await Promise.all(subs.slice(0, 6).map(async (s) => { try { const d = await api({ fn: 'channel', id: s.id, tab: 'shorts' }); sh.push(...d.items.filter((x: VideoItem) => x.kind === 'short').slice(0, 3)); } catch {} }));
        if (alive) setShorts(sh);
      } catch {}
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!subs.length) return (
    <div className="page"><div className="empty"><div className="big"><Icon n="subscriptions" /></div><div className="h2" style={{ justifyContent: 'center' }}>登録チャンネルはまだありません</div>気に入ったチャンネルを登録すると、最新の動画がここに並びます。<div style={{ marginTop: 20 }}><Link href="/" className="btn filled">動画を探す</Link></div></div></div>
  );
  const shown = (items || []).filter((v) => filter === 'all' || v.authorId === filter);
  return (
    <div className="page">
      <div className="sticky-chips">
        <div className="chips">
          <button className={`chip sl ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>すべて</button>
          {subs.map((s) => <button key={s.id} className={`chip sl ${filter === s.id ? 'on' : ''}`} onClick={() => setFilter(s.id)}><Avatar src={s.avatar} name={s.name} className="" />{s.name}</button>)}
          <Link href="/feed/channels" className="chip sl"><Icon n="tune" size={18} />管理</Link>
        </div>
      </div>
      <div className="h2" style={{ marginTop: 8 }}>最新</div>
      {!items && <SkeletonGrid />}
      {shown.length > 0 && <div className="grid">{shown.slice(0, 8).map((v) => <VideoCard key={v.id} v={v} />)}</div>}
      {filter === 'all' && shorts.length > 0 && <section className="shelf" style={{ marginTop: 32 }}><div className="shelf-h"><Icon n="bolt" fill />ショート</div><div className="shorts-row">{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div></section>}
      {shown.length > 8 && <div className="grid">{shown.slice(8).map((v) => <VideoCard key={v.id} v={v} />)}</div>}
    </div>
  );
}
