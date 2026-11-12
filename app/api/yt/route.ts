import { NextRequest, NextResponse } from 'next/server';
import * as Y from '@/lib/yt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HOME_CHIPS: Record<string, string[]> = {
  all: ['人気 動画', '話題', 'ゲーム実況', 'ミュージックビデオ'],
  music: ['ミュージックビデオ 新曲', 'J-POP'],
  game: ['ゲーム実況', 'マインクラフト'],
  live: ['ライブ配信'],
  news: ['ニュース 最新'],
  anime: ['アニメ 公式 PV'],
  sports: ['スポーツ ハイライト'],
  cooking: ['料理 レシピ'],
  vlog: ['Vlog'],
  tech: ['ガジェット レビュー'],
  comedy: ['お笑い コント'],
  animals: ['猫 犬 動物'],
};

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fn = p.get('fn');
  const cont = p.get('cont') || undefined;
  try {
    let data: any;
    let maxAge = 300;
    switch (fn) {
      case 'search':
        data = await Y.search(p.get('q') || '', p.get('type') || 'all', p.get('sort') || 'relevance', cont, p.get('date') || undefined, p.get('dur') || undefined);
        break;
      case 'suggest':
        data = await Y.suggest(p.get('q') || '');
        maxAge = 3600;
        break;
      case 'home': {
        if (cont) { data = await Y.search('', 'all', '', cont).catch(() => ({ items: [] })); break; }
        const chip = p.get('chip') || 'all';
        const qs = HOME_CHIPS[chip] || [chip];
        const live = chip === 'live';
        const results = await Promise.allSettled(qs.map((q, i) => Y.search(q, i === 0 && !live ? 'all' : 'video', 'relevance', undefined)));
        const items: Y.VideoItem[] = [];
        const shorts: Y.VideoItem[] = [];
        const seen = new Set<string>();
        let continuation: string | undefined;
        const lists = results.map((r) => (r.status === 'fulfilled' ? r.value : { items: [], continuation: undefined }));
        const max = Math.max(...lists.map((l) => l.items.length));
        for (let i = 0; i < max; i++) for (const l of lists) {
          const it = l.items[i];
          if (!it || seen.has(it.id)) continue;
          seen.add(it.id);
          if (it.kind === 'video') items.push(it);
          else if (it.kind === 'short') shorts.push(it);
        }
        continuation = lists.find((l) => l.continuation)?.continuation;
        data = { items, shorts, continuation, chips: Object.keys(HOME_CHIPS) };
        maxAge = 900;
        break;
      }
      case 'video':
        data = await Y.video(p.get('id')!);
        break;
      case 'askctx': {
        const id = p.get('id')!;
        const [v, c] = await Promise.allSettled([Y.video(id), Y.comments(id, 'TOP_COMMENTS')]);
        const vd: any = v.status === 'fulfilled' ? v.value : null;
        let comments: any[] = c.status === 'fulfilled' ? c.value.items : [];
        if (c.status === 'fulfilled' && c.value.continuation) {
          try { comments = comments.concat((await Y.comments(id, 'TOP_COMMENTS', c.value.continuation)).items); } catch {}
        }
        data = vd ? {
          title: vd.title, channel: vd.channel?.name, views: vd.views, date: vd.date, likes: vd.likes, duration: vd.duration,
          description: vd.description, chapters: vd.chapters.map((x: any) => ({ t: x.start, title: x.title })),
          comments: comments.slice(0, 40).map((x: any) => ({ a: x.author, l: x.likes, t: x.text.slice(0, 400) })),
        } : { error: 'video' };
        maxAge = 1800;
        break;
      }
      case 'next':
        data = await Y.next(cont!);
        break;
      case 'comments':
        data = await Y.comments(p.get('id') || '', (p.get('sort') as any) || 'TOP_COMMENTS', cont);
        maxAge = 120;
        break;
      case 'channel':
        data = await Y.channel(p.get('id')!, p.get('tab') || 'home', cont);
        break;
      case 'playlist':
        data = await Y.playlist(p.get('id')!, cont);
        break;
      default:
        return NextResponse.json({ error: 'unknown fn' }, { status: 400 });
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}` } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
