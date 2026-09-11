'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/app/components/LocaleProvider';
import { type MessageKey } from '@/lib/i18n';

export default function ConfirmAccountPage() {
  const { t } = useLocale();
  const link = useRef<{ token: string; purpose: string } | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const match = /^#(verify|reset):([a-f0-9]{64})$/.exec(location.hash);
    if (match) { link.current = { purpose: match[1], token: match[2] }; history.replaceState(null, '', location.pathname); }
    else if (!link.current) setStatus('invalidLink');
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !link.current) return;
    setBusy(true); setStatus(null);
    try {
      const response = await fetch('/api/auth/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...link.current, password }) });
      if (!response.ok) { setStatus(response.status === 429 ? 'rateLimited' : response.status >= 500 ? 'networkFailed' : 'invalidLink'); return; }
      setDone(true); setPassword(''); link.current = null;
    } catch (err) { console.error('[account] confirmation failed', err); setStatus('networkFailed'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-6 py-16 text-[#5c2e10]">
    <h1 className="text-3xl">{t('confirmAccount')}</h1>
    <p className="my-5 text-sm">{t(done ? 'passwordSaved' : 'confirmAccountHint')}</p>
    {!done && <form onSubmit={submit} className="space-y-4">
      <label className="block">{t('password')}<input className="mt-2 w-full rounded-xl border p-3" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <p className="text-sm">{t('passwordMin')}</p>
      <button disabled={busy || status === 'invalidLink'} className="rounded-full bg-[#f8a8a8] px-6 py-3 disabled:opacity-50">{t(busy ? 'waiting' : 'confirmPassword')}</button>
    </form>}
    {status && <p role="alert" className="my-4 text-red-800">{t(status)}</p>}
    <Link className="mt-6 block underline" href="/login">{t('goLogin')}</Link>
  </main>;
}
