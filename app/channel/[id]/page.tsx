'use client';
import { use, useState } from 'react';
import { usePaged } from '@/lib/api';
import { VideoCard, ShortCard, SubButton, SkeletonGrid } from '@/components/cards';
import { Avatar, Icon, Loader, Sentinel } from '@/components/ui';
import type { VideoItem } from '@/lib/types';

const TABS: [string, string][] = [['home', 'ホーム'], ['videos', '動画'], ['shorts', 'ショート'], ['streams', 'ライブ'], ['playlists', '再生リスト'], ['about', '概要']];

export default function Channel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState('videos');
  const [info, setInfo] = useState<any>(null);
  const t = tab === 'about' ? 'home' : tab;
  const { items, extra, more, hasMore, loading, error } = usePaged<VideoItem>({ fn: 'channel', id, tab: t }, (cont) => ({ fn: 'channel', id, cont }));
  const ci = extra?.info || info;
  if (extra?.info && extra.info !== info) setTimeout(() => setInfo(extra.info));
  const shorts = items.filter((i) => i.kind === 'short');
  const vids = items.filter((i) => i.kind === 'video' || i.kind === 'playlist');
  return (
    <div className="page" style={{ maxWidth: 1600 }}>
      {ci?.banner && <div className="banner"><img src={ci.banner} alt="" referrerPolicy="no-referrer" /></div>}
      <div className="chead">
        <Avatar src={ci?.avatar} name={ci?.name} className="xl" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>{ci?.name || <span className="skel" style={{ display: 'inline-block', width: 240, height: 36 }} />}</h1>
          <div className="muted">{[ci?.handle, ci?.subs, ci?.videos].filter(Boolean).join(' • ')}</div>
          {ci?.description && <div className="cdesc muted">{ci.description}</div>}
          {ci && <SubButton id={id} name={ci.name} avatar={ci.avatar} />}
        </div>
      </div>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={`sl ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'about' ? (
        <div className="card" style={{ padding: 24, whiteSpace: 'pre-wrap' }}>
          <div className="h2" style={{ marginTop: 0 }}>概要</div>
          {ci?.description || '説明はありません'}
          <div className="h2">詳細</div>
          <div className="row-flex muted"><Icon n="link" />{`https://www.youtube.com/channel/${id}`}</div>
          {ci?.subs && <div className="row-flex muted" style={{ marginTop: 8 }}><Icon n="group" />{ci.subs}</div>}
          {ci?.videos && <div className="row-flex muted" style={{ marginTop: 8 }}><Icon n="video_library" />{ci.videos}</div>}
        </div>
      ) : (
        <>
          {error && <div className="empty"><div className="big"><Icon n="error" /></div>読み込めませんでした</div>}
          {!items.length && loading && <SkeletonGrid n={8} />}
          {tab === 'shorts' || (vids.length === 0 && shorts.length) ? (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', margin: 0 }}>{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div>
          ) : (
            <>
              {tab === 'home' && shorts.length > 0 && <section className="shelf"><div className="shelf-h"><Icon n="bolt" fill />ショート</div><div className="shorts-row">{shorts.map((v) => <ShortCard key={v.id} v={v} />)}</div></section>}
              <div className="grid">{vids.map((v) => <VideoCard key={v.kind + v.id} v={{ ...v, avatar: undefined, authorId: undefined, author: v.kind === 'playlist' ? v.author : undefined }} />)}</div>
            </>
          )}
          {!loading && !error && items.length === 0 && <div className="empty">このタブにはコンテンツがありません</div>}
          <Sentinel active={hasMore && !loading} onHit={more} />
          {loading && items.length > 0 && <Loader />}
        </>
      )}
    </div>
  );
}
