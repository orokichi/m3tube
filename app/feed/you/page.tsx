'use client';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { VideoCard } from '@/components/cards';
import { Avatar, Icon } from '@/components/ui';

function Row({ title, href, icon, items }: { title: string; href: string; icon: string; items: any[] }) {
  return (
    <section className="shelf">
      <div className="shelf-h"><Icon n={icon} fill />{title}<span className="muted small">{items.length}</span><span className="spacer" /><Link href={href} className="btn sm outlined">すべて表示</Link></div>
      {items.length ? <div className="lib-row">{items.slice(0, 12).map((v) => <VideoCard key={v.id} v={{ ...v, avatar: undefined, authorId: undefined }} />)}</div> : <div className="muted">まだありません</div>}
    </section>
  );
}

export default function You() {
  const s = useStore((x) => x);
  return (
    <div className="page">
      <div className="chead" style={{ marginTop: 8 }}>
        <div className="avatar xl ph" style={{ width: 96, height: 96, fontSize: 36 }}><Icon n="person" size={48} /></div>
        <div><h1 style={{ fontSize: 30 }}>マイページ</h1><div className="muted">データはこのブラウザ内に保存されます（アカウント不要）</div>
          <div className="row-flex" style={{ marginTop: 12, flexWrap: 'wrap' }}><Link href="/settings" className="btn tonal"><Icon n="settings" />設定</Link><Link href="/feed/channels" className="btn surface"><Icon n="subscriptions" />登録チャンネル {s.subs.length}</Link></div>
        </div>
      </div>
      <Row title="履歴" href="/feed/history" icon="history" items={s.history} />
      <Row title="後で見る" href="/playlist?list=WL" icon="schedule" items={s.wl} />
      <Row title="高く評価した動画" href="/playlist?list=LL" icon="thumb_up" items={s.liked} />
      {s.subs.length > 0 && (
        <section className="shelf">
          <div className="shelf-h"><Icon n="subscriptions" fill />登録チャンネル</div>
          <div className="sub-grid">{s.subs.map((c) => <Link key={c.id} href={`/channel/${c.id}`}>{c.avatar ? <img src={c.avatar} alt="" referrerPolicy="no-referrer" /> : <Avatar name={c.name} className="ph" />}{c.name}</Link>)}</div>
        </section>
      )}
    </div>
  );
}
