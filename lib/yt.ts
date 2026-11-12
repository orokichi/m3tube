import 'server-only';
import { Innertube } from 'youtubei.js';

let ytPromise: Promise<Innertube> | null = null;
let createdAt = 0;
export async function yt(): Promise<Innertube> {
  if (!ytPromise || Date.now() - createdAt > 1000 * 60 * 30) {
    createdAt = Date.now();
    ytPromise = Innertube.create({ retrieve_player: false, lang: 'ja', location: 'JP', generate_session_locally: true }).catch((e) => {
      ytPromise = null;
      throw e;
    });
  }
  return ytPromise;
}

export type { VideoItem } from "./types";
import type { VideoItem } from "./types";
type _Old = {
  kind: 'video' | 'short' | 'channel' | 'playlist';
  id: string;
  title: string;
  thumb?: string;
  duration?: string;
  views?: string;
  published?: string;
  author?: string;
  authorId?: string;
  avatar?: string;
  live?: boolean;
  subs?: string;
  count?: string;
  desc?: string;
};

const s = (x: any): string | undefined => {
  if (x == null) return undefined;
  if (typeof x === 'string') return x;
  if (typeof x.toString === 'function') {
    const t = x.toString();
    if (t && t !== '[object Object]' && t !== 'N/A') return t;
  }
  if (x.text) return x.text;
  return undefined;
};
const best = (arr: any): string | undefined => {
  if (!arr) return undefined;
  const a = Array.isArray(arr) ? arr : arr.image || arr.thumbnails || arr.sources || [];
  if (!Array.isArray(a) || !a.length) return undefined;
  let u = a[0]?.url;
  if (u && u.startsWith('//')) u = 'https:' + u;
  return u;
};

function fromLockup(n: any): VideoItem | null {
  const ct = n.content_type;
  const id = n.content_id;
  if (!id) return null;
  const meta = n.metadata;
  const title = s(meta?.title) || '';
  const rows = meta?.metadata?.metadata_rows || [];
  const parts = rows.map((r: any) => (r.metadata_parts || []).map((p: any) => s(p.text)).filter(Boolean));
  let duration: string | undefined;
  let live = false;
  for (const o of n.content_image?.overlays || []) {
    for (const b of o.badges || []) {
      const t = s(b.text);
      if (t) {
        if (/LIVE|ライブ/i.test(t) || b.badge_style?.includes('LIVE')) live = true;
        else if (/\d+:\d+/.test(t)) duration = t;
      }
    }
    if (o.text && /\d+ ?本の動画|videos|動画/.test(s(o.text) || '')) duration = s(o.text);
  }
  const image = n.content_image?.image || n.content_image?.primary_thumbnail?.image || n.content_image?.thumbnail?.image;
  const avatar = best(meta?.image?.avatar?.image || meta?.image?.avatars?.[0]?.image);
  if (ct === 'PLAYLIST' || ct === 'ALBUM' || ct === 'PODCAST') {
    const thumbVm = n.content_image?.primary_thumbnail || n.content_image;
    const badge = (thumbVm?.overlays || []).flatMap((o: any) => o.badges || []).map((b: any) => s(b.text)).find(Boolean);
    return { kind: 'playlist', id, title, thumb: best(thumbVm?.image), count: badge, author: parts[0]?.[0] };
  }
  if (ct !== 'VIDEO') return null;
  const single = parts.length === 1 && parts[0].some((x: string) => /回視聴|前|views|ago|視聴中/.test(x));
  let author = single ? undefined : parts[0]?.[0];
  const authorId = meta?.image?.renderer_context?.command_context?.on_tap?.payload?.browseId ||
    n.metadata?.image?.on_tap?.payload?.browseId;
  const second = single ? parts[0] : parts[1] || [];
  return { kind: 'video', id, title, thumb: best(image) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration, views: second[0], published: second[1], author, authorId, avatar, live };
}

