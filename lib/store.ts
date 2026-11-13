'use client';
import { useSyncExternalStore } from 'react';
import type { VideoItem } from './types';

export type Sub = { id: string; name: string; avatar?: string };
export type HistItem = VideoItem & { at: number; pos?: number; len?: number };
export type Settings = {
  theme: 'system' | 'light' | 'dark';
  seed: string;
  betaUi: boolean;
  queueEnabled: boolean;
  autoplay: boolean;
  speed: number;
  sponsorblock: boolean;
  dislikes: boolean;
  pauseHistory: boolean;
  resume: boolean;
  quality: string;
  aiProvider: 'openrouter' | 'groq';
  aiKey: string;
  aiModel: string;
};
type State = {
  subs: Sub[];
  history: HistItem[];
  wl: VideoItem[];
  liked: VideoItem[];
  disliked: string[];
  searches: string[];
  queue: VideoItem[];
  queueCurrentId: string | null;
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  seed: '#c4002b',
  betaUi: false,
  queueEnabled: false,
  autoplay: true,
  speed: 1,
  sponsorblock: true,
  dislikes: true,
  pauseHistory: false,
  resume: true,
  quality: 'default',
  aiProvider: 'openrouter',
  aiKey: '',
  aiModel: '',
};
const KEY = 'm3tube:v1';
const empty: State = { subs: [], history: [], wl: [], liked: [], disliked: [], searches: [], queue: [], queueCurrentId: null, settings: DEFAULT_SETTINGS };

let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state = { ...empty, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) } };
    }
  } catch {}
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        const p = JSON.parse(e.newValue);
        state = { ...empty, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) } };
        listeners.forEach((l) => l());
      } catch {}
    }
  });
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach((l) => l());
}

export function setState(fn: (s: State) => Partial<State>) {
  load();
  state = { ...state, ...fn(state) };
  save();
}

export function getState() { load(); return state; }

function subscribe(l: () => void) { load(); listeners.add(l); return () => listeners.delete(l); }

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(getState()), () => sel(empty));
}

// ---- actions ----
const slim = (v: VideoItem): VideoItem => ({ kind: v.kind, id: v.id, title: v.title, thumb: v.thumb, duration: v.duration, views: v.views, published: v.published, author: v.author, authorId: v.authorId, avatar: v.avatar });

export const actions = {
  toggleSub(sub: Sub) {
    setState((s) => ({ subs: s.subs.some((x) => x.id === sub.id) ? s.subs.filter((x) => x.id !== sub.id) : [sub, ...s.subs] }));
  },
  addHistory(v: VideoItem) {
    setState((s) => {
      if (s.settings.pauseHistory) return {};
      const prev = s.history.find((h) => h.id === v.id);
      return { history: [{ ...slim(v), at: Date.now(), pos: prev?.pos, len: prev?.len }, ...s.history.filter((h) => h.id !== v.id)].slice(0, 500) };
    });
  },
  setPos(id: string, pos: number, len: number) {
    const s = getState();
    const i = s.history.findIndex((h) => h.id === id);
    if (i < 0) return;
    const h = [...s.history];
    h[i] = { ...h[i], pos, len };
    state = { ...s, history: h };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  },
  removeHistory(id: string) { setState((s) => ({ history: s.history.filter((h) => h.id !== id) })); },
  clearHistory() { setState(() => ({ history: [] })); },
  toggleWL(v: VideoItem) {
    setState((s) => ({ wl: s.wl.some((x) => x.id === v.id) ? s.wl.filter((x) => x.id !== v.id) : [slim(v), ...s.wl] }));
  },
  // ---- play queue (experimental) ----
  toggleQueue(v: VideoItem) {
    setState((s) => ({ queue: s.queue.some((x) => x.id === v.id) ? s.queue.filter((x) => x.id !== v.id) : [...s.queue, slim(v)] }));
  },
  removeFromQueue(id: string) { setState((s) => ({ queue: s.queue.filter((x) => x.id !== id) })); },
  clearQueue() { setState(() => ({ queue: [], queueCurrentId: null })); },
  moveInQueue(id: string, dir: -1 | 1) {
    setState((s) => {
      const i = s.queue.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.queue.length) return {};
      const q = [...s.queue];
      [q[i], q[j]] = [q[j], q[i]];
      return { queue: q };
    });
  },
  setQueueCurrent(id: string | null) {
    if (getState().queueCurrentId === id) return;
    setState(() => ({ queueCurrentId: id }));
  },
  toggleLike(v: VideoItem) {
    setState((s) => ({
      liked: s.liked.some((x) => x.id === v.id) ? s.liked.filter((x) => x.id !== v.id) : [slim(v), ...s.liked],
      disliked: s.disliked.filter((x) => x !== v.id),
    }));
  },
  toggleDislike(id: string) {
    setState((s) => ({ disliked: s.disliked.includes(id) ? s.disliked.filter((x) => x !== id) : [...s.disliked, id], liked: s.liked.filter((x) => x.id !== id) }));
  },
  addSearch(q: string) {
    setState((s) => (s.settings.pauseHistory ? {} : { searches: [q, ...s.searches.filter((x) => x !== q)].slice(0, 30) }));
  },
  removeSearch(q: string) { setState((s) => ({ searches: s.searches.filter((x) => x !== q) })); },
  setSettings(p: Partial<Settings>) { setState((s) => ({ settings: { ...s.settings, ...p } })); },
  exportData() { const s = getState(); return JSON.stringify({ ...s, settings: { ...s.settings, aiKey: '' } }, null, 2); },
  importData(json: string) {
    const p = JSON.parse(json);
    setState(() => ({ ...empty, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) } }));
  },
};

/**
 * Play queue: given the video that just ended, return the next video to play
 * and advance the queue position (queueCurrentId). Returns null when there is
 * nothing queued after the current position. If the ended video is not in the
 * queue, playback continues from the head of the queue.
 */
export function queueAdvance(currentId: string): VideoItem | null {
  const s = getState();
  const q = s.queue;
  if (!q.length) return null;
  const i = q.findIndex((x) => x.id === currentId);
  const next = i >= 0 ? q[i + 1] || null : q[0];
  if (next) setState(() => ({ queueCurrentId: next.id }));
  return next;
}
