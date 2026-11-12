'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { chat, parseJson } from '@/lib/ai';
import { useStore } from '@/lib/store';
import { VideoRow, ShortCard } from '@/components/cards';
import { Icon, Loader } from '@/components/ui';
import type { VideoItem } from '@/lib/types';

type Plan = { queries: string[]; type?: string; sort?: string; upload_date?: string; duration?: string; intent?: string };
type Ranked = VideoItem & { reason?: string };

const PLAN_PROMPT = `あなたはYouTube検索の専門家です。ユーザーの曖昧な要望を、YouTube検索で最も良い結果が出る具体的な検索クエリに変換します。
必ず次のJSONだけを返してください:
{"intent":"要望の解釈を1文で","queries":["検索語1","検索語2","検索語3"],"type":"all|video|shorts|channel|playlist","sort":"relevance|upload_date|view_count|rating","upload_date":"all|hour|today|week|month|year","duration":"all|short|medium|long"}
- queries は2〜4個。日本語の要望なら日本語中心、必要なら英語も混ぜる。
- 「最近」「最新」→ upload_date を week か month、「人気」→ sort を view_count、「長い」→ duration long（20分超）、「短い」→ short（4分未満）。
- 指定がなければ all / relevance。`;

const RANK_PROMPT = `あなたはYouTube動画のキュレーターです。ユーザーの要望に最も合う順に動画を並べ替え、合わないものは除外してください。
必ず次のJSONだけを返してください: {"results":[{"i":番号,"why":"選んだ理由を20〜40字の日本語で"}]}
最大15件。タイトル・チャンネル・再生数・公開時期・長さから判断すること。`;

