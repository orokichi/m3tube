'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Icon } from './ui';
import QueueList, { QueueHeader } from './QueueList';

/**
 * Floating queue entry point shown on non-watch pages (home, channel,
 * search, ...) while the experimental play queue is enabled and non-empty.
 * The watch page has its own side panel instead, so the bar hides there.
 */
export default function QueueBar() {
  const enabled = useStore((s) => s.settings.queueEnabled);
  const queue = useStore((s) => s.queue);
  const currentId = useStore((s) => s.queueCurrentId);
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  if (!enabled || !queue.length) return null;
  if (path === '/watch' || path.startsWith('/shorts')) return null;

  const ci = queue.findIndex((x) => x.id === currentId);
  const upcoming = ci >= 0 ? queue[ci + 1] : queue[0];
  const next = upcoming || queue[ci] || queue[0];

  return (
    <div className="queue-bar">
      {open && (
        <div className="queue-sheet">
          <QueueHeader count={queue.length} />
          <div className="queue-scroll"><QueueList currentId={currentId} onNavigate={() => setOpen(false)} /></div>
        </div>
      )}
      <button className="queue-pill" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon n="queue_play_next" />
        <span className="qp-thumb">{next.thumb && <img src={next.thumb} alt="" referrerPolicy="no-referrer" />}</span>
        <span className="qp-txt">
          <span className="qp-label">再生キュー ・ {queue.length}件{ci >= 0 ? ` ・ ${ci + 1}件目を再生中` : ''}</span>
          <span className="qp-title">{upcoming ? `次: ${next.title}` : `再生中: ${next.title}`}</span>
        </span>
        <Icon n={open ? 'expand_more' : 'expand_less'} />
      </button>
    </div>
  );
}
