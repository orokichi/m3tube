'use client';
import Link from 'next/link';
import type { VideoItem } from '@/lib/types';
import { actions, useStore } from '@/lib/store';
import { Avatar, Icon, useMenu, useSnack } from './ui';

function useItemMenu(v: VideoItem) {
  const menu = useMenu();
  const snack = useSnack();
  const inWL = useStore((s) => s.wl.some((x) => x.id === v.id));
  const queueEnabled = useStore((s) => s.settings.queueEnabled);
  const inQueue = useStore((s) => s.queue.some((x) => x.id === v.id));
  return (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menu({
      x: r.right, y: r.bottom,
      items: [
        ...(queueEnabled && v.kind === 'video' ? [{ icon: inQueue ? 'playlist_remove' : 'queue_play_next', label: inQueue ? 'キューから削除' : 'キューに追加', fn: () => { actions.toggleQueue(v); snack({ msg: inQueue ? 'キューから削除しました' : 'キューに追加しました', action: { label: '元に戻す', fn: () => actions.toggleQueue(v) } }); } }] : []),
        { icon: inWL ? 'playlist_remove' : 'schedule', label: inWL ? '「後で見る」から削除' : '「後で見る」に保存', fn: () => { actions.toggleWL(v); snack({ msg: inWL ? '「後で見る」から削除しました' : '「後で見る」に保存しました', action: { label: '元に戻す', fn: () => actions.toggleWL(v) } }); } },
        { icon: 'share', label: '共有', fn: () => share(v, snack) },
        { icon: 'open_in_new', label: 'YouTubeで開く', fn: () => window.open(`https://www.youtube.com/${v.kind === 'short' ? 'shorts/' : 'watch?v='}${v.id}`, '_blank') },
        ...(v.authorId ? [{ icon: 'account_circle', label: 'チャンネルへ移動', fn: () => { location.href = `/channel/${v.authorId}`; } }] : []),
      ],
    });
  };
}

export function share(v: { id: string; title: string }, snack: (s: any) => void, t?: number) {
  const url = `https://youtu.be/${v.id}${t ? `?t=${Math.floor(t)}` : ''}`;
  if (navigator.share) navigator.share({ title: v.title, url }).catch(() => {});
  else navigator.clipboard.writeText(url).then(() => snack({ msg: 'リンクをコピーしました' }));
}

function Progress({ id }: { id: string }) {
  const h = useStore((s) => s.history.find((x) => x.id === id));
  if (!h?.pos || !h?.len) return null;
  const p = Math.min(100, (h.pos / h.len) * 100);
  if (p < 2) return null;
  return <div className="progress"><i style={{ width: p + '%' }} /></div>;
}

