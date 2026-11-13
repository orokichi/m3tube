'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { actions, useStore } from '@/lib/store';
import { applyTheme } from '@/lib/theme';
import { api } from '@/lib/api';
import { Avatar, Icon, MenuProvider, SnackProvider } from './ui';

const NAV = [
  { href: '/', icon: 'home', label: 'ホーム' },
  { href: '/shorts', icon: 'bolt', label: 'ショート' },
  { href: '/feed/subscriptions', icon: 'subscriptions', label: '登録チャンネル' },
  { href: '/feed/you', icon: 'account_circle', label: 'マイページ' },
];

function useWidth() {
  const [w, setW] = useState(1400);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return w;
}

function ThemeApplier() {
  const seed = useStore((s) => s.settings.seed);
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    applyTheme(seed, theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const f = () => applyTheme(seed, theme);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [seed, theme]);
  return null;
}

function SearchBar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  const path = usePathname();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [sugs, setSugs] = useState<string[]>([]);
  const [idx, setIdx] = useState(-1);
  const history = useStore((s) => s.searches);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (path === '/results') setQ(sp.get('search_query') || ''); }, [path, sp]);
  useEffect(() => { if (mobileOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [mobileOpen]);
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      if (!q.trim()) { setSugs([]); return; }
      api<string[]>({ fn: 'suggest', q }).then(setSugs).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q, focus]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const list: { t: string; hist: boolean }[] = q.trim()
    ? [...history.filter((h) => h.startsWith(q) && h !== q).slice(0, 3).map((t) => ({ t, hist: true })), ...sugs.filter((s) => !history.includes(s)).map((t) => ({ t, hist: false }))].slice(0, 12)
    : history.slice(0, 10).map((t) => ({ t, hist: true }));

  const go = (term: string) => {
    term = term.trim();
    if (!term) return;
    const m = term.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
    setFocus(false); setMobileOpen(false); inputRef.current?.blur();
    if (m) { router.push(`/watch?v=${m[1]}`); return; }
    actions.addSearch(term);
    setQ(term);
    router.push(`/results?search_query=${encodeURIComponent(term)}`);
  };
  const open = focus && list.length > 0;
  return (
    <div className={`search ${open ? 'open' : ''}`}>
      {mobileOpen && <button className="icon-btn sl" onClick={() => setMobileOpen(false)} aria-label="戻る"><Icon n="arrow_back" /></button>}
      <input
        ref={inputRef}
        value={q}
        placeholder="検索"
        aria-label="検索"
        onChange={(e) => { setQ(e.target.value); setIdx(-1); }}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(-1, i - 1)); }
          else if (e.key === 'Enter') go(idx >= 0 ? list[idx].t : q);
          else if (e.key === 'Escape') inputRef.current?.blur();
        }}
        enterKeyHint="search"
      />
      {q && <button className="icon-btn sl" onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="クリア"><Icon n="close" /></button>}
      <button className="icon-btn sl" title="Advanced Search (AI)" aria-label="Advanced Search" onMouseDown={(e) => e.preventDefault()} onClick={() => { setFocus(false); setMobileOpen(false); router.push(`/advanced${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}><Icon n="auto_awesome" /></button>
      <button className="icon-btn tonal" onClick={() => go(q)} aria-label="検索"><Icon n="search" /></button>
      {open && (
        <div className="suggest">
          {list.map((s, i) => (
            <div key={s.t + i} className={`row ${i === idx ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); go(s.t); }}>
              <Icon n={s.hist ? 'history' : 'search'} />
              <span style={{ fontWeight: s.hist ? 600 : 500, color: s.hist ? 'var(--md-primary)' : undefined }}>{s.t}</span>
              {s.hist && <span className="x" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); actions.removeSearch(s.t); }}>削除</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrawerContent({ path, onNav }: { path: string; onNav?: () => void }) {
  const subs = useStore((s) => s.subs);
  const [all, setAll] = useState(false);
  const item = (href: string, icon: string, label: string) => (
    <Link key={href} href={href} onClick={onNav} className={`item sl ${path === href ? 'on' : ''}`}><Icon n={icon} fill={path === href} /><span className="t">{label}</span></Link>
  );
  return (
    <>
      {item('/', 'home', 'ホーム')}
      {item('/shorts', 'bolt', 'ショート')}
      {item('/feed/subscriptions', 'subscriptions', '登録チャンネル')}
      {item('/advanced', 'auto_awesome', 'Advanced Search')}
      <hr />
      <Link href="/feed/you" onClick={onNav}><h4>マイページ <Icon n="chevron_right" size={20} /></h4></Link>
      {item('/feed/history', 'history', '履歴')}
      {item('/playlist?list=WL', 'schedule', '後で見る')}
      {item('/playlist?list=LL', 'thumb_up', '高く評価した動画')}
      <hr />
      <h4>登録チャンネル</h4>
      {subs.length === 0 && <div className="muted small" style={{ padding: '0 16px 8px' }}>チャンネルを登録すると、ここに表示されます。</div>}
      {(all ? subs : subs.slice(0, 7)).map((s) => (
        <Link key={s.id} href={`/channel/${s.id}`} onClick={onNav} className={`item sl ${path === '/channel/' + s.id ? 'on' : ''}`}>
          <Avatar src={s.avatar} name={s.name} className="" /><span className="t">{s.name}</span>
        </Link>
      ))}
      {subs.length > 7 && <button className="item sl" style={{ width: '100%' }} onClick={() => setAll(!all)}><Icon n={all ? 'expand_less' : 'expand_more'} />{all ? '一部を表示' : `${subs.length - 7} 件をさらに表示`}</button>}
      <hr />
      <h4>探索</h4>
      {[
        ['/?chip=music', 'music_note', '音楽'], ['/?chip=game', 'sports_esports', 'ゲーム'], ['/?chip=live', 'sensors', 'ライブ'],
        ['/?chip=news', 'newspaper', 'ニュース'], ['/?chip=sports', 'trophy', 'スポーツ'], ['/?chip=anime', 'animation', 'アニメ'],
      ].map(([h, i, l]) => item(h, i, l))}
      <hr />
      {item('/settings', 'settings', '設定')}
      <div className="foot">M3Tube — YouTube 非公式クライアント<br />データ取得: InnerTube API / 再生: YouTube 埋め込みプレーヤー<br />Material 3 Expressive</div>
    </>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const w = useWidth();
  const betaUi = useStore((s) => s.settings.betaUi);
  const [modal, setModal] = useState(false);
  const [mini, setMini] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const isWatch = path === '/watch' || path.startsWith('/shorts');
  const big = w >= 1312;
  const mobile = w < 792;
  const mode: 'drawer' | 'rail' | 'none' = mobile ? 'none' : isWatch ? 'none' : big && !mini ? 'drawer' : 'rail';

  useEffect(() => { setModal(false); setMobileSearch(false); }, [path]);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  const menuClick = () => { if (big && !isWatch) setMini(!mini); else setModal(true); };

  return (
    <div className={`${mode === 'drawer' ? 'with-drawer' : mode === 'rail' ? 'with-rail' : ''}${betaUi ? ' beta-ui' : ''}`}>
      <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        {mobileSearch ? (
          <div className="search-wrap"><SearchBar mobileOpen setMobileOpen={setMobileSearch} /></div>
        ) : (
          <>
            <button className="icon-btn sl" aria-label="メニュー" onClick={menuClick}><Icon n="menu" /></button>
            <Link href="/" className="logo" aria-label="M3Tube ホーム">
              <span className="logo-mark"><Icon n="play_arrow" fill /></span>M3Tube<small>JP</small>
            </Link>
            {betaUi && <span className="beta-badge">BETA</span>}
            <div className="search-wrap hide-sm"><Suspense><SearchBar mobileOpen={false} setMobileOpen={setMobileSearch} /></Suspense></div>
            <div className="spacer show-sm" />
            <button className="icon-btn sl show-sm" aria-label="検索" onClick={() => setMobileSearch(true)}><Icon n="search" /></button>
            <button className="icon-btn sl hide-sm" aria-label="履歴" onClick={() => router.push('/feed/history')}><Icon n="history" /></button>
            <button className="icon-btn sl" aria-label="設定" onClick={() => router.push('/settings')}><Icon n="settings" /></button>
          </>
        )}
      </header>

      {mode === 'rail' && (
        <nav className="rail">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? 'on' : ''}>
              <span className="pill"><Icon n={n.icon} fill={path === n.href} /></span>{n.label.replace('登録チャンネル', '登録')}
            </Link>
          ))}
        </nav>
      )}
      {mode === 'drawer' && <nav className="drawer"><DrawerContent path={path} /></nav>}

      <div className={`scrim ${modal ? 'open' : ''}`} onClick={() => setModal(false)} />
      <nav className={`drawer modal ${modal ? 'open' : ''}`} aria-hidden={!modal}>
        <div className="row-flex" style={{ height: 56, marginBottom: 4 }}>
          <button className="icon-btn sl" aria-label="閉じる" onClick={() => setModal(false)}><Icon n="menu" /></button>
          <Link href="/" className="logo"><span className="logo-mark"><Icon n="play_arrow" fill /></span>M3Tube</Link>
        </div>
        <DrawerContent path={path} onNav={() => setModal(false)} />
      </nav>

      <main className="content">{children}</main>

      <nav className="bottomnav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? 'on' : ''}>
            <span className="pill"><Icon n={n.icon} fill={path === n.href} /></span>{n.label.replace('登録チャンネル', '登録')}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <SnackProvider>
      <MenuProvider>
        <ThemeApplier />
        <Suspense>
          <Chrome>{children}</Chrome>
        </Suspense>
      </MenuProvider>
    </SnackProvider>
  );
}