export function normalize(n: any): VideoItem | null {
  if (!n || !n.type) return null;
  try {
    switch (n.type) {
      case 'Video':
      case 'CompactVideo':
      case 'GridVideo':
      case 'PlaylistVideo':
      case 'PlaylistPanelVideo': {
        const id = n.video_id || n.id;
        if (!id) return null;
        const badges = (n.badges || []).map((b: any) => b.label || s(b.text) || '').join(' ');
        return {
          kind: 'video', id, title: s(n.title) || '',
          thumb: best(n.thumbnails) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          duration: s(n.length_text) || s(n.duration?.text) || undefined,
          views: s(n.short_view_count_text) || s(n.view_count),
          published: s(n.published),
          author: n.author?.name, authorId: n.author?.id && n.author.id !== 'N/A' ? n.author.id : undefined,
          avatar: best(n.author?.thumbnails),
          live: /LIVE|ライブ/i.test(badges) || n.is_live,
        };
      }
      case 'ReelItem':
      case 'ShortsLockupView': {
        const id = n.id || n.on_tap_endpoint?.payload?.videoId || n.entity_id?.replace('shorts-shelf-item-', '');
        if (!id) return null;
        const title = s(n.title) || s(n.overlay_metadata?.primary_text) || (n.accessibility_text || '').split(',')[0];
        const views = s(n.views) || s(n.overlay_metadata?.secondary_text) || (n.accessibility_text || '').split(',')[1]?.trim();
        return { kind: 'short', id, title, thumb: best(n.thumbnails || n.thumbnail_view_model?.image || n.thumbnail) || `https://i.ytimg.com/vi/${id}/oardefault.jpg`, views };
      }
      case 'LockupView':
        return fromLockup(n);
      case 'Channel':
      case 'GridChannel': {
        const id = n.id || n.author?.id;
        if (!id) return null;
        return { kind: 'channel', id, title: n.author?.name || s(n.title) || '', thumb: best(n.author?.thumbnails || n.thumbnails), subs: [s(n.subscriber_count), s(n.video_count)].filter(Boolean).join(' • '), desc: s(n.description_snippet) };
      }
      case 'Playlist':
      case 'GridPlaylist': {
        const id = n.id;
        if (!id) return null;
        return { kind: 'playlist', id, title: s(n.title) || '', thumb: best(n.thumbnails) || best(n.first_videos?.[0]?.thumbnails), count: s(n.video_count) || s(n.video_count_short), author: n.author?.name };
      }
    }
  } catch {}
  return null;
}

const SKIP = new Set(['endpoint', 'on_tap', 'on_tap_endpoint', 'navigation_endpoint', 'menu', 'renderer_context', 'accessibility', 'contents_memo', 'header_memo', 'command', 'service_endpoint', 'overlay_metadata']);
const ITEM_TYPES = new Set(['Video', 'CompactVideo', 'GridVideo', 'PlaylistVideo', 'ReelItem', 'ShortsLockupView', 'LockupView', 'Channel', 'GridChannel', 'Playlist', 'GridPlaylist']);

