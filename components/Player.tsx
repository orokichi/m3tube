'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<any> | null = null;
function loadApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { apiPromise = null; rej(new Error('api')); };
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
  onTick?: (t: number, d: number) => void;
  onEnded?: () => void;
  onRate?: (r: number) => void;
  onState?: (s: number) => void;
};

const HOSTS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
const ERR: Record<number, string> = {
  2: '動画IDが正しくありません', 5: 'この動画はHTML5プレーヤーで再生できません', 100: '動画が見つからないか非公開です',
  101: 'この動画は埋め込み再生が許可されていません', 150: 'この動画は埋め込み再生が許可されていません',
  152: 'プレーヤーの設定エラーです', 153: 'プレーヤーの設定エラーです（リファラー）',
};

function makeIframe(host: string, id: string, start: number, autoplay: boolean) {
  const f = document.createElement('iframe');
  const q = new URLSearchParams({
    enablejsapi: '1', autoplay: autoplay ? '1' : '0', start: String(Math.floor(start || 0)), rel: '0', playsinline: '1',
    iv_load_policy: '3', modestbranding: '1', hl: 'ja', cc_lang_pref: 'ja', origin: location.origin, widget_referrer: location.href,
  });
  f.src = `${host}/embed/${id}?${q}`;
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
  f.allowFullscreen = true;
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.title = 'YouTube video player';
  f.setAttribute('frameborder', '0');
  return f;
}

const Player = forwardRef<PlayerHandle, Props>(function Player(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const p = useRef<any>(null);
  const ready = useRef(false);
  const cbs = useRef(props);
  cbs.current = props;
  const currentId = useRef<string | null>(null);
  const hostIdx = useRef(0);
  const [err, setErr] = useState<{ code: number | string; msg: string } | null>(null);
  const [nonce, setNonce] = useState(0);

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

  // (re)create player; nonce changes on host fallback / retry, id changes recreate only when not ready
  useEffect(() => {
    let destroyed = false;
    let timer: any;
    let watchdog: any;
    const id = cbs.current.id;
    setErr(null);
    ready.current = false;
    const host = HOSTS[hostIdx.current % HOSTS.length];
    const iframe = makeIframe(host, id, cbs.current.start || 0, cbs.current.autoplay !== false);
    box.current?.replaceChildren(iframe);
    currentId.current = id;

    const fail = (code: number | string) => {
      if (destroyed) return;
      if (hostIdx.current < HOSTS.length - 1) { hostIdx.current++; setNonce((n) => n + 1); return; }
      setErr({ code, msg: ERR[Number(code)] || '再生できませんでした' });
    };

    loadApi().then((YT) => {
      if (destroyed) return;
      p.current = new YT.Player(iframe, {
        events: {
          onReady: (e: any) => {
            ready.current = true;
            clearTimeout(watchdog);
            if (cbs.current.rate && cbs.current.rate !== 1) e.target.setPlaybackRate(cbs.current.rate);
            if (cbs.current.quality && cbs.current.quality !== 'default') e.target.setPlaybackQuality(cbs.current.quality);
            // the video may have changed while the player was booting
            if (currentId.current !== cbs.current.id) {
              currentId.current = cbs.current.id;
              e.target.loadVideoById({ videoId: cbs.current.id, startSeconds: Math.floor(cbs.current.start || 0) });
            }
          },
          onStateChange: (e: any) => {
            cbs.current.onState?.(e.data);
            if (e.data === 1) setErr(null);
            if (e.data === 0) cbs.current.onEnded?.();
          },
          onPlaybackRateChange: (e: any) => cbs.current.onRate?.(e.data),
          onError: (e: any) => {
            const c = Number(e.data);
            if (c === 101 || c === 150 || c === 100 || c === 2) setErr({ code: c, msg: ERR[c] || '再生できませんでした' });
            else fail(c);
          },
        },
      });
      watchdog = setTimeout(() => { if (!ready.current) fail('timeout'); }, 15000);
      timer = setInterval(() => {
        const pl = p.current;
        if (!ready.current || !pl?.getCurrentTime) return;
        cbs.current.onTick?.(pl.getCurrentTime(), pl.getDuration());
      }, 500);
    }).catch(() => {
      // API script blocked: plain iframe still plays, just without extra controls
    });
    return () => {
      destroyed = true;
      clearInterval(timer);
      clearTimeout(watchdog);
      try { p.current?.destroy?.(); } catch {}
      p.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // change video
  useEffect(() => {
    if (currentId.current === props.id) return;
    if (!p.current || !ready.current) {
      // player not ready or failed: rebuild for the new id
      hostIdx.current = 0;
      setNonce((n) => n + 1);
      return;
    }
    setErr(null);
    currentId.current = props.id;
    p.current.loadVideoById({ videoId: props.id, startSeconds: Math.floor(props.start || 0) });
    if (cbs.current.rate && cbs.current.rate !== 1) setTimeout(() => p.current?.setPlaybackRate?.(cbs.current.rate), 600);
  }, [props.id, props.start]);

  return (
    <>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {err && (
        <div className="player-err">
          <span className="ms" style={{ fontSize: 48 }}>error</span>
          <b>{err.msg}</b>
          <span className="small" style={{ opacity: 0.7 }}>エラー {err.code}</span>
          <div className="row-flex" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn filled" onClick={() => { hostIdx.current = 0; setNonce((n) => n + 1); }}><span className="ms">refresh</span>再試行</button>
            <a className="btn surface" href={`https://www.youtube.com/watch?v=${props.id}`} target="_blank" rel="noopener noreferrer"><span className="ms">open_in_new</span>YouTubeで開く</a>
          </div>
        </div>
      )}
    </>
  );
});

export default Player;
