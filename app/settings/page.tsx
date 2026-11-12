'use client';
import { useRef } from 'react';
import { actions, DEFAULT_SETTINGS, useStore } from '@/lib/store';
import { Icon, Switch, useSnack } from '@/components/ui';

const SEEDS = ['#c4002b', '#e8590c', '#f5b700', '#2e7d32', '#00897b', '#0277bd', '#3949ab', '#7b1fa2', '#c2185b', '#6d4c41', '#546e7a'];

export default function Settings() {
  const st = useStore((s) => s.settings);
  const snack = useSnack();
  const file = useRef<HTMLInputElement>(null);
  const row = (icon: string, title: string, desc: string, ctl: React.ReactNode) => (
    <div className="setting"><Icon n={icon} /><div className="txt"><b>{title}</b><span className="muted small">{desc}</span></div>{ctl}</div>
  );
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="h1">設定</div>
      <div className="h2">デザイン</div>
      <div className="card">
        {row('contrast', 'テーマ', 'ブラウザの設定に合わせるか固定', (
          <div className="bgroup">
            {([['system', '自動'], ['light', 'ライト'], ['dark', 'ダーク']] as const).map(([k, l]) => <button key={k} className={`btn sm ${st.theme === k ? 'on' : ''}`} onClick={() => actions.setSettings({ theme: k })}>{l}</button>)}
          </div>
        ))}
        <div className="setting" style={{ alignItems: 'flex-start' }}><Icon n="palette" /><div className="txt"><b>ダイナミックカラー</b><span className="muted small">選んだ色から Material 3 の配色を自動生成します</span>
          <div className="swatches" style={{ marginTop: 12 }}>
            {SEEDS.map((c) => <button key={c} className={`swatch ${st.seed === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => actions.setSettings({ seed: c })} />)}
            <label className="swatch" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', cursor: 'pointer', position: 'relative' }} title="カスタム">
              <input type="color" value={st.seed} onChange={(e) => actions.setSettings({ seed: e.target.value })} style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
            </label>
          </div></div></div>
      </div>
      <div className="h2">再生</div>
      <div className="card">
        {row('autoplay', '自動再生', '動画が終わったら次の動画を再生', <Switch on={st.autoplay} onChange={(v) => actions.setSettings({ autoplay: v })} />)}
        {row('resume', '続きから再生', '前回の再生位置から再開', <Switch on={st.resume} onChange={(v) => actions.setSettings({ resume: v })} />)}
        {row('speed', '標準の再生速度', '新しい動画を開いたときの速度', (
          <select value={st.speed} onChange={(e) => actions.setSettings({ speed: Number(e.target.value) })} className="btn surface sm">
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => <option key={s} value={s}>{s === 1 ? '標準' : s + 'x'}</option>)}
          </select>
        ))}
        {row('high_quality', '画質の希望', 'プレーヤーへの推奨（YouTube側で調整される場合あり）', (
          <select value={st.quality} onChange={(e) => actions.setSettings({ quality: e.target.value })} className="btn surface sm">
            {[['default', '自動'], ['hd2160', '2160p'], ['hd1440', '1440p'], ['hd1080', '1080p'], ['hd720', '720p'], ['large', '480p'], ['medium', '360p']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        ))}
      </div>
      <div className="h2">拡張機能</div>
      <div className="card">
        {row('shield', 'SponsorBlock', 'スポンサー・宣伝・イントロなどを自動スキップ', <Switch on={st.sponsorblock} onChange={(v) => actions.setSettings({ sponsorblock: v })} />)}
        {row('thumb_down', '低評価数を表示', 'Return YouTube Dislike の推定値', <Switch on={st.dislikes} onChange={(v) => actions.setSettings({ dislikes: v })} />)}
        {row('pause_circle', '履歴を一時停止', '再生履歴・検索履歴を保存しない', <Switch on={st.pauseHistory} onChange={(v) => actions.setSettings({ pauseHistory: v })} />)}
      </div>
      <div className="h2">データ</div>
      <div className="card">
        {row('download', 'エクスポート', '登録チャンネル・履歴・設定をJSONで保存', <button className="btn tonal sm" onClick={() => {
          const b = new Blob([actions.exportData()], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `m3tube-${new Date().toISOString().slice(0, 10)}.json`; a.click();
        }}>保存</button>)}
        {row('upload', 'インポート', 'エクスポートしたJSONを読み込み', <>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { actions.importData(await f.text()); snack({ msg: '読み込みました' }); } catch { snack({ msg: '読み込めませんでした' }); } }} />
          <button className="btn tonal sm" onClick={() => file.current?.click()}>選択</button></>)}
        {row('restart_alt', '設定をリセット', '設定のみ初期値に戻す', <button className="btn outlined sm" onClick={() => { actions.setSettings(DEFAULT_SETTINGS); snack({ msg: '設定をリセットしました' }); }}>リセット</button>)}
      </div>
      <p className="muted small" style={{ marginTop: 24 }}>M3Tube は YouTube の非公式クライアントです。動画データは InnerTube API から取得し、再生は YouTube 公式の埋め込みプレーヤーで行います。YouTube および Google とは関係ありません。</p>
    </div>
  );
}