/** Walk any parsed response, collecting items in order and the last continuation token. */
export function collect(root: any, opts: { skipShelves?: boolean } = {}) {
  const items: VideoItem[] = [];
  let continuation: string | undefined;
  const seen = new Set<any>();
  const ids = new Set<string>();
  const walk = (n: any, depth: number) => {
    if (!n || typeof n !== 'object' || depth > 40 || seen.has(n)) return;
    seen.add(n);
    if (Array.isArray(n)) { for (const c of n) walk(c, depth + 1); return; }
    if (typeof n.item === 'function' && typeof n.array === 'function') {
      try {
        const isArr = typeof n.is_array === 'function' ? n.is_array() : n.is_array;
        const isNull = typeof n.is_null === 'function' ? n.is_null() : n.is_null;
        if (!isNull) walk(isArr ? n.array() : n.item(), depth + 1);
      } catch {}
      return;
    }
    if (n.type === 'ContinuationItem' || n.type === 'ContinuationItemView') {
      let t = n.endpoint?.payload?.token || n.button?.endpoint?.payload?.token;
      if (!t) { try { t = JSON.stringify(n).match(/"token":"([^"]+)"/)?.[1]; } catch {} }
      if (t) continuation = t;
      return;
    }
    if (ITEM_TYPES.has(n.type)) {
      const it = normalize(n);
      if (it && !ids.has(it.kind + it.id)) { ids.add(it.kind + it.id); items.push(it); }
      return;
    }
    if (opts.skipShelves && (n.type === 'Shelf' || n.type === 'ReelShelf' || n.type === 'GridShelfView')) return;
    for (const k of Object.keys(n)) {
      if (SKIP.has(k)) continue;
      const v = n[k];
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(root, 0);
  return { items, continuation };
}

// ---------- API helpers ----------

export async function search(q: string, type: string, sort: string, cont?: string) {
  const y = await yt();
  if (cont) {
    const r: any = await y.actions.execute('/search', { continuation: cont, parse: true });
    return collect(r.on_response_received_commands || r.continuation_contents || r);
  }
  const filters: any = {};
  if (type && type !== 'all') filters.type = type;
  if (sort && sort !== 'relevance') filters.sort_by = sort;
  const r: any = await y.search(q, filters);
  const out = collect(r.page?.contents ?? r.results);
  if (!out.items.length) Object.assign(out, collect(r.results));
  let refinements: string[] = [];
  try { refinements = (r.refinements || []).slice(0, 10); } catch {}
  return { ...out, refinements, estimated: r.estimated_results };
}

export async function suggest(q: string) {
  const y = await yt();
  void y;
  try {
    const r = await fetch(`https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&hl=ja&gl=JP&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}`);
    const t = await r.text();
    const j = JSON.parse(t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')));
    return (j[1] || []).map((x: any) => x[0]).slice(0, 10);
  } catch { return []; }
}

function chaptersFrom(info: any) {
  const out: { title: string; start: number; thumb?: string }[] = [];
  try {
    const mm = info.player_overlays?.decorated_player_bar?.player_bar?.markers_map || [];
    for (const m of mm) for (const c of m.value?.chapters || []) out.push({ title: s(c.title) || '', start: Math.round((c.time_range_start_millis || 0) / 1000), thumb: best(c.thumbnail) });
  } catch {}
  if (!out.length) {
    try {
      const panels = info.engagement_panels || [];
      for (const p of panels) {
        const { items } = { items: [] as any[] };
        const walk = (n: any, d = 0) => {
          if (!n || typeof n !== 'object' || d > 25) return;
          if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
          if (n.type === 'MacroMarkersListItem') items.push(n);
          for (const k of Object.keys(n)) if (!SKIP.has(k)) walk(n[k], d + 1);
        };
        walk(p);
        for (const it of items) {
          const t = s(it.time_description) || '0:00';
          const sec = t.split(':').reverse().reduce((a, v, i) => a + Number(v) * 60 ** i, 0);
          if (!out.find((o) => o.start === sec)) out.push({ title: s(it.title) || '', start: sec, thumb: best(it.thumbnail) });
        }
        if (out.length) break;
      }
    } catch {}
  }
  return out;
}

export async function video(id: string) {
  const y = await yt();
  const info: any = await y.getInfo(id);
  const b = info.basic_info || {};
  const p = info.primary_info || {};
  const sec = info.secondary_info || {};
  const owner = sec.owner?.author || {};
  const rel = collect(info.watch_next_feed || []);
  try {
    if (info.wn_has_continuation) {
      const more: any = await info.getWatchNextContinuation();
      const ids = new Set(rel.items.map((x) => x.id));
      for (const it of collect(more.watch_next_feed || []).items) if (!ids.has(it.id)) rel.items.push(it);
    }
  } catch {}
  return {
    id,
    title: b.title || s(p.title) || '',
    description: sec.description ? (sec.description.toString?.() ?? '') : b.short_description || '',
    views: s(p.view_count?.view_count) || (b.view_count != null ? `${Number(b.view_count).toLocaleString('ja-JP')}回視聴` : ''),
    shortViews: s(p.view_count?.short_view_count),
    viewCount: b.view_count,
    published: s(p.relative_date) || s(p.published),
    date: s(p.published),
    likes: b.like_count,
    likeText: undefined as string | undefined,
    channel: { id: owner.id || b.channel_id, name: owner.name || b.author, avatar: best(owner.thumbnails), subs: s(sec.owner?.subscriber_count), verified: !!owner.is_verified },
    keywords: b.keywords || [],
    category: b.category,
    isLive: !!b.is_live,
    duration: b.duration,
    chapters: chaptersFrom(info),
    related: rel.items,
    relatedCont: rel.continuation,
    commentCount: undefined as string | undefined,
  };
}

export async function next(cont: string) {
  const y = await yt();
  const r: any = await y.actions.execute('/next', { continuation: cont, parse: true });
  return collect(r.on_response_received_endpoints || r.continuation_contents || r);
}

function mapComment(c: any) {
  return {
    id: c.comment_id,
    author: c.author?.name,
    authorId: c.author?.id,
    avatar: best(c.author?.thumbnails),
    text: s(c.content) || '',
    likes: c.like_count,
    published: c.published_time,
    replies: c.reply_count,
    pinned: !!c.is_pinned,
    hearted: !!c.is_hearted,
    owner: !!c.author_is_channel_owner,
  };
}

export async function comments(id: string, sort: 'TOP_COMMENTS' | 'NEWEST_FIRST', cont?: string) {
  const y = await yt();
  if (cont) {
    const r: any = await y.actions.execute('/next', { continuation: cont, parse: true });
    const eps = r.on_response_received_endpoints || [];
    const threads: any[] = [];
    let token: string | undefined;
    const walk = (n: any, d = 0) => {
      if (!n || typeof n !== 'object' || d > 20) return;
      if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
      if (n.type === 'CommentThread') { threads.push(n); return; }
      if (n.type === 'CommentView') { threads.push({ comment: n, isReply: true }); return; }
      if (n.type === 'ContinuationItem') { token = n.endpoint?.payload?.token || n.button?.endpoint?.payload?.token; return; }
      for (const k of Object.keys(n)) if (!SKIP.has(k)) walk(n[k], d + 1);
    };
    walk(eps);
    return { items: threads.filter((t) => t.comment).map((t) => ({ ...mapComment(t.comment), replyCont: replyToken(t) })), continuation: token };
  }
  const c: any = await y.getComments(id, sort);
  let token: string | undefined;
  try { token = (c as any).page?.on_response_received_endpoints?.slice(-1)?.[0]?.contents?.slice(-1)?.[0]?.endpoint?.payload?.token; } catch {}
  if (!token) {
    const { continuation } = collect((c as any).page?.on_response_received_endpoints || []);
    token = continuation;
  }
  return {
    count: s(c.header?.comments_count) || s(c.header?.count),
    items: c.contents.filter((t: any) => t.comment).map((t: any) => ({ ...mapComment(t.comment), replyCont: replyToken(t) })),
    continuation: token,
  };
}

function replyToken(t: any): string | undefined {
  try {
    const r = t.comment_replies_data || t.replies;
    if (!r) return undefined;
    const pool = [...(r.sub_threads || []), ...(r.contents || [])];
    const ci = pool.find((x: any) => x?.type === 'ContinuationItem') || pool[0];
    return ci?.endpoint?.payload?.token || ci?.button?.endpoint?.payload?.token || ci?.button?.button?.endpoint?.payload?.token;
  } catch { return undefined; }
}

export async function channel(id: string, tab: string, cont?: string) {
  const y = await yt();
  if (cont) {
    const r: any = await y.actions.execute('/browse', { continuation: cont, parse: true });
    return { items: collect(r.on_response_received_actions || r.continuation_contents || r).items, continuation: collect(r.on_response_received_actions || r.continuation_contents || r).continuation };
  }
  const ch: any = await y.getChannel(id);
  const h: any = ch.header;
  let info: any = { id, name: ch.metadata?.title, avatar: best(ch.metadata?.avatar), banner: undefined, handle: undefined, subs: undefined, videos: undefined, description: ch.metadata?.description };
  try {
    if (h?.type === 'PageHeader') {
      const c = h.content;
      info.name = s(c?.title?.text) || info.name;
      info.avatar = best(c?.image?.avatar?.image) || info.avatar;
      info.banner = best(c?.banner?.image);
      const rows = c?.metadata?.metadata_rows || [];
      const parts = rows.flatMap((r: any) => (r.metadata_parts || []).map((p: any) => s(p.text))).filter(Boolean);
      info.handle = parts.find((p: string) => p.startsWith('@'));
      info.subs = parts.find((p: string) => /登録者|subscriber/.test(p));
      info.videos = parts.find((p: string) => /本の動画|videos/.test(p));
      info.description = s(c?.description?.description) || info.description;
    } else if (h) {
      info.name = h.author?.name || info.name;
      info.avatar = best(h.author?.thumbnails) || info.avatar;
      info.banner = best(h.banner);
      info.subs = s(h.subscribers);
    }
  } catch {}
  let page: any = ch;
  try {
    if (tab === 'videos') page = await ch.getVideos();
    else if (tab === 'shorts') page = await ch.getShorts();
    else if (tab === 'streams') page = await ch.getLiveStreams();
    else if (tab === 'playlists') page = await ch.getPlaylists();
  } catch {
    page = ch;
  }
  const out = collect(page.page?.contents || page.current_tab || page);
  return { info, items: out.items, continuation: out.continuation };
}

export async function playlist(id: string, cont?: string) {
  const y = await yt();
  if (cont) {
    const r: any = await y.actions.execute('/browse', { continuation: cont, parse: true });
    return collect(r.on_response_received_actions || r.continuation_contents || r);
  }
  const p: any = await y.getPlaylist(id);
  const out = collect(p.items || []);
  try {
    const memo: any = p.memo;
    const nodes = [...(memo?.get?.('ContinuationItem') || []), ...(memo?.get?.('ContinuationItemView') || [])];
    const first = nodes[0];
    out.continuation = first ? collect([first]).continuation : undefined;
  } catch { out.continuation = undefined; }
  return { info: { title: s(p.info?.title), author: p.info?.author?.name, count: s(p.info?.total_items), views: s(p.info?.views), thumb: best(p.info?.thumbnails) }, ...out };
}
