'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<any> | null = null;
function loadApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export type PlayerHandle = {
  seek: (t: number, play?: boolean) => void;
  time: () => number;
  duration: () => number;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  setRate: (r: number) => void;
  rate: () => number;
  mute: () => void;
  volume: (delta: number) => number;
  state: () => number;
  setQuality: (q: string) => void;
};

type Props = {
  id: string;
  start?: number;
  autoplay?: boolean;
  rate?: number;
  quality?: string;
  vertical?: boolean;
  onTick?: (t: number, d: number) => void;
  onEnded?: () => void;
  onRate?: (r: number) => void;
  onState?: (s: number) => void;
};

const Player = forwardRef<PlayerHandle, Props>(function Player(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const p = useRef<any>(null);
  const ready = useRef(false);
  const cbs = useRef(props);
  cbs.current = props;
  const currentId = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    seek: (t, play) => { p.current?.seekTo?.(t, true); if (play) p.current?.playVideo?.(); },
    time: () => p.current?.getCurrentTime?.() || 0,
    duration: () => p.current?.getDuration?.() || 0,
    toggle: () => { const st = p.current?.getPlayerState?.(); if (st === 1 || st === 3) p.current?.pauseVideo(); else p.current?.playVideo(); },
    play: () => p.current?.playVideo?.(),
    pause: () => p.current?.pauseVideo?.(),
    setRate: (r) => p.current?.setPlaybackRate?.(r),
    rate: () => p.current?.getPlaybackRate?.() || 1,
    mute: () => { if (p.current?.isMuted?.()) p.current.unMute(); else p.current?.mute?.(); },
    volume: (d) => { const v = Math.max(0, Math.min(100, (p.current?.getVolume?.() || 0) + d)); p.current?.setVolume?.(v); if (v > 0) p.current?.unMute?.(); return v; },
    state: () => p.current?.getPlayerState?.() ?? -1,
    setQuality: (q) => p.current?.setPlaybackQuality?.(q),
  }));

  // create once
  useEffect(() => {
    let destroyed = false;
    let timer: any;
    loadApi().then((YT) => {
      if (destroyed || !box.current) return;
      const el = document.createElement('div');
      box.current.appendChild(el);
      currentId.current = props.id;
      p.current = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com',
        videoId: props.id,
        playerVars: {
          autoplay: props.autoplay === false ? 0 : 1,
          start: Math.floor(props.start || 0),
          rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1, hl: 'ja', cc_lang_pref: 'ja', enablejsapi: 1,
          origin: location.origin,
        },
        events: {
          onReady: (e: any) => {
            ready.current = true;
            if (cbs.current.rate && cbs.current.rate !== 1) e.target.setPlaybackRate(cbs.current.rate);
            if (cbs.current.quality && cbs.current.quality !== 'default') e.target.setPlaybackQuality(cbs.current.quality);
          },
          onStateChange: (e: any) => {
            cbs.current.onState?.(e.data);
            if (e.data === 0) cbs.current.onEnded?.();
            if (e.data === 1 && cbs.current.rate && e.target.getPlaybackRate() !== cbs.current.rate) {
              // keep preferred rate after loads
            }
          },
          onPlaybackRateChange: (e: any) => cbs.current.onRate?.(e.data),
        },
      });
      timer = setInterval(() => {
        const pl = p.current;
        if (!ready.current || !pl?.getCurrentTime) return;
        cbs.current.onTick?.(pl.getCurrentTime(), pl.getDuration());
      }, 500);
    });
    return () => {
      destroyed = true;
      clearInterval(timer);
      try { p.current?.destroy?.(); } catch {}
      p.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // change video
  useEffect(() => {
    if (!p.current || !ready.current || currentId.current === props.id) return;
    currentId.current = props.id;
    p.current.loadVideoById({ videoId: props.id, startSeconds: Math.floor(props.start || 0) });
    if (cbs.current.rate && cbs.current.rate !== 1) setTimeout(() => p.current?.setPlaybackRate?.(cbs.current.rate), 500);
  }, [props.id, props.start]);

  return <div ref={box} style={{ position: 'absolute', inset: 0 }} />;
});

export default Player;
