'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { LOCALE_COOKIE, translate, type Locale, type MessageKey } from '@/lib/i18n';

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = translate(locale, 'title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', translate(locale, 'description'));
  }, [locale]);
  const setLocale = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    updateLocale(next);
  };
  return <LocaleContext.Provider value={{ locale, setLocale, t: (key) => translate(locale, key) }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return <label className="inline-flex items-center rounded-full border border-amber-900/15 bg-white/50 px-2 py-1 text-xs text-amber-900">
    <span className="sr-only">{t('language')}</span>
    <select value={locale} onChange={(event) => setLocale(event.target.value === 'zh' ? 'zh' : 'en')} className="min-h-8 cursor-pointer rounded bg-transparent px-1 outline-offset-2">
      <option value="zh" lang="zh-CN">中文</option>
      <option value="en" lang="en">English</option>
    </select>
  </label>;
}
