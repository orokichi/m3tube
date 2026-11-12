'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fmtTime } from '@/lib/api';
import { chat, Msg } from '@/lib/ai';
import { useStore } from '@/lib/store';
import { Icon } from './ui';

function Rich({ text, onSeek }: { text: string; onSeek: (t: number) => void }) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*)|(\b\d{1,2}(?::\d{2}){1,2}\b)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  const clean = text.replace(/^#{1,4}\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ');
  while ((m = re.exec(clean))) {
    if (m.index > last) out.push(clean.slice(last, m.index));
    if (m[1]) out.push(<b key={k++}>{m[1].slice(2, -2)}</b>);
    else { const sec = m[2].split(':').reverse().reduce((a, v, i) => a + Number(v) * 60 ** i, 0); out.push(<a key={k++} href="#" onClick={(e) => { e.preventDefault(); onSeek(sec); }}>{m[2]}</a>); }
    last = m.index + m[0].length;
  }
  if (last < clean.length) out.push(clean.slice(last));
  return <>{out}</>;
}

export default function AskTube({ id, onSeek, getTime }: { id: string; onSeek: (t: number) => void; getTime: () => number }) {
  const key = useStore((s) => s.settings.aiKey);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ctx = useRef<any>(null);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs([]); ctx.current = null; abort.current?.abort(); setBusy(false); }, [id]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs]);

  const system = (c: any) => `あなたは「Ask Tube」。YouTube動画について質問に答えるアシスタントです。以下の動画情報（タイトル・説明・チャプター・人気コメント）だけを根拠に、日本語で簡潔に答えてください。
字幕は取得できないため、映像の細部は推測であることを明示し、わからないことは「情報からはわかりません」と答えてください。
時刻に触れるときは 12:34 の形式で書くと再生位置へジャンプできます。
---
タイトル: ${c.title}
チャンネル: ${c.channel}
公開: ${c.date || ''} / ${c.views || ''} / 高評価 ${c.likes ?? ''} / 長さ ${c.duration ? fmtTime(c.duration) : '不明'}
チャプター:
${(c.chapters || []).map((x: any) => `${fmtTime(x.t)} ${x.title}`).join('\n') || 'なし'}
説明:
${(c.description || '').slice(0, 5000)}
人気コメント:
${(c.comments || []).map((x: any) => `- (${x.l}) ${x.t.replace(/\n/g, ' ')}`).join('\n').slice(0, 7000)}`;

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setInput('');
    const now = getTime();
    const userMsg: Msg = { role: 'user', content: question };
    const history = [...msgs, userMsg];
    setMsgs([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      if (!ctx.current) ctx.current = await api({ fn: 'askctx', id });
      const ac = new AbortController(); abort.current = ac;
      await chat([{ role: 'system', content: system(ctx.current) + `\n(視聴者の現在の再生位置: ${fmtTime(now)})` }, ...history], {
        signal: ac.signal,
        onToken: (full) => setMsgs([...history, { role: 'assistant', content: full }]),
      });
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsgs([...history, { role: 'assistant', content: '⚠️ ' + (e.message || e) }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="ai-card">
      <button className="hd" style={{ width: '100%' }} onClick={() => setOpen(!open)}>
        <span className="icon-btn sparkle" style={{ width: 32, height: 32, borderRadius: 12 }}><Icon n="auto_awesome" fill size={18} /></span>
        Ask Tube <span className="muted small" style={{ fontWeight: 500 }}>この動画について AI に質問</span>
        <span className="spacer" /><Icon n={open ? 'expand_less' : 'expand_more'} />
      </button>
      {open && (!key ? (
        <div style={{ marginTop: 10 }}>設定で OpenRouter または Groq の API キーを登録すると使えます。<div style={{ marginTop: 10 }}><Link className="btn filled sm" href="/settings#ai">設定を開く</Link></div></div>
      ) : (
        <>
          {msgs.length > 0 && (
            <div className="ai-msgs" ref={box}>
              {msgs.map((m, i) => (
                <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                  {m.role === 'user' ? m.content : m.content ? <Rich text={m.content} onSeek={onSeek} /> : <span className="muted">考えています…</span>}
                </div>
              ))}
            </div>
          )}
          <div className="chips" style={{ margin: '10px 0' }}>
            {['この動画を3行で要約して', '見どころはどこ？', '結論・答えは何？', 'コメントの反応をまとめて'].map((x) => <button key={x} className="chip sl" disabled={busy} onClick={() => ask(x)}>{x}</button>)}
          </div>
          <div className="ai-input">
            <input value={input} placeholder="動画について質問…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && ask(input)} />
            {busy ? <button className="icon-btn tonal" onClick={() => abort.current?.abort()} aria-label="停止"><Icon n="stop" /></button>
              : <button className="icon-btn filled" onClick={() => ask(input)} aria-label="送信"><Icon n="send" /></button>}
          </div>
        </>
      ))}
    </div>
  );
}
