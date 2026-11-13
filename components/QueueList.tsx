'use client';
import { useRouter } from 'next/navigation';
import { actions, useStore } from '@/lib/store';
import { Icon } from './ui';

/**
 * Shared queue list body used by the watch-page side panel and the
 * floating queue bar on other pages. `currentId` marks the video that is
 * (or was last) playing so its position in the queue is highlighted.
 */
export default function QueueList({ currentId, onNavigate }: { currentId?: string | null; onNavigate?: () => void }) {
  const queue = useStore((s) => s.queue);
  const router = useRouter();
  if (!queue.length) {
    return <div className="muted small" style={{ padding: '8px 4px' }}>キューは空です。動画カードのメニュー（︙）から「キューに追加」できます。</div>;
  }
  const play = (id: string) => { onNavigate?.(); router.push(`/watch?v=${id}`); };
  return (
    <div className="qlist">
      {queue.map((v, i) => {
        const cur = v.id === currentId;
        return (
          <div key={v.id} className={`qrow ${cur ? 'on' : ''}`}>
            <button className="qmain" onClick={() => play(v.id)} title={v.title}>
              <span className="qthumb">{v.thumb && <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />}{v.duration && <span className="badge">{v.duration}</span>}</span>
              <span className="qtxt">
                <span className="qtitle">{v.title}</span>
                <span className="qsub">{cur ? '再生中' : v.author || ''}</span>
              </span>
            </button>
            <span className="qops">
              <button className="icon-btn sl" aria-label="上へ移動" disabled={i === 0} onClick={() => actions.moveInQueue(v.id, -1)}><Icon n="arrow_upward" size={18} /></button>
              <button className="icon-btn sl" aria-label="下へ移動" disabled={i === queue.length - 1} onClick={() => actions.moveInQueue(v.id, 1)}><Icon n="arrow_downward" size={18} /></button>
              <button className="icon-btn sl" aria-label="キューから削除" onClick={() => actions.removeFromQueue(v.id)}><Icon n="close" size={18} /></button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function QueueHeader({ count }: { count: number }) {
  return (
    <div className="row-flex" style={{ marginBottom: 8 }}>
      <Icon n="queue_play_next" /><b>再生キュー</b>
      <span className="muted small">{count} 件</span>
      <span className="spacer" />
      {count > 0 && <button className="btn sm text" onClick={() => actions.clearQueue()}><Icon n="delete_sweep" size={18} />すべて削除</button>}
    </div>
  );
}
