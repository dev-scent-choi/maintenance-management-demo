import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';
import { useLanguage } from '../../contexts/LanguageContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** @deprecated 기본이 fixed 오버레이이므로 효과 없음 */
  fullScreen?: boolean;
  message?: string;
  /** 'inline' = flex 부모 안에서 중앙 정렬 (모달 내부 패널용)
   *  default  = fixed 중앙 카드 오버레이 */
  variant?: 'inline';
}

const spinnerSize = { sm: 'w-6 h-6', md: 'w-9 h-9', lg: 'w-12 h-12' };
const textSize    = { sm: 'text-sm',  md: 'text-base', lg: 'text-lg' };

const Svg: React.FC<{ cls: string; color: string }> = ({ cls, color }) => (
  <svg className={`animate-spin ${cls}`} viewBox="0 0 24 24" fill="none" style={{ color }}>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" />
  </svg>
);

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  variant,
}) => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const t = useLanguage();
  const displayMessage = message ?? t('loading');

  // inline: flex 부모 안에서 중앙 정렬 (이력 모달 내부 등)
  if (variant === 'inline') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Svg cls={spinnerSize[size]} color={themeColors.primary} />
          {displayMessage && (
            <span className={textSize[size]} style={{ color: themeColors.textSecondary }}>
              {displayMessage}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 기본: fixed 화면 중앙 오버레이
  const isDark = theme !== 'light';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}
    >
      <div
        className="flex flex-col items-center gap-4 px-10 py-8 rounded-lg"
        style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <Svg cls={spinnerSize[size]} color={themeColors.primary} />
        {displayMessage && (
          <span className={`font-medium ${textSize[size]}`} style={{ color: themeColors.text }}>
            {displayMessage}
          </span>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
