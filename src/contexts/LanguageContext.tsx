import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import '../i18n/config';

const LanguageContext = createContext<any>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const language = useSettingsStore((state) => state.settings.language);

  useEffect(() => {
    // 현재 i18n 언어와 다를 때만 변경
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return <LanguageContext.Provider value={t}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
