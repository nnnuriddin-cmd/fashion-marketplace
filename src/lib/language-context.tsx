'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'uz' | 'ru' | 'en';
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('uz');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('trendmall_language');
      if (saved && (saved === 'uz' || saved === 'ru' || saved === 'en')) {
        setLanguage(saved as Language);
      } else {
        localStorage.setItem('trendmall_language', 'uz');
      }
    } catch {
      // localStorage may be unavailable in restricted environments
    }
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    try {
      localStorage.setItem('trendmall_language', next);
    } catch {
      // silent
    }
  };

  return <LanguageContext.Provider value={{ language, setLanguage: changeLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
