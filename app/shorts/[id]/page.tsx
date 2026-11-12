'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { actions, useStore } from '@/lib/store';
import { share } from '@/components/cards';
import { Icon, Loader, useSnack } from '@/components/ui';
import type { VideoItem } from '@/lib/types';

const SEEDS = ['#shorts', 'ショート 面白い', 'shorts 猫', 'ショート ゲーム', 'shorts 料理', 'shorts ダンス', 'shorts 音楽'];

export default function Shorts({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [list, setList] = useState<VideoItem[]>([{ kind: 'short', id, title: '' }]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const seedIdx = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const liked = useStore((s) => s.liked);
  const snack = useSnack();

  const loadMore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const q = SEEDS[seedIdx.current++ % SEEDS.length];
      const d = await api({ fn: 'search', q, type: 'shorts', sort: 'relevance' });
      setList((p) => { const ids = new Set(p.map((x) => x.id)); return [...p, ...d.items.filter((x: VideoItem) => x.kind === 'short' && !ids.has(x.id))]; });
    } catch {} finally { setBusy(false); }
  }, [busy]);

  useEffect(() => { loadMore(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (active >= list.length - 3) loadMore(); }, [active, list.length, loadMore]);
  useEffect(() => {
    const cur = list[active];
    if (cur) {
      window.history.replaceState(null, '', `/shorts/${cur.id}`);
      if (cur.title) actions.addHistory(cur);
    }
  }, [active, list]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = () => setActive(Math.round(el.scrollTop / el.clientHeight));
    el.addEventListener('scroll', f, { passive: true });
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') { el.scrollBy({ top: el.clientHeight, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'k') { el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' }); e.preventDefault(); }
    };
    window.addEventListener('keydown', k);
    return () => { el.removeEventListener('scroll', f); window.removeEventListener('keydown', k); };
  }, []);

  return (
    <div className="shorts" ref={box}>
      {list.map((v, i) => {
        const isLiked = liked.some((x) => x.id === v.id);
        return (
          <div className="short" key={v.id}>
            <div className="frame">
              {Math.abs(i - active) <= 0 ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&loop=1&playlist=${v.id}&playsinline=1&rel=0&modestbranding=1&hl=ja`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={v.title}
                />
              ) : (
                <img src={`https://i.ytimg.com/vi/${v.id}/oardefault.jpg`} onError={(e) => { (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`; }} alt="" referrerPolicy="no-referrer" />
              )}
              {i !== active && v.title && <div className="cap">{v.title}<div className="small" style={{ opacity: 0.8 }}>{v.views}</div></div>}
            </div>
            <div className="side-act">
              <button onClick={() => actions.toggleLike(v)}><span className="icon-btn"><Icon n="thumb_up" fill={isLiked} /></span>{isLiked ? '評価済み' : '高評価'}</button>
              <button onClick={() => actions.toggleWL(v)}><span className="icon-btn"><Icon n="playlist_add" /></span>保存</button>
              <button onClick={() => share({ id: v.id, title: v.title }, snack)}><span className="icon-btn"><Icon n="share" /></span>共有</button>
              <Link href={`/watch?v=${v.id}`}><button><span className="icon-btn"><Icon n="open_in_full" /></span>通常表示</button></Link>
            </div>
          </div>
        );
      })}
      {busy && <Loader />}
    </div>
  );
}
