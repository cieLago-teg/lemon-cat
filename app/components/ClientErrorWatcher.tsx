"use client";

import { useEffect, useState } from "react";
import { useLocale } from './LocaleProvider';
import type { MessageKey } from '@/lib/i18n';

type Notice = { id: number; text: MessageKey };

// Attaches global window.onerror / unhandledrejection listeners so runtime and
// network failures surface a visible, dismissible notice instead of failing
// silently. Original error objects are kept in the console for diagnosis.
export default function ClientErrorWatcher() {
  const { t } = useLocale();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let seq = 0;
    const push = (text: MessageKey) => {
      seq += 1;
      const id = Date.now() + seq;
      setNotices((prev) => [...prev.slice(-2), { id, text }]);
      window.setTimeout(() => {
        setNotices((prev) => prev.filter((n) => n.id !== id));
      }, 8000);
    };

    const onError = (event: ErrorEvent) => {
      console.error("[window.onerror]", event.error || event.message, event.filename, event.lineno);
      push('runtimeFailed');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      console.error("[unhandledrejection]", reason);
      const text =
        reason instanceof TypeError && /fetch|network|load failed/i.test(String(reason.message))
          ? 'networkFailed'
          : 'incomplete';
      push(text);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (notices.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto rounded-2xl border border-rose-200/70 bg-rose-50/95 px-4 py-2.5 text-sm text-rose-800 shadow-[0_12px_30px_-18px_rgba(120,20,40,0.5)] backdrop-blur"
        >
          {t(n.text)}
        </div>
      ))}
    </div>
  );
}