function Advanced() {
  const sp = useSearchParams();
  const router = useRouter();
  const key = useStore((s) => s.settings.aiKey);
  const [q, setQ] = useState(sp.get('q') || '');
  const [stage, setStage] = useState<'idle' | 'plan' | 'search' | 'rank' | 'done' | 'error'>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [results, setResults] = useState<Ranked[]>([]);
  const [err, setErr] = useState('');
  const run = useRef(0);

  const go = async (text: string) => {
    if (!text.trim()) return;
    const my = ++run.current;
    setErr(''); setResults([]); setPlan(null); setStage('plan');
    try {
      const pt = await chat([{ role: 'system', content: PLAN_PROMPT }, { role: 'user', content: text }], { json: true, temperature: 0.2 });
      const pl = parseJson<Plan>(pt);
      if (!pl?.queries?.length) throw new Error('検索プランを作れませんでした');
      if (my !== run.current) return;
      setPlan(pl); setStage('search');
      const lists = await Promise.allSettled(pl.queries.slice(0, 4).map((query) => api({ fn: 'search', q: query, type: pl.type || 'all', sort: pl.sort || 'relevance', date: pl.upload_date || 'all', dur: pl.duration || 'all' })));
      const pool: VideoItem[] = [];
      const seen = new Set<string>();
      const arrs = lists.map((l) => (l.status === 'fulfilled' ? l.value.items : []) as VideoItem[]);
      for (let i = 0; i < 20; i++) for (const a of arrs) { const v = a[i]; if (v && !seen.has(v.kind + v.id) && (v.kind === 'video' || v.kind === 'short' || pl.type === 'channel' || pl.type === 'playlist')) { seen.add(v.kind + v.id); pool.push(v); } }
      if (my !== run.current) return;
      if (!pool.length) throw new Error('該当する動画が見つかりませんでした');
      setResults(pool.slice(0, 20)); setStage('rank');
      const cand = pool.slice(0, 40);
      const listText = cand.map((v, i) => `${i}. ${v.title} | ${v.author || ''} | ${v.views || ''} | ${v.published || ''} | ${v.duration || v.kind}`).join('\n');
      const rt = await chat([{ role: 'system', content: RANK_PROMPT }, { role: 'user', content: `要望: ${text}\n\n候補:\n${listText}` }], { json: true, temperature: 0.2 });
      const rj = parseJson<{ results: { i: number; why: string }[] }>(rt);
      if (my !== run.current) return;
      const ranked = (rj?.results || []).map((r) => cand[r.i] && { ...cand[r.i], reason: r.why }).filter(Boolean) as Ranked[];
      setResults(ranked.length ? ranked : pool.slice(0, 20));
      setStage('done');
    } catch (e: any) {
      if (my !== run.current) return;
      setErr(String(e.message || e)); setStage('error');
    }
  };

  useEffect(() => { const q0 = sp.get('q'); if (q0 && key) go(q0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);

  const submit = () => { router.replace(`/advanced?q=${encodeURIComponent(q)}`); go(q); };
  const busy = stage === 'plan' || stage === 'search' || stage === 'rank';
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="h1 row-flex"><span className="icon-btn sparkle" style={{ borderRadius: 14 }}><Icon n="auto_awesome" fill /></span>Advanced Search</div>
      <div className="muted" style={{ marginBottom: 16 }}>探したい内容を文章で伝えると、AI が検索語・期間・長さを組み立て、結果を要望に合う順に並べ替えます。</div>
      {!key && (
        <div className="ai-card"><div className="hd"><Icon n="key" />API キーが必要です</div><div style={{ margin: '8px 0 12px' }}>設定で OpenRouter または Groq の API キーを登録してください。</div><Link className="btn filled" href="/settings#ai">設定を開く</Link></div>
      )}
      <div className="ai-input" style={{ background: 'var(--md-surface-container-high)', marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="例: 初心者向けで20分以内のPython入門、最近のもの" />
        <button className="btn filled" disabled={busy || !key} onClick={submit}><Icon n="auto_awesome" />検索</button>
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        {['寝る前に聴けるピアノ、1時間以上', '今週話題になったゲーム実況', '10分以内でわかる最新ニュース解説', '料理初心者向けの簡単な時短レシピ'].map((x) => (
          <button key={x} className="chip sl" onClick={() => { setQ(x); router.replace(`/advanced?q=${encodeURIComponent(x)}`); go(x); }}>{x}</button>
        ))}
      </div>
      {plan && (
        <div className="ai-card">
          <div className="hd"><Icon n="psychology" />{plan.intent || '検索プラン'}</div>
          <div className="chips" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {plan.queries.map((x) => <Link key={x} href={`/results?search_query=${encodeURIComponent(x)}`} className="chip"><Icon n="search" size={16} />{x}</Link>)}
            {plan.upload_date && plan.upload_date !== 'all' && <span className="chip"><Icon n="calendar_month" size={16} />{({ hour: '1時間以内', today: '今日', week: '今週', month: '今月', year: '今年' } as any)[plan.upload_date] || plan.upload_date}</span>}
            {plan.duration && plan.duration !== 'all' && <span className="chip"><Icon n="timer" size={16} />{({ short: '4分未満', medium: '4〜20分', long: '20分以上' } as any)[plan.duration] || plan.duration}</span>}
            {plan.sort && plan.sort !== 'relevance' && <span className="chip"><Icon n="sort" size={16} />{({ upload_date: '新しい順', view_count: '再生回数順', rating: '評価順' } as any)[plan.sort] || plan.sort}</span>}
          </div>
        </div>
      )}
      {busy && <div className="row-flex muted" style={{ justifyContent: 'center' }}><Loader small />{stage === 'plan' ? '要望を解析中…' : stage === 'search' ? '検索中…' : 'AI が並べ替え中…'}</div>}
      {err && <div className="empty"><div className="big"><Icon n="error" /></div>{err}</div>}
      <div className="list" style={{ marginTop: 8, opacity: stage === 'rank' ? 0.6 : 1 }}>
        {results.map((v) => v.kind === 'short' ? (
          <div key={v.id} className="row-flex" style={{ alignItems: 'flex-start' }}><div style={{ width: 160 }}><ShortCard v={v} /></div>{v.reason && <div className="ai-reason"><Icon n="auto_awesome" />{v.reason}</div>}</div>
        ) : (
          <div key={v.kind + v.id}><VideoRow v={v} />{v.reason && <div className="ai-reason" style={{ maxWidth: 720 }}><Icon n="auto_awesome" />{v.reason}</div>}</div>
        ))}
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Advanced /></Suspense>; }
