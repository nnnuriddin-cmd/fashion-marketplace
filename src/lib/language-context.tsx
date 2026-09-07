'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'uz';
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => { if (localStorage.getItem('trendmall_language') === 'uz') setLanguage('uz'); }, []);
  const changeLanguage = (next: Language) => { setLanguage(next); localStorage.setItem('trendmall_language', next); };
  return <LanguageContext.Provider value={{ language, setLanguage: changeLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
