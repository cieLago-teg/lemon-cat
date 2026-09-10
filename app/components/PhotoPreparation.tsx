'use client';
import { useEffect, useRef, useState } from 'react';
import { preparePhoto, type CropBox } from '@/lib/image';
import { useLocale } from './LocaleProvider';
import { photoMessage } from '@/lib/i18n';

const full: CropBox = { x: 0, y: 0, width: 1, height: 1 };
export function PhotoPreparation({ file, onCancel, onConfirm }: { file: File; onCancel: () => void; onConfirm: (file: File, warnings: string[]) => void }) {
  const { locale, t } = useLocale();
  const [turns, setTurns] = useState(0), [exposure, setExposure] = useState(0), [crop, setCrop] = useState(full);
  const [preview, setPreview] = useState(''), [warnings, setWarnings] = useState<string[]>([]), [error, setError] = useState('');
  const [ready, setReady] = useState<File | null>(null), [confirmed, setConfirmed] = useState(false);
  const canvasRef = useRef<HTMLImageElement>(null), drag = useRef<{ x: number; y: number } | null>(null);
  const [rotated, setRotated] = useState('');
  useEffect(() => {
    let live = true, url = '';
    setRotated('');
    preparePhoto(file, full, turns, 0).then(({ file: rotatedFile }) => { if (live) { url = URL.createObjectURL(rotatedFile); setRotated(url); } }).catch((err) => { if (live) setError(String(err.message)); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [file, turns]);
  useEffect(() => {
    let live = true, url = '';
    setReady(null); setError(''); setConfirmed(false);
    const timer = setTimeout(() => {
      preparePhoto(file, crop, turns, exposure).then((result) => { if (live) { url = URL.createObjectURL(result.file); setPreview(url); setReady(result.file); setWarnings(result.warnings); } }).catch((err) => { if (live) setError(String(err.message)); });
    }, 120);
    return () => { live = false; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [file, crop, turns, exposure]);
  const point = (event: React.PointerEvent) => {
    const box = canvasRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) };
  };
  return <section className="my-8 rounded-3xl bg-white/75 p-6 text-[#5c2e10]">
    <h2 className="text-2xl">{t('photoTitle')}</h2>
    <p className="my-3 text-sm">{t('photoCropHint')}</p>
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="relative inline-block max-w-full touch-none select-none"
          onPointerDown={(event) => { if (!rotated) return; drag.current = point(event); event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerUp={(event) => { if (!drag.current) return; const end = point(event), start = drag.current; drag.current = null; const width = Math.abs(end.x - start.x), height = Math.abs(end.y - start.y); if (width > 0.03 && height > 0.03) setCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height }); }}>
          {rotated && <img ref={canvasRef} src={rotated} draggable={false} alt={t('photoCropAlt')} className="block max-h-96 max-w-full" />}
          <div className="pointer-events-none absolute border-2 border-amber-700 bg-amber-100/10" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} />
        </div>
        <div className="my-3 flex gap-4 text-sm"><button onClick={() => { setTurns(turns + 1); setCrop(full); }}>{t('photoRotate')}</button><button onClick={() => setCrop(full)}>{t('photoFull')}</button></div>
        <label className="block text-sm">{t('photoExposure')}<input className="mt-2 block w-full" type="range" min={-15} max={15} value={exposure} onChange={(e) => setExposure(Number(e.target.value))} /></label>
      </div>
      <div>
        <p className="mb-2 text-sm">{t('photoActual')}</p>
        {preview && <img src={preview} alt={t('photoPreparedAlt')} className="max-h-80 w-full object-contain" />}
        <p className="my-3 text-xs">{t('photoLimit')}</p>
        {warnings.map((w) => <p key={w} className="my-1 text-sm text-amber-800">{t('photoWarning')}: {photoMessage(locale, w)}</p>)}
        {error && <p role="alert" className="text-red-700">{photoMessage(locale, error)}</p>}
        <label className="my-4 flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{t('photoConfirmCheck')}</label>
        <button disabled={!ready || !confirmed} onClick={() => ready && onConfirm(ready, warnings)} className="rounded-full bg-amber-900 px-6 py-3 text-white disabled:opacity-40">{t('photoConfirm')}</button>
        <button onClick={onCancel} className="ml-4 text-sm">{t('changePhoto')}</button>
      </div>
    </div>
  </section>;
}
