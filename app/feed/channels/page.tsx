'use client';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { SubButton } from '@/components/cards';
import { Avatar } from '@/components/ui';

export default function Channels() {
  const subs = useStore((s) => s.subs);
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="h1">すべての登録チャンネル</div>
      {subs.length === 0 && <div className="muted">まだ登録していません。</div>}
      <div className="list">
        {subs.map((s) => (
          <div key={s.id} className="row-flex" style={{ gap: 16 }}>
            <Link href={`/channel/${s.id}`} className="row-flex" style={{ gap: 16, flex: 1, minWidth: 0 }}><Avatar src={s.avatar} name={s.name} className="lg" /><b>{s.name}</b></Link>
            <SubButton id={s.id} name={s.name} avatar={s.avatar} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