function Thumb({ v }: { v: VideoItem }) {
  return (
    <div className="thumb">
      {v.thumb && <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      {v.live ? <span className="badge live"><Icon n="sensors" size={14} />ライブ</span> : v.duration && <span className="badge">{v.duration}</span>}
      <Progress id={v.id} />
    </div>
  );
}

export function VideoCard({ v }: { v: VideoItem }) {
  const open = useItemMenu(v);
  if (v.kind === 'short') return <ShortCard v={v} />;
  const href = v.kind === 'playlist' ? `/playlist?list=${v.id}` : `/watch?v=${v.id}`;
  return (
    <div className="vcard fadein">
      <Link href={href}><Thumb v={v} /></Link>
      <div className="meta">
        {v.authorId ? <Link href={`/channel/${v.authorId}`}><Avatar src={v.avatar} name={v.author} className="lg" /></Link> : v.avatar || v.author ? <Avatar src={v.avatar} name={v.author} className="lg" /> : null}
        <div className="txt">
          <Link href={href} className="title2" title={v.title}>{v.title}</Link>
          <div className="sub">
            {v.author && (v.authorId ? <Link href={`/channel/${v.authorId}`}>{v.author}</Link> : <span>{v.author}</span>)}
            <div>{[v.views, v.published, v.count].filter(Boolean).join(' • ')}</div>
          </div>
        </div>
        <button className="icon-btn sl" aria-label="メニュー" onClick={open} style={{ marginRight: -8 }}><Icon n="more_vert" /></button>
      </div>
    </div>
  );
}

export function VideoRow({ v, compact, onClick }: { v: VideoItem; compact?: boolean; onClick?: () => void }) {
  const open = useItemMenu(v);
  if (v.kind === 'channel') return <ChannelRow v={v} />;
  const href = v.kind === 'playlist' ? `/playlist?list=${v.id}` : v.kind === 'short' ? `/shorts/${v.id}` : `/watch?v=${v.id}`;
  return (
    <div className={`vrow fadein ${compact ? 'compact' : ''}`}>
      <Link href={href} onClick={onClick}><Thumb v={{ ...v, duration: v.kind === 'playlist' ? v.count : v.kind === 'short' ? 'ショート' : v.duration }} /></Link>
      <div className="txt">
        <Link href={href} onClick={onClick} className="title2" title={v.title}>{v.title}</Link>
        {compact ? (
          <div className="sub">
            {v.author && <div>{v.author}</div>}
            <div>{[v.views, v.published].filter(Boolean).join(' • ')}</div>
          </div>
        ) : (
          <>
            <div className="sub">{[v.views, v.published].filter(Boolean).join(' • ')}</div>
            {v.author && (
              <Link href={v.authorId ? `/channel/${v.authorId}` : '#'} className="chan"><Avatar src={v.avatar} name={v.author} className="" />{v.author}</Link>
            )}
            {v.desc && <div className="desc">{v.desc}</div>}
          </>
        )}
      </div>
      {v.kind !== 'playlist' && <button className="icon-btn sl more" aria-label="メニュー" onClick={open}><Icon n="more_vert" /></button>}
    </div>
  );
}

export function ShortCard({ v }: { v: VideoItem }) {
  return (
    <Link href={`/shorts/${v.id}`} className="scard fadein">
      <div className="sthumb">{v.thumb && <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />}</div>
      <div className="t">{v.title}</div>
      {v.views && <div className="muted small">{v.views}</div>}
    </Link>
  );
}

export function SubButton({ id, name, avatar, size }: { id: string; name: string; avatar?: string; size?: 'sm' }) {
  const on = useStore((s) => s.subs.some((x) => x.id === id));
  const snack = useSnack();
  return (
    <button
      className={`btn ${on ? 'surface' : 'inverse'} ${size || ''}`}
      onClick={(e) => { e.preventDefault(); actions.toggleSub({ id, name, avatar }); snack({ msg: on ? `${name} のチャンネル登録を解除しました` : `${name} をチャンネル登録しました` }); }}
    >
      {on && <Icon n="notifications" />}{on ? '登録済み' : 'チャンネル登録'}
    </button>
  );
}

export function ChannelRow({ v }: { v: VideoItem }) {
  return (
    <Link href={`/channel/${v.id}`} className="crow fadein">
      <div className="cav">{v.thumb ? <img src={v.thumb} alt="" referrerPolicy="no-referrer" /> : <Avatar name={v.title} className="xl" />}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 650 }}>{v.title}</div>
        <div className="muted small">{v.subs}</div>
        {v.desc && <div className="muted small hide-sm" style={{ marginTop: 6 }}>{v.desc}</div>}
      </div>
      <SubButton id={v.id} name={v.title} avatar={v.thumb} />
    </Link>
  );
}

export function SkeletonGrid({ n = 12 }: { n?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="vcard">
          <div className="thumb skel" />
          <div className="meta"><div className="avatar lg skel" /><div className="txt"><div className="skel" style={{ height: 18, width: '90%' }} /><div className="skel" style={{ height: 14, width: '60%', marginTop: 8 }} /></div></div>
        </div>
      ))}
    </div>
  );
}
