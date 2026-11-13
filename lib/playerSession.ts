'use client';
import { useSyncExternalStore } from 'react';
import type { PlayerHandle } from '@/components/Player';

/**
 * Mini player (experimental) session state.
 *
 * Deliberately kept OUT of the persisted store (localStorage `m3tube:v1`):
 * a playback session is per-tab and in-memory only, so a reload never
 * resurrects — let alone autoplays — a video. Only the on/off switch lives
 * in the persisted settings (`settings.miniPlayerEnabled`).
 *
 * The actual <Player> (YouTube iframe) is mounted once by GlobalPlayer in
 * the Shell and never unmounted / re-created / DOM-moved while a session is
 * active; that is what keeps playback continuous across route changes.
 */

export type WatchCallbacks = {
  onTick?: (t: number, d: number) => void;
  onEnded?: () => void;
  onRate?: (r: number) => void;
};

export type PlayerSession = {
  active: boolean;
  videoId: string | null;
  title: string;
  playing: boolean;
  startAt: number;
  slotPresent: boolean;
};

const initial: PlayerSession = { active: false, videoId: null, title: '', playing: false, startAt: 0, slotPresent: false };
let session: PlayerSession = initial;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function set(p: Partial<PlayerSession>) { session = { ...session, ...p }; emit(); }

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function usePlayerSession(): PlayerSession {
  return useSyncExternalStore(subscribe, () => session, () => initial);
}
export function getPlayerSession() { return session; }

/** Imperative handle of the one resident player (set by GlobalPlayer). */
export const playerHandleRef: { current: PlayerHandle | null } = { current: null };

// ---- watch page callback handoff ----
// While the watch page is mounted it registers its own callbacks (SponsorBlock
// skip, A-B repeat, queue/autoplay onEnded, ...). GlobalPlayer delegates to
// them; when no page is mounted (mini mode) it falls back to host defaults.
let watchCbs: WatchCallbacks | null = null;
export function registerWatchCallbacks(cb: WatchCallbacks) { watchCbs = cb; }
export function unregisterWatchCallbacks() { watchCbs = null; }
export function getWatchCallbacks() { return watchCbs; }

// ---- watch page player slot ----
// The watch page renders an empty placeholder with the .player box geometry;
// GlobalPlayer positions the resident player exactly over it.
let slotEl: HTMLElement | null = null;
export function setWatchSlot(el: HTMLElement | null) {
  slotEl = el;
  const present = !!el;
  if (session.slotPresent !== present) set({ slotPresent: present });
}
export function getWatchSlot() { return slotEl; }

// ---- actions ----
/** Called by the watch page when it opens a video. */
export function openWatch(id: string, start: number) {
  if (session.active && session.videoId === id) return; // already loaded: keep playing untouched
  set({ active: true, videoId: id, startAt: start, title: session.videoId === id ? session.title : '', playing: false });
}
/** Load a different video into the resident player (queue advance in mini mode). */
export function loadSessionVideo(id: string, title: string, start = 0) {
  set({ active: true, videoId: id, title, startAt: start });
}
export function setSessionTitle(title: string) { if (title && title !== session.title) set({ title }); }
export function setSessionPlaying(b: boolean) { if (session.playing !== b) set({ playing: b }); }
/** Close the mini player: the resident player unmounts and playback stops. */
export function closeSession() { set({ active: false, videoId: null, title: '', playing: false, startAt: 0 }); }
