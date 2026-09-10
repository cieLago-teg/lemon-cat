'use client';
import { useState } from 'react';
import { apiFetch } from './useSession';
import { FAILURE_LABELS, RATING_LABELS } from '@/lib/feedback';

export function ImageFeedback({ imageUrl }: { imageUrl: string }) {
  const [ratings, setRatings] = useState<Record<string, number>>({}), [failures, setFailures] = useState<string[]>([]), [liked, setLiked] = useState(false);
  const [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setMessage('');
    try {
      const response = await apiFetch('/api/image-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, ratings, failures, liked }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '反馈未保存');
      setMessage('反馈已保存，谢谢你帮它变得更好。');
    } catch (err) { setMessage(err instanceof Error ? err.message : '网络异常，反馈未保存'); }
    finally { setSaving(false); }
  }
  return <details className="rounded-xl bg-white/70 p-4 text-sm text-[#5c2e10]">
    <summary className="cursor-pointer">这张画得怎么样？（可选反馈）</summary>
    <p className="my-3 text-xs">评分不会拦截生成，也不代表授权用你的照片训练模型。1 分不满意，5 分很满意。</p>
    {Object.entries(RATING_LABELS).map(([key, label]) => <label key={key} className="my-2 flex items-center justify-between">{label}<select aria-label={label} className="rounded border p-1" value={ratings[key] || ''} onChange={(e) => setRatings({ ...ratings, [key]: Number(e.target.value) })}><option value="">请选择</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 分</option>)}</select></label>)}
    <div className="my-3 flex flex-wrap gap-2">{Object.entries(FAILURE_LABELS).map(([key, label]) => <label key={key} className="rounded border p-2 text-xs"><input type="checkbox" checked={failures.includes(key)} onChange={(e) => setFailures(e.target.checked ? [...failures, key] : failures.filter((k) => k !== key))} /> {label}</label>)}</div>
    <label className="my-3 block"><input type="checkbox" checked={liked} onChange={(e) => setLiked(e.target.checked)} /> 这张达到我愿意使用的质量</label>
    <button disabled={saving || Object.keys(ratings).length !== 4} onClick={() => void save()} className="rounded-full bg-amber-900 px-4 py-2 text-white disabled:opacity-40">{saving ? '保存中…' : '保存反馈'}</button>
    {message && <p role="status" className="mt-2">{message}</p>}
  </details>;
}
