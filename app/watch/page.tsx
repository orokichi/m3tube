'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Player, { PlayerHandle } from '@/components/Player';
import { api, fmtNum, fmtTime, useApi, usePaged } from '@/lib/api';
import { actions, getState, useStore } from '@/lib/store';
import { VideoRow, SubButton, share } from '@/components/cards';
import { Avatar, Icon, Loader, Sentinel, Switch, useMenu, useSnack } from '@/components/ui';
import type { VideoItem } from '@/lib/types';
import AskTube from '@/components/AskTube';

type Chapter = { title: string; start: number; thumb?: string };
type VideoData = {
  id: string; title: string; description: string; views: string; shortViews?: string; published?: string; date?: string; likes?: number;
  channel: { id: string; name: string; avatar?: string; subs?: string; verified?: boolean };
  keywords: string[]; isLive: boolean; duration?: number; chapters: Chapter[]; related: VideoItem[]; relatedCont?: string;
};
type Seg = { segment: [number, number]; category: string };

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SB_LABEL: Record<string, string> = { sponsor: 'スポンサー', selfpromo: '宣伝', interaction: '登録の呼びかけ', intro: 'イントロ', outro: 'エンドカード', music_offtopic: '音楽以外' };

function parseT(t: string | null) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

/** Linkify description/comment text: urls, timestamps, hashtags. */
function RichText({ text, onSeek }: { text: string; onSeek?: (t: number) => void }) {
  const parts = useMemo(() => {
    const re = /(https?:\/\/[^\s]+)|(\b\d{1,2}(?::\d{2}){1,2}\b)|(#[^\s#、。]+)/g;
    const out: React.ReactNode[] = [];
    let last = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[1]) {
        const yt = m[1].match(/(?:youtu\.be\/|watch\?v=|shorts\/)([\w-]{11})/);
        out.push(yt ? <Link key={k++} href={`/watch?v=${yt[1]}`}>{m[1]}</Link> : <a key={k++} href={m[1]} target="_blank" rel="noopener noreferrer">{m[1].length > 60 ? m[1].slice(0, 57) + '…' : m[1]}</a>);
      } else if (m[2] && onSeek) {
        const sec = m[2].split(':').reverse().reduce((a, v, i) => a + Number(v) * 60 ** i, 0);
        out.push(<a key={k++} href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSeek(sec); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{m[2]}</a>);
      } else if (m[3]) {
        out.push(<Link key={k++} href={`/results?search_query=${encodeURIComponent(m[3])}`}>{m[3]}</Link>);
      } else out.push(m[0]);
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text, onSeek]);
  return <>{parts}</>;
}

function Comments({ id, onSeek }: { id: string; onSeek: (t: number) => void }) {
  const [sort, setSort] = useState<'TOP_COMMENTS' | 'NEWEST_FIRST'>('TOP_COMMENTS');
  const { items, extra, more, hasMore, loading, error } = usePaged<any>({ fn: 'comments', id, sort }, (cont) => ({ fn: 'comments', id, cont }));
  const menu = useMenu();
  if (error) return <div className="muted" style={{ margin: '24px 0' }}>コメントは無効になっているか、読み込めませんでした。</div>;
  return (
    <section>
      <div className="comments-h">
        <b>{extra?.count ? `${extra.count} 件のコメント` : 'コメント'}</b>
        <button className="btn sm text" onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          menu({ x: r.right + 160, y: r.bottom, items: [
            { icon: sort === 'TOP_COMMENTS' ? 'check' : 'trending_up', label: '人気順', fn: () => setSort('TOP_COMMENTS') },
            { icon: sort === 'NEWEST_FIRST' ? 'check' : 'schedule', label: '新しい順', fn: () => setSort('NEWEST_FIRST') },
          ] });
        }}><Icon n="sort" />並べ替え</button>
      </div>
      {items.map((c) => <Comment key={c.id} c={c} vid={id} onSeek={onSeek} />)}
      <Sentinel active={hasMore && !loading} onHit={more} />
      {loading && <Loader small />}
    </section>
  );
}

