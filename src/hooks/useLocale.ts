import { useSettingsStore } from '../store/settingsStore';
import { getLocaleFromLanguage } from '../utils/formatters';

/**
 * 현재 언어 설정에 따른 locale 코드를 반환하는 hook
 */
export const useLocale = (): string => {
  const language = useSettingsStore((state) => state.settings.language);
  return getLocaleFromLanguage(language);
};
