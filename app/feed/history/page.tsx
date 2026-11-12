'use client';
import { useMemo, useState } from 'react';
import { actions, useStore } from '@/lib/store';
import { VideoRow } from '@/components/cards';
import { Icon, Switch, useSnack } from '@/components/ui';

function dayLabel(t: number) {
  const d = new Date(t); const now = new Date();
  const diff = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return '今日';
  if (diff === 1) return '昨日';
  if (diff < 7) return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + '曜日';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function History() {
  const hist = useStore((s) => s.history);
  const searches = useStore((s) => s.searches);
  const paused = useStore((s) => s.settings.pauseHistory);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'watch' | 'search'>('watch');
  const snack = useSnack();
  const groups = useMemo(() => {
    const g: Record<string, typeof hist> = {};
    hist.filter((h) => !q || (h.title + (h.author || '')).toLowerCase().includes(q.toLowerCase())).forEach((h) => { (g[dayLabel(h.at)] ||= []).push(h); });
    return Object.entries(g);
  }, [hist, q]);
  return (
    <div className="page" style={{ maxWidth: 1280, display: 'flex', gap: 32, flexWrap: 'wrap-reverse' }}>
      <div style={{ flex: '1 1 600px', minWidth: 0 }}>
        <div className="h1">再生履歴</div>
        <div className="tabs" style={{ position: 'static' }}>
          <button className={tab === 'watch' ? 'on' : ''} onClick={() => setTab('watch')}>再生履歴</button>
          <button className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>検索履歴</button>
        </div>
        {tab === 'watch' ? (
          <>
            {groups.length === 0 && <div className="empty"><div className="big"><Icon n="history" /></div>履歴はありません</div>}
            {groups.map(([day, list]) => (
              <section key={day}>
                <div className="h2">{day}</div>
                <div className="list">
                  {list.map((v) => (
                    <div key={v.id} style={{ position: 'relative' }}>
                      <VideoRow v={v} />
                      <button className="icon-btn sl" style={{ position: 'absolute', right: 0, top: 40 }} aria-label="削除" onClick={() => actions.removeHistory(v.id)}><Icon n="close" /></button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <div className="card">
            {searches.length === 0 && <div className="setting muted">検索履歴はありません</div>}
            {searches.map((s) => (
              <div key={s} className="setting"><Icon n="search" /><a className="txt" href={`/results?search_query=${encodeURIComponent(s)}`}>{s}</a><button className="icon-btn sl" onClick={() => actions.removeSearch(s)}><Icon n="close" /></button></div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: '0 0 300px', paddingTop: 70 }}>
        <div className="search" style={{ height: 44 }}><input placeholder="再生履歴を検索" value={q} onChange={(e) => setQ(e.target.value)} /><span className="icon-btn"><Icon n="search" /></span></div>
        <div className="card" style={{ marginTop: 16 }}>
          <button className="setting sl" style={{ width: '100%' }} onClick={() => { if (confirm('すべての再生履歴を削除しますか？')) { actions.clearHistory(); snack({ msg: '再生履歴を削除しました' }); } }}><Icon n="delete" /><span className="txt" style={{ textAlign: 'left' }}>すべての再生履歴を削除</span></button>
          <div className="setting"><Icon n="pause_circle" /><span className="txt">履歴を一時停止</span><Switch on={paused} onChange={(v) => actions.setSettings({ pauseHistory: v })} /></div>
        </div>
      </div>
    </div>
  );
}