function Comment({ c, vid, onSeek, reply }: { c: any; vid: string; onSeek: (t: number) => void; reply?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reps, setReps] = useState<any[]>([]);
  const [cont, setCont] = useState<string | undefined>(c.replyCont);
  const [busy, setBusy] = useState(false);
  const [long, setLong] = useState(false);
  const loadReplies = async () => {
    if (!cont) return;
    setBusy(true);
    try {
      const r = await api({ fn: 'comments', id: vid, cont });
      setReps((p) => [...p, ...r.items]);
      setCont(r.continuation);
    } catch {} finally { setBusy(false); }
  };
  const text: string = c.text || '';
  const isLong = text.length > 300 || text.split('\n').length > 5;
  return (
    <div className="comment fadein">
      {c.authorId ? <Link href={`/channel/${c.authorId}`}><Avatar src={c.avatar} name={c.author} className={reply ? '' : 'lg'} /></Link> : <Avatar src={c.avatar} name={c.author} className="lg" />}
      <div className="body">
        {c.pinned && <div className="pinned"><Icon n="keep" />固定されたコメント</div>}
        <div className="head"><b className={c.owner ? 'ownerb' : ''}>{c.author}</b><span className="muted">{c.published}</span></div>
        <div className="ctext" style={!long && isLong ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}>
          <RichText text={text} onSeek={onSeek} />
        </div>
        {isLong && <button className="small" style={{ fontWeight: 700, color: 'var(--md-on-surface-variant)' }} onClick={() => setLong(!long)}>{long ? '一部を表示' : '続きを読む'}</button>}
        <div className="cact">
          <span className="icon-btn"><Icon n="thumb_up" /></span>{c.likes || ''}
          {c.hearted && <Icon n="favorite" fill size={16} className="" />}
        </div>
        {!reply && c.replies > 0 && (
          <>
            <button className="replies-btn" onClick={() => { if (!open && !reps.length) loadReplies(); setOpen(!open); }}>
              <Icon n={open ? 'expand_less' : 'expand_more'} />{c.replies} 件の返信
            </button>
            {open && (
              <div className="replies">
                {reps.map((r) => <Comment key={r.id} c={r} vid={vid} onSeek={onSeek} reply />)}
                {busy && <Loader small />}
                {!busy && cont && reps.length > 0 && <button className="replies-btn" onClick={loadReplies}><Icon n="subdirectory_arrow_right" />他の返信を表示</button>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Watch() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get('v') || '';
  const tParam = parseT(sp.get('t'));
  const listParam = sp.get('list');
  const settings = useStore((s) => s.settings);
  const liked = useStore((s) => s.liked.some((x) => x.id === id));
  const disliked = useStore((s) => s.disliked.includes(id));
  const inWL = useStore((s) => s.wl.some((x) => x.id === id));
  const snack = useSnack();
  const menu = useMenu();
  const { data, error, loading } = useApi<VideoData>(id ? { fn: 'video', id } : null);
  const player = useRef<PlayerHandle>(null);
  const [theater, setTheater] = useState(false);
  const [loop, setLoop] = useState(false);
  const [ab, setAb] = useState<[number | null, number | null]>([null, null]);
  const [rate, setRate] = useState(1);
  const [time, setTime] = useState(0);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [ryd, setRyd] = useState<{ likes: number; dislikes: number } | null>(null);
  const [descOpen, setDescOpen] = useState(false);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [relFilter, setRelFilter] = useState<'all' | 'channel'>('all');
  const [help, setHelp] = useState(false);
  const skipped = useRef<Set<number>>(new Set());
  const lastSave = useRef(0);

  useEffect(() => { setTheater(localStorage.getItem('m3tube:theater') === '1'); setRate(getState().settings.speed); }, []);
  useEffect(() => { localStorage.setItem('m3tube:theater', theater ? '1' : '0'); }, [theater]);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 1016);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // start position (resume)
  const start = useMemo(() => {
    if (tParam) return tParam;
    if (!settings.resume) return 0;
    const h = getState().history.find((x) => x.id === id);
    if (h?.pos && h.len && h.pos / h.len < 0.95 && h.pos > 10) return Math.max(0, h.pos - 3);
    return 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // related list (paged)
  const [related, setRelated] = useState<VideoItem[]>([]);
  const [relCont, setRelCont] = useState<string | undefined>();
  const [relBusy, setRelBusy] = useState(false);
  useEffect(() => { if (data) { setRelated(data.related || []); setRelCont(data.relatedCont); } else { setRelated([]); } }, [data]);
  const moreRelated = useCallback(async () => {
    if (!relCont || relBusy) return;
    setRelBusy(true);
    try {
      const r = await api({ fn: 'next', cont: relCont });
      setRelated((p) => { const ids = new Set(p.map((x) => x.id)); return [...p, ...r.items.filter((x: VideoItem) => !ids.has(x.id))]; });
      setRelCont(r.continuation && r.continuation !== relCont ? r.continuation : undefined);
    } catch { setRelCont(undefined); } finally { setRelBusy(false); }
  }, [relCont, relBusy]);

  // history + document title
  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} - M3Tube`;
    actions.addHistory({ kind: 'video', id: data.id, title: data.title, thumb: `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`, author: data.channel.name, authorId: data.channel.id, avatar: data.channel.avatar, views: data.shortViews || data.views, published: data.published });
    return () => { document.title = 'M3Tube'; };
  }, [data]);

  // reset per video
  useEffect(() => {
    setAb([null, null]); setSegs([]); setRyd(null); setDescOpen(false); setShowComments(false); skipped.current = new Set(); setTime(0);
    if (!id) return;
    if (getState().settings.sponsorblock) {
      fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${id}&categories=${encodeURIComponent(JSON.stringify(Object.keys(SB_LABEL)))}`)
        .then((r) => (r.ok ? r.json() : [])).then((d) => setSegs(Array.isArray(d) ? d : [])).catch(() => {});
    }
    if (getState().settings.dislikes) {
      fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setRyd({ likes: d.likes, dislikes: d.dislikes })).catch(() => {});
    }
  }, [id]);

  // sleep timer
  useEffect(() => {
    if (!sleepAt) return;
    const t = setInterval(() => { if (Date.now() >= sleepAt) { player.current?.pause(); setSleepAt(null); snack({ msg: 'スリープタイマー: 再生を停止しました' }); } }, 1000);
    return () => clearInterval(t);
  }, [sleepAt, snack]);

  const seek = useCallback((t: number) => player.current?.seek(t, true), []);

  const onTick = (t: number, d: number) => {
    setTime(t);
    if (Date.now() - lastSave.current > 4000 && d > 0) { lastSave.current = Date.now(); actions.setPos(id, t, d); }
    // SponsorBlock auto-skip
    segs.forEach((s, i) => {
      if (t >= s.segment[0] && t < s.segment[1] - 0.5 && !skipped.current.has(i)) {
        skipped.current.add(i);
        player.current?.seek(s.segment[1]);
        snack({ msg: `${SB_LABEL[s.category] || s.category}をスキップしました`, action: { label: '元に戻す', fn: () => player.current?.seek(s.segment[0]) } });
      }
    });
    // A-B repeat
    if (ab[0] != null && ab[1] != null && t >= ab[1]) player.current?.seek(ab[0]);
  };

  const playlistQueue = useMemo<VideoItem[] | null>(() => {
    if (listParam === 'WL') return getState().wl;
    if (listParam === 'LL') return getState().liked;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listParam, id]);

  const nextVideo = useMemo(() => {
    if (playlistQueue) { const i = playlistQueue.findIndex((x) => x.id === id); return playlistQueue[i + 1] || null; }
    return related.find((r) => r.kind === 'video' && !r.live) || null;
  }, [playlistQueue, related, id]);

  const onEnded = () => {
    actions.setPos(id, 0, 1);
    if (loop) { player.current?.seek(0, true); return; }
    if (settings.autoplay && nextVideo) router.push(`/watch?v=${nextVideo.id}${listParam ? `&list=${listParam}` : ''}`);
  };

  // keyboard shortcuts
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = player.current;
      if (!p) return;
      const key = e.key;
      let handled = true;
      if (key === 'k' || key === ' ') p.toggle();
      else if (key === 'j') p.seek(p.time() - 10);
      else if (key === 'l') p.seek(p.time() + 10);
      else if (key === 'ArrowLeft') p.seek(p.time() - 5);
      else if (key === 'ArrowRight') p.seek(p.time() + 5);
      else if (key === 'ArrowUp') snack({ msg: `音量 ${p.volume(5)}%` });
      else if (key === 'ArrowDown') snack({ msg: `音量 ${p.volume(-5)}%` });
      else if (key === 'm') p.mute();
      else if (key === 't') setTheater((v) => !v);
      else if (key === 'f') { const el = document.querySelector('.player') as HTMLElement; if (document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen?.(); }
      else if (key === '>' || key === '<') { const i = SPEEDS.indexOf(p.rate()); const n = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 3 : i) + (key === '>' ? 1 : -1)))]; p.setRate(n); snack({ msg: `再生速度 ${n}x` }); }
      else if (key === 'N' && nextVideo) router.push(`/watch?v=${nextVideo.id}`);
      else if (key === '?') setHelp(true);
      else if (/^[0-9]$/.test(key)) p.seek((p.duration() * Number(key)) / 10);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [nextVideo, router, snack]);

  const curChapter = useMemo(() => {
    const ch = data?.chapters || [];
    let c = -1;
    ch.forEach((x, i) => { if (time >= x.start) c = i; });
    return c;
  }, [time, data]);

  if (!id) return <div className="empty">動画が指定されていません</div>;

  const item: VideoItem = { kind: 'video', id, title: data?.title || '', thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, author: data?.channel.name, authorId: data?.channel.id, avatar: data?.channel.avatar, views: data?.shortViews, published: data?.published };
  const likeCount = (data?.likes ?? ryd?.likes ?? 0) + (liked ? 1 : 0);
  const relShown = relFilter === 'channel' ? related.filter((r) => r.authorId === data?.channel.id || r.author === data?.channel.name) : related;

  const speedMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menu({ x: r.right + 150, y: r.bottom, items: SPEEDS.map((s) => ({ icon: s === rate ? 'check' : 'speed', label: s === 1 ? '標準' : `${s}x`, fn: () => { player.current?.setRate(s); setRate(s); } })) });
  };
  const sleepMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const set = (m: number | null) => { setSleepAt(m ? Date.now() + m * 60000 : null); snack({ msg: m ? `${m}分後に停止します` : 'スリープタイマーをオフにしました' }); };
    menu({ x: r.right + 150, y: r.bottom, items: [
      { icon: 'timer_off', label: 'オフ', fn: () => set(null) },
      ...[10, 15, 30, 45, 60, 90].map((m) => ({ icon: 'bedtime', label: `${m} 分`, fn: () => set(m) })),
    ] });
  };
  const abClick = () => {
    const t = player.current?.time() || 0;
    if (ab[0] == null) { setAb([t, null]); snack({ msg: `A 地点 ${fmtTime(t)} を設定` }); }
    else if (ab[1] == null) { if (t > ab[0]) { setAb([ab[0], t]); snack({ msg: `${fmtTime(ab[0])}〜${fmtTime(t)} をリピート` }); } }
    else { setAb([null, null]); snack({ msg: 'A-B リピートを解除' }); }
  };

  const tools = (
    <div className="ptools">
      <button className={`btn surface sl ${theater ? 'on' : ''} hide-sm`} onClick={() => setTheater(!theater)} title="シアターモード (t)"><Icon n={theater ? 'fit_screen' : 'width_wide'} />シアター</button>
      <button className={`btn surface sl ${rate !== 1 ? 'on' : ''}`} onClick={speedMenu} title="再生速度 (< >)"><Icon n="speed" />{rate === 1 ? '速度' : `${rate}x`}</button>
      <button className={`btn surface sl ${loop ? 'on' : ''}`} onClick={() => { setLoop(!loop); snack({ msg: loop ? 'ループ再生オフ' : 'ループ再生オン' }); }}><Icon n="repeat" />ループ</button>
      <button className={`btn surface sl ${ab[0] != null ? 'on' : ''}`} onClick={abClick} title="A-Bリピート">
        <Icon n="repeat_one" />{ab[0] == null ? 'A-B' : ab[1] == null ? `A ${fmtTime(ab[0])}→B?` : `${fmtTime(ab[0])}-${fmtTime(ab[1])}`}
      </button>
      <button className={`btn surface sl ${sleepAt ? 'on' : ''}`} onClick={sleepMenu}><Icon n="bedtime" />{sleepAt ? `${Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000))}分` : 'タイマー'}</button>
      {segs.length > 0 && <span className="btn sm tonal" title="SponsorBlock"><Icon n="shield" />{segs.length}区間スキップ</span>}
      <button className="icon-btn sl hide-sm" onClick={() => setHelp(true)} title="ショートカット (?)"><Icon n="keyboard" /></button>
    </div>
  );

  const playerEl = (
    <div className="player-box">
      <div className="watch-sticky">
        <div className="player">
          <Player ref={player} id={id} start={start} rate={rate} quality={settings.quality} onTick={onTick} onEnded={onEnded} onRate={setRate} />
          {segs.length > 0 && data?.duration ? (
            <div className="sb-bar">{segs.map((s, i) => <i key={i} style={{ left: `${(s.segment[0] / data.duration!) * 100}%`, width: `${((s.segment[1] - s.segment[0]) / data.duration!) * 100}%` }} />)}</div>
          ) : null}
        </div>
      </div>
      {!theater && tools}
    </div>
  );

  const primaryInfo = (
    <div className="primary-info">
      {theater && tools}
      {error && <div className="empty"><div className="big"><Icon n="error" /></div>動画情報を読み込めませんでした<div className="small">{error}</div></div>}
      {loading && !data && <><div className="skel" style={{ height: 26, width: '70%', margin: '16px 0' }} /><div className="skel" style={{ height: 40, width: '40%' }} /></>}
      {data && (
        <>
          <h1>{data.title}</h1>
          <div className="owner">
            <div className="who">
              <Link href={`/channel/${data.channel.id}`}><Avatar src={data.channel.avatar} name={data.channel.name} className="lg" /></Link>
              <div style={{ minWidth: 0 }}>
                <Link href={`/channel/${data.channel.id}`}><b>{data.channel.name} {data.channel.verified && <Icon n="verified" fill size={14} />}</b></Link>
                <div className="muted small">{data.channel.subs}</div>
              </div>
              <SubButton id={data.channel.id} name={data.channel.name} avatar={data.channel.avatar} />
            </div>
            <div className="actions">
              <div className="like-group">
                <button className={`btn sl ${liked ? 'on' : ''}`} onClick={() => { actions.toggleLike(item); snack({ msg: liked ? '高く評価した動画から削除しました' : '高く評価した動画に追加しました' }); }}>
                  <Icon n="thumb_up" fill={liked} />{fmtNum(likeCount) || '高評価'}
                </button>
                <button className={`btn sl ${disliked ? 'on' : ''}`} onClick={() => actions.toggleDislike(id)} title="低評価 (Return YouTube Dislike)">
                  <Icon n="thumb_down" fill={disliked} />{ryd ? fmtNum(ryd.dislikes + (disliked ? 1 : 0)) : ''}
                </button>
              </div>
              <button className="btn surface sl" onClick={() => share(item, snack, player.current?.time())}><Icon n="share" />共有</button>
              <button className={`btn surface sl`} onClick={() => { actions.toggleWL(item); snack({ msg: inWL ? '「後で見る」から削除しました' : '「後で見る」に保存しました' }); }}><Icon n={inWL ? 'playlist_add_check' : 'playlist_add'} />{inWL ? '保存済み' : '保存'}</button>
              <button className="btn surface sl" onClick={() => { const t = Math.floor(player.current?.time() || 0); navigator.clipboard.writeText(`https://youtu.be/${id}?t=${t}`); snack({ msg: `${fmtTime(t)} からのリンクをコピーしました` }); }}><Icon n="link" />現在位置</button>
              <a className="btn surface sl" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer"><Icon n="open_in_new" />YouTube</a>
            </div>
          </div>

          <div className={`desc-box ${descOpen ? 'open' : ''}`} onClick={() => !descOpen && setDescOpen(true)}>
            <div className="stats">{descOpen ? data.views : data.shortViews || data.views}　{descOpen ? data.date || data.published : data.published}</div>
            {data.keywords.length > 0 && <div className="tags small">{data.keywords.slice(0, descOpen ? 20 : 3).map((k) => <Link key={k} href={`/results?search_query=${encodeURIComponent('#' + k)}`}>#{k}</Link>)}</div>}
            <div className="text"><RichText text={data.description || ''} onSeek={seek} /></div>
            {descOpen && data.chapters.length > 0 && (
              <>
                <div className="h2" style={{ fontSize: 16, marginTop: 16 }}>チャプター</div>
                <div className="chapters">
                  {data.chapters.map((c, i) => (
                    <button key={i} className={`chapter ${i === curChapter ? 'on' : ''}`} onClick={() => seek(c.start)}>
                      {c.thumb && <img src={c.thumb} alt="" referrerPolicy="no-referrer" />}
                      <b>{c.title}</b><span>{fmtTime(c.start)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div style={{ marginTop: 8, fontWeight: 700 }}>
              {descOpen ? <button onClick={(e) => { e.stopPropagation(); setDescOpen(false); }}>一部を表示</button> : '…もっと見る'}
            </div>
          </div>

          <AskTube id={id} onSeek={(t) => { seek(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }} getTime={() => player.current?.time() || 0} />

          {data.chapters.length > 0 && !descOpen && curChapter >= 0 && (
            <div className="row-flex small" style={{ marginBottom: 8 }}>
              <Icon n="segment" size={18} /><b>{data.chapters[curChapter].title}</b>
              <span className="muted">{fmtTime(data.chapters[curChapter].start)}</span>
            </div>
          )}

          {narrow ? (
            <div className="desc-box" onClick={() => setShowComments(!showComments)}>
              <div className="stats row-flex"><span>コメント</span><span className="spacer" /><Icon n={showComments ? 'expand_less' : 'expand_more'} /></div>
            </div>
          ) : null}
          {(!narrow || showComments) && <Comments id={id} onSeek={seek} />}
        </>
      )}
    </div>
  );

  const side = (
    <aside className="side secondary">
      {playlistQueue && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div className="row-flex" style={{ marginBottom: 8 }}><Icon n="playlist_play" /><b>{listParam === 'WL' ? '後で見る' : '高く評価した動画'}</b><span className="muted small">{playlistQueue.findIndex((x) => x.id === id) + 1} / {playlistQueue.length}</span></div>
          <div className="list" style={{ maxHeight: 360, overflowY: 'auto', gap: 8 }}>
            {playlistQueue.map((v) => <div key={v.id} style={{ opacity: v.id === id ? 1 : 0.85, background: v.id === id ? 'var(--md-secondary-container)' : undefined, borderRadius: 12, padding: 4 }}><VideoRow v={{ ...v }} compact onClick={() => router.push(`/watch?v=${v.id}&list=${listParam}`)} /></div>)}
          </div>
        </div>
      )}
      <div className="upnext">
        <span>次の動画</span>
        <span className="row-flex small muted">自動再生<Switch on={settings.autoplay} onChange={(v) => actions.setSettings({ autoplay: v })} label="自動再生" /></span>
      </div>
      <div className="chips">
        <button className={`chip sl ${relFilter === 'all' ? 'on' : ''}`} onClick={() => setRelFilter('all')}>すべて</button>
        {data && <button className={`chip sl ${relFilter === 'channel' ? 'on' : ''}`} onClick={() => setRelFilter('channel')}>{data.channel.name} の動画</button>}
      </div>
      <div className="list" style={{ gap: 10 }}>
        {relShown.filter((r) => r.kind !== 'channel').map((v) => <VideoRow key={v.kind + v.id} v={v} compact />)}
        {!data && loading && Array.from({ length: 8 }).map((_, i) => <div key={i} className="vrow compact"><div className="thumb skel" style={{ width: 168 }} /><div className="txt"><div className="skel" style={{ height: 14 }} /><div className="skel" style={{ height: 12, width: '60%', marginTop: 6 }} /></div></div>)}
      </div>
      <Sentinel active={!!relCont && !relBusy} onHit={moreRelated} />
      {relBusy && <Loader small />}
    </aside>
  );

  return (
    <div className={`watch ${theater ? 'theater' : ''}`}>
      {theater ? (
        <>{playerEl}<div style={{ minWidth: 0 }}>{primaryInfo}</div>{side}</>
      ) : (
        <>
          <div style={{ minWidth: 0 }}>{playerEl}{primaryInfo}{narrow && <div style={{ padding: '0 12px' }}>{side}</div>}</div>
          {!narrow && side}
        </>
      )}
      {help && (
        <div className="dialog-scrim" onClick={() => setHelp(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>キーボード ショートカット</h3>
            {[['k / Space', '再生 / 一時停止'], ['j / l', '10 秒戻る / 進む'], ['← / →', '5 秒戻る / 進む'], ['↑ / ↓', '音量'], ['m', 'ミュート'], ['f', '全画面'], ['t', 'シアターモード'], ['< / >', '再生速度'], ['0-9', '0%〜90% へ移動'], ['Shift+N', '次の動画'], ['/', '検索']].map(([k, d]) => (
              <div key={k} className="row-flex" style={{ padding: '6px 0' }}><span className="kbd">{k}</span>{d}</div>
            ))}
            <div style={{ textAlign: 'right', marginTop: 12 }}><button className="btn filled" onClick={() => setHelp(false)}>閉じる</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() { return <Suspense><Watch /></Suspense>; }
