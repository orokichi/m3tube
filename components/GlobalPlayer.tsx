'use client';
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Player, { PlayerHandle } from './Player';
import { Icon } from './ui';
import { actions, getState, queueAdvance, useStore } from '@/lib/store';
import {
  closeSession, getPlayerSession, getWatchCallbacks, getWatchSlot, loadSessionVideo,
  playerHandleRef, setSessionPlaying, usePlayerSession,
} from '@/lib/playerSession';

type Rect = { left: number; top: number; width: number; height: number };
const BAR_H = 52; // .gp-bar height, kept in sync with globals.css

function miniRect(): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(356, vw - 24);
  const h = (w * 9) / 16 + BAR_H;
  const bottomH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-h')) || 0;
  return { left: vw - 16 - w, top: vh - (16 + bottomH) - h, width: w, height: h };
}

/**
 * Resident player for the experimental mini player.
 *
 * Mounted once in the Shell (layout level), so route changes never unmount
 * it: the YouTube iframe is created a single time and only the fixed
 * container's rect changes — over the watch page's slot while on /watch,
 * docked bottom-right everywhere else. Because the iframe node is never
 * moved in the DOM and never re-created, playback (and play/pause state)
 * continues seamlessly across navigation.
 */
export default function GlobalPlayer() {
  const enabled = useStore((s) => s.settings.miniPlayerEnabled);
  const speed = useStore((s) => s.settings.speed);
  const quality = useStore((s) => s.settings.quality);
  const session = usePlayerSession();
  const path = usePathname();
  const router = useRouter();
  const [watchRect, setWatchRect] = useState<(Rect & { radius: string }) | null>(null);
  const [mRect, setMRect] = useState<Rect | null>(null);
  const lastSave = useRef(0);

  const isShorts = path.startsWith('/shorts');
  const onWatch = path === '/watch';
  const mode: 'watch' | 'mini' | 'hidden' = !session.active || isShorts ? 'hidden' : onWatch ? 'watch' : 'mini';

  // Feature switched off: tear the session down so behavior reverts to the
  // classic "leaving /watch stops playback" (the watch page mounts its own
  // local player again from the saved resume position).
  useEffect(() => { if (!enabled && getPlayerSession().active) closeSession(); }, [enabled]);

  // Shorts has its own full-screen player; keep the mini player paused/hidden.
  useEffect(() => { if (isShorts && session.active) playerHandleRef.current?.pause(); }, [isShorts, session.active]);

  // While on /watch, follow the placeholder slot's rect every frame (it is in
  // normal flow and sticky on mobile, so its viewport rect moves on scroll).
  useEffect(() => {
    if (mode !== 'watch') return;
    let raf = 0;
    const measure = () => {
      const el = getWatchSlot();
      if (el) {
        const r = el.getBoundingClientRect();
        const radius = getComputedStyle(el).borderRadius;
        setWatchRect((prev) => (
          prev && Math.abs(prev.left - r.left) < 0.6 && Math.abs(prev.top - r.top) < 0.6
            && Math.abs(prev.width - r.width) < 0.6 && Math.abs(prev.height - r.height) < 0.6 && prev.radius === radius
            ? prev
            : { left: r.left, top: r.top, width: r.width, height: r.height, radius }
        ));
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [mode, session.slotPresent]);

  // Mini rect: compute on entering mini mode and keep it fresh on resize.
  useEffect(() => {
    if (mode !== 'mini') return;
    const f = () => setMRect(miniRect());
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [mode]);

  const setHandle = useCallback((h: PlayerHandle | null) => { playerHandleRef.current = h; }, []);

  if (!enabled || !session.active || !session.videoId) return null;
  const vid = session.videoId;

  // --- player callbacks: delegate to the watch page while it is mounted ---
  const onTick = (t: number, d: number) => {
    const wc = getWatchCallbacks();
    if (wc?.onTick) { wc.onTick(t, d); return; }
    // mini mode fallback: keep the resume position fresh, like the watch page does
    if (Date.now() - lastSave.current > 4000 && d > 0) { lastSave.current = Date.now(); actions.setPos(vid, t, d); }
  };
  const onEnded = () => {
    const wc = getWatchCallbacks();
    if (wc?.onEnded) { wc.onEnded(); return; }
    // mini mode fallback: queue advance (same priority as the watch page),
    // otherwise just stop at the end (related autoplay needs the watch page).
    actions.setPos(vid, 0, 1);
    if (getState().settings.queueEnabled) {
      const nxt = queueAdvance(vid);
      if (nxt) { loadSessionVideo(nxt.id, nxt.title, 0); actions.addHistory(nxt); return; }
    }
    setSessionPlaying(false);
  };
  const onState = (s: number) => setSessionPlaying(s === 1 || s === 3);
  const onRate = (r: number) => getWatchCallbacks()?.onRate?.(r);

  const expand = () => router.push(`/watch?v=${vid}`);

  let cls = 'global-player';
  let style: CSSProperties;
  if (mode === 'watch') {
    cls += ' gp-watch';
    style = watchRect
      ? { left: watchRect.left, top: watchRect.top, width: watchRect.width, height: watchRect.height, borderRadius: watchRect.radius }
      : { left: 0, top: 0, width: 320, height: 180, visibility: 'hidden' };
  } else {
    const r = mRect || miniRect();
    style = { left: r.left, top: r.top, width: r.width, height: r.height };
    if (mode === 'mini') cls += ' gp-mini';
    else { cls += ' gp-hidden'; style = { ...style, visibility: 'hidden', pointerEvents: 'none' }; }
  }

  return (
    <div className={cls} style={style} aria-hidden={mode === 'hidden'}>
      <div className="gp-video">
        <Player ref={setHandle} id={vid} start={session.startAt} rate={speed} quality={quality} onTick={onTick} onEnded={onEnded} onRate={onRate} onState={onState} />
        {mode === 'mini' && <button className="gp-catcher" onClick={expand} aria-label="大きく表示" />}
      </div>
      {mode === 'mini' && (
        <div className="gp-bar">
          <button className="icon-btn sl" onClick={() => playerHandleRef.current?.toggle()} aria-label={session.playing ? '一時停止' : '再生'}>
            <Icon n={session.playing ? 'pause' : 'play_arrow'} fill />
          </button>
          <button className="gp-title" onClick={expand} title={session.title}>{session.title || '再生中'}</button>
          <button className="icon-btn sl" onClick={expand} aria-label="大きく表示"><Icon n="open_in_full" /></button>
          <button className="icon-btn sl" onClick={() => closeSession()} aria-label="閉じる"><Icon n="close" /></button>
        </div>
      )}
    </div>
  );
}
