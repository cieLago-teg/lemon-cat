'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../components/useSession';
import { useLocale } from '../components/LocaleProvider';
import type { MessageKey } from '@/lib/i18n';
type Task = { taskId: string; kind: string; state: string; message: string; error?: string; videoUrl?: string; result?: { tags?: string[]; results?: { style: string; imageUrl: string; prompt?: string }[] } };
export default function TasksPage() {
  const { t } = useLocale();
  const [tasks,setTasks] = useState<Task[]>([]);
  const [error,setError] = useState<MessageKey | null>(null);
  const [name,setName] = useState('');
  const [saving,setSaving] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await apiFetch('/api/jobs', { signal: AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error(`任务查询失败 (${response.status})`);
        setTasks((await response.json()).jobs); setError(null);
      } catch (err) { if (!controller.signal.aborted) { console.error('[tasks] refresh failed', err); setError('networkFailed'); } }
      if (!controller.signal.aborted) timer = setTimeout(refresh,5000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  async function save(task: Task) {
    if (saving) return;
    if (!name.trim()) { setError('petNameRequired'); return; }
    setSaving(task.taskId);
    try {
      const response = await apiFetch('/api/archive',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({petName:name.trim(),results:task.result?.results || []}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '保存失败');
      window.location.href = `/create/success?id=${encodeURIComponent(body.archive.id)}`;
    } catch (err) { console.error('[tasks] recovery save failed', err); setError('saveFailed'); }
    finally { setSaving(null); }
  }
  return <main className="mx-auto max-w-4xl px-6 py-10 text-[#5c2e10]">
    <h1 className="font-handwriting text-4xl">{t('tasks')}</h1>
    <p className="my-4 text-sm">{t('tasksHint')}</p>
    {error && <p role="alert" className="my-4 rounded-xl bg-red-50 p-4 text-red-800">{t(error)}</p>}
    <label className="my-4 block">{t('recoveryName')} <input className="rounded-xl border p-2" value={name} maxLength={100} onChange={(event)=>setName(event.target.value)} /></label>
    {!tasks.length && <p>{t('noTasks')}</p>}
    {tasks.map((task)=><section key={task.taskId} className="my-4 rounded-2xl border bg-white/70 p-5">
      <h2 className="font-bold">{t(task.kind === 'extract' ? 'extracting' : task.kind === 'generate' ? 'generating' : 'animating')} · {t((['queued','submitting','polling','materializing','success','failed','needs_review'].includes(task.state) ? task.state : 'needs_review') as MessageKey)}</h2>
      <p className="my-2 break-all text-xs opacity-70">{task.taskId}</p>
      {task.error && <p className="text-sm text-red-800">{t(task.state === 'needs_review' ? 'needs_review' : 'failed')}</p>}
      {(task.state === 'success' || Boolean(task.result?.results?.length)) && <>
        {task.result?.tags && <p>{task.result.tags.join('、')}</p>}
        {task.result?.results && <><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{task.result.results.map((result,index)=><img key={index} src={result.imageUrl} alt={result.style} className="rounded-xl" />)}</div><button disabled={Boolean(saving)} onClick={()=>void save(task)} className="mt-4 rounded-full bg-[#f8a8a8] px-5 py-2">{t(saving === task.taskId ? 'saving' : 'recoverPet')}</button></>}
        {task.videoUrl && <video controls loop muted src={task.videoUrl} className="mt-3 max-h-64 rounded-xl" />}
      </>}
    </section>)}
  </main>;
}
