'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const cache = new Map<string, any>();
export async function api<T = any>(params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]).toString();
  if (cache.has(qs)) return cache.get(qs);
  const r = await fetch('/api/yt?' + qs);
  const j = await r.json();
  if (!r.ok || j?.error) throw new Error(j?.error || 'error');
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  cache.set(qs, j);
  return j;
}

export function useApi<T = any>(params: Record<string, string | undefined> | null) {
  const key = params ? JSON.stringify(params) : '';
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!params });
  useEffect(() => {
    if (!params) return;
    let alive = true;
    setState({ loading: true });
    api<T>(params).then((d) => alive && setState({ data: d, loading: false })).catch((e) => alive && setState({ error: String(e.message || e), loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Infinite list with continuation tokens. */
export function usePaged<T = any>(params: Record<string, string | undefined> | null, contParams: (cont: string) => Record<string, string>) {
  const key = params ? JSON.stringify(params) : '';
  const [items, setItems] = useState<T[]>([]);
  const [extra, setExtra] = useState<any>(null);
  const [cont, setCont] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const busy = useRef(false);
  const gen = useRef(0);
  useEffect(() => {
    if (!params) return;
    const g = ++gen.current;
    setItems([]); setCont(undefined); setError(undefined); setExtra(null); setLoading(true);
    busy.current = true;
    api(params).then((d: any) => {
      if (g !== gen.current) return;
      setItems(d.items || []); setCont(d.continuation); setExtra(d);
    }).catch((e) => g === gen.current && setError(String(e.message))).finally(() => { if (g === gen.current) { setLoading(false); busy.current = false; } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const more = useCallback(() => {
    if (!cont || busy.current) return;
    busy.current = true; setLoading(true);
    const g = gen.current;
    api(contParams(cont)).then((d: any) => {
      if (g !== gen.current) return;
      setItems((p: any[]) => {
        const ids = new Set(p.map((x: any) => x.kind + x.id));
        return [...p, ...(d.items || []).filter((x: any) => !ids.has(x.kind + x.id))];
      });
      setCont(d.continuation && d.continuation !== cont ? d.continuation : undefined);
    }).catch(() => setCont(undefined)).finally(() => { if (g === gen.current) { setLoading(false); busy.current = false; } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cont]);
  return { items, extra, more, hasMore: !!cont, loading, error, setItems };
}

export function fmtNum(n?: number | null) {
  if (n == null || isNaN(n)) return '';
  if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '億';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '万';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + '千';
  return String(n);
}
export function fmtTime(sec: number) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
export function relAgo(t: number) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'たった今';
  if (d < 3600) return Math.floor(d / 60) + '分前';
  if (d < 86400) return Math.floor(d / 3600) + '時間前';
  return Math.floor(d / 86400) + '日前';
}
/** Japanese/English relative date → seconds ago (for sorting). */
export function agoSeconds(s?: string) {
  if (!s) return 1e12;
  const m = s.match(/(\d+)\s*(秒|分|時間|日|週間|か月|ヶ月|年|second|minute|hour|day|week|month|year)/);
  if (!m) return 1e11;
  const n = Number(m[1]);
  const u: Record<string, number> = { 秒: 1, 分: 60, 時間: 3600, 日: 86400, 週間: 604800, か月: 2592000, ヶ月: 2592000, 年: 31536000, second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 };
  return n * (u[m[2]] || 1);
}
