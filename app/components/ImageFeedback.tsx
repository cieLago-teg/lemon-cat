'use client';
import { useState } from 'react';
import { apiFetch } from './useSession';
import { FAILURE_LABELS, RATING_LABELS } from '@/lib/feedback';
import { useLocale } from './LocaleProvider';
import type { MessageKey } from '@/lib/i18n';
const ratingKeys: Record<string, MessageKey> = { identity:'rateIdentity', style:'rateStyle', anatomy:'rateAnatomy', desktop:'rateDesktop' };
const failureKeys: Record<string, MessageKey> = { identity:'failIdentity', style:'failStyle', anatomy:'failAnatomy', markings:'failMarkings', crop:'failCrop', background:'failBackground', detail:'failDetail' };

export function ImageFeedback({ imageUrl }: { imageUrl: string }) {
  const { t } = useLocale();
  const [ratings, setRatings] = useState<Record<string, number>>({}), [failures, setFailures] = useState<string[]>([]), [liked, setLiked] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null), [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setMessage(null);
    try {
      const response = await apiFetch('/api/image-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, ratings, failures, liked }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '反馈未保存');
      setMessage('feedbackSaved');
    } catch (err) { console.error('[feedback] save failed', err); setMessage('feedbackFailed'); }
    finally { setSaving(false); }
  }
  return <details className="rounded-xl bg-white/70 p-4 text-sm text-[#5c2e10]">
    <summary className="cursor-pointer">{t('feedbackTitle')}</summary>
    <p className="my-3 text-xs">{t('feedbackHint')}</p>
    {Object.keys(RATING_LABELS).map((key) => <label key={key} className="my-2 flex items-center justify-between">{t(ratingKeys[key])}<select aria-label={t(ratingKeys[key])} className="rounded border p-1" value={ratings[key] || ''} onChange={(e) => setRatings({ ...ratings, [key]: Number(e.target.value) })}><option value="">{t('chooseRating')}</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>)}
    <div className="my-3 flex flex-wrap gap-2">{Object.keys(FAILURE_LABELS).map((key) => <label key={key} className="rounded border p-2 text-xs"><input type="checkbox" checked={failures.includes(key)} onChange={(e) => setFailures(e.target.checked ? [...failures, key] : failures.filter((k) => k !== key))} /> {t(failureKeys[key])}</label>)}</div>
    <label className="my-3 block"><input type="checkbox" checked={liked} onChange={(e) => setLiked(e.target.checked)} /> {t('feedbackReady')}</label>
    <button disabled={saving || Object.keys(ratings).length !== 4} onClick={() => void save()} className="rounded-full bg-amber-900 px-4 py-2 text-white disabled:opacity-40">{t(saving ? 'saving' : 'saveFeedback')}</button>
    {message && <p role="status" className="mt-2">{t(message)}</p>}
  </details>;
}
