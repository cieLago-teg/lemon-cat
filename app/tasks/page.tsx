'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../components/useSession';
type Task = { taskId: string; kind: string; state: string; message: string; error?: string; videoUrl?: string; result?: { tags?: string[]; results?: { style: string; imageUrl: string; prompt?: string }[] } };
export default function TasksPage() {
  const [tasks,setTasks] = useState<Task[]>([]);
  const [error,setError] = useState('');
  const [name,setName] = useState('');
  const [saving,setSaving] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await apiFetch('/api/jobs', { signal: AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error(`任务查询失败 (${response.status})`);
        setTasks((await response.json()).jobs); setError('');
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '网络异常'); }
      if (!controller.signal.aborted) timer = setTimeout(refresh,5000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  async function save(task: Task) {
    if (saving) return;
    if (!name.trim()) { setError('请先填写宠物名字'); return; }
    setSaving(task.taskId);
    try {
      const response = await apiFetch('/api/archive',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({petName:name.trim(),results:task.result?.results || []}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '保存失败');
      window.location.href = `/create/success?id=${encodeURIComponent(body.archive.id)}`;
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); }
    finally { setSaving(null); }
  }
  return <main className="mx-auto max-w-4xl px-6 py-10 text-[#5c2e10]">
    <h1 className="font-handwriting text-4xl">生成任务</h1>
    <p className="my-4 text-sm">刷新、关页不会取消已提交的任务。显示“待核对”时请勿重新生成，向维护者提供任务编号。</p>
    {error && <p role="alert" className="my-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    <label className="my-4 block">恢复生图结果时的宠物名字 <input className="rounded-xl border p-2" value={name} maxLength={100} onChange={(event)=>setName(event.target.value)} /></label>
    {!tasks.length && <p>暂时没有任务。</p>}
    {tasks.map((task)=><section key={task.taskId} className="my-4 rounded-2xl border bg-white/70 p-5">
      <h2 className="font-bold">{{extract:'照片识别',generate:'形象生成',animate:'动态生成'}[task.kind] || task.kind} · {task.message}</h2>
      <p className="my-2 break-all text-xs opacity-70">{task.taskId}</p>
      {task.error && <p className="text-sm text-red-800">{task.error}</p>}
      {(task.state === 'success' || Boolean(task.result?.results?.length)) && <>
        {task.result?.tags && <p>{task.result.tags.join('、')}</p>}
        {task.result?.results && <><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{task.result.results.map((result,index)=><img key={index} src={result.imageUrl} alt={result.style} className="rounded-xl" />)}</div><button disabled={Boolean(saving)} onClick={()=>void save(task)} className="mt-4 rounded-full bg-[#f8a8a8] px-5 py-2">{saving === task.taskId ? '正在保存…' : '恢复并保存宠物档案'}</button></>}
        {task.videoUrl && <video controls loop muted src={task.videoUrl} className="mt-3 max-h-64 rounded-xl" />}
      </>}
    </section>)}
  </main>;
}
