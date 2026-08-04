import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import {
  Palette, Globe, Layout, Type, Bell, RotateCcw, Check, Mail,
  Globe as WebIcon, Minimize2, Table2
} from 'lucide-react';
import type { Theme, Language, LayoutType, TableStyle } from '../types/settings';
import { useLanguage } from '../contexts/LanguageContext';

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const {
    settings, updateTheme, updateLanguage, updateLayoutType, updateFontSize, updateTableStyle, resetSettings,
  } = useSettingsStore();
  const { getSettings, updateSettings } = useNotificationStore();

  const t = useLanguage();
  const theme = settings.theme;
  const themeColors = themeConfigs[theme];

  const [notificationSettings, setNotificationSettings] = useState(getSettings(user?.id || ''));
  const [webPermissionRequested, setWebPermissionRequested] = useState(false);

  useEffect(() => {
    if (user) setNotificationSettings(getSettings(user.id));
  }, [user, getSettings]);

  const handleNotificationSettingChange = (key: keyof typeof notificationSettings.notificationTypes, value: boolean) => {
    if (!user) return;
    const newSettings = { ...notificationSettings, notificationTypes: { ...notificationSettings.notificationTypes, [key]: value } };
    setNotificationSettings(newSettings);
    updateSettings(user.id, newSettings);
  };

  const handleChannelChange = (channel: 'emailEnabled' | 'webEnabled', value: boolean) => {
    if (!user) return;
    if (channel === 'webEnabled' && value && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            const newSettings = { ...notificationSettings, [channel]: value };
            setNotificationSettings(newSettings);
            updateSettings(user.id, newSettings);
            setWebPermissionRequested(true);
          }
        });
        return;
      }
    }
    const newSettings = { ...notificationSettings, [channel]: value };
    setNotificationSettings(newSettings);
    updateSettings(user.id, newSettings);

    // 이메일 알림 설정은 백엔드 User 엔티티와 동기화
    if (channel === 'emailEnabled') {
      const token = useAuthStore.getState().token;
      if (token) {
        fetch(`${import.meta.env.VITE_API_URL}/users/me/email-notification`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailEnabled: value }),
        }).catch((err) => console.error('[Settings] 이메일 알림 설정 동기화 실패:', err));
      }
    }
  };

  const themes: { value: Theme; labelKey: string; colors: string }[] = [
    { value: 'light', labelKey: 'light', colors: 'from-slate-100 to-slate-200' },
    { value: 'dark', labelKey: 'dark', colors: 'from-slate-800 to-slate-900' },
  ];

  const languages: { value: Language; label: string; flag: string }[] = [
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
  ];

  const layoutTypes: { value: LayoutType; labelKey: string; icon: typeof Layout }[] = [
    { value: 'sidebar', labelKey: 'sidebar', icon: Layout },
    { value: 'tabs', labelKey: 'tabs', icon: Minimize2 },
  ];

  const activeStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? `${themeColors.primary}10` : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
    border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: themeColors.text }}>{t('settings')}</h1>
          <p className="mt-1 text-sm" style={{ color: themeColors.textSecondary }}>
            {t('manageAppSettings')}
          </p>
        </div>
        <button
          onClick={resetSettings}
          className="flex items-center gap-1.5 px-4 rounded-lg font-semibold text-sm transition-all"
          style={{
            height: '36px',
            backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            color: themeColors.text,
            border: `1px solid ${themeColors.border}`
          }}
        >
          <RotateCcw size={15} />
          <span>{t('resetToDefault')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme */}
        <div className="rounded p-6" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Palette size={16} style={{ color: themeColors.textSecondary }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('theme')}</h2>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('selectColorTheme')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((themeOption) => {
              const isActive = settings.theme === themeOption.value;
              return (
                <button
                  key={themeOption.value}
                  onClick={() => updateTheme(themeOption.value)}
                  className="relative p-4 rounded transition-colors"
                  style={activeStyle(isActive)}
                >
                  <div className={`w-full h-10 rounded bg-gradient-to-br ${themeOption.colors} mb-2`} />
                  <p className="text-sm font-medium" style={{ color: themeColors.text }}>{t(themeOption.labelKey)}</p>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: themeColors.primary }}>
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language */}
        <div className="rounded p-6" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Globe size={16} style={{ color: themeColors.textSecondary }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('language')}</h2>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('selectLanguage')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {languages.map((lang) => {
              const isActive = lang.value === settings.language;
              return (
                <button
                  key={lang.value}
                  onClick={() => updateLanguage(lang.value)}
                  className="w-full flex items-center justify-between p-3 rounded transition-opacity hover:opacity-80"
                  style={{
                    ...activeStyle(isActive),
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-sm font-medium" style={{ color: themeColors.text }}>{lang.label}</span>
                  </div>
                  {isActive && <Check size={16} style={{ color: themeColors.primary }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout */}
        <div className="rounded p-6" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Layout size={16} style={{ color: themeColors.textSecondary }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('layout')}</h2>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('selectLayout')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {layoutTypes.map((layout) => {
              const isActive = settings.layoutType === layout.value;
              return (
                <button
                  key={layout.value}
                  onClick={() => updateLayoutType(layout.value)}
                  className="relative p-5 rounded transition-colors"
                  style={activeStyle(isActive)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <layout.icon size={28} style={{ color: isActive ? themeColors.primary : themeColors.textSecondary }} />
                    <span className="text-sm font-medium" style={{ color: themeColors.text }}>{t(layout.labelKey)}</span>
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: themeColors.primary }}>
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size */}
        <div className="rounded p-6" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Type size={16} style={{ color: themeColors.textSecondary }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('fontSize')}</h2>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('selectFontSize')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {(['small', 'medium', 'large'] as const).map((size) => {
              const isActive = settings.fontSize === size;
              const label = t(size);
              return (
                <button
                  key={size}
                  onClick={() => updateFontSize(size)}
                  className="w-full flex items-center justify-between p-3 rounded transition-colors"
                  style={activeStyle(isActive)}
                >
                  <span className={`font-medium ${size === 'small' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-base'}`} style={{ color: themeColors.text }}>
                    {label}
                  </span>
                  {isActive && <Check size={16} style={{ color: themeColors.primary }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Style */}
        <div className="rounded p-6" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Table2 size={16} style={{ color: themeColors.textSecondary }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('tableStyle')}</h2>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('tableStyleDescription')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'card' as TableStyle, labelKey: 'tableStyleCard', descKey: 'tableStyleCardDesc' },
              { value: 'flat' as TableStyle, labelKey: 'tableStyleFlat', descKey: 'tableStyleFlatDesc' },
            ]).map((style) => {
              const isActive = settings.tableStyle === style.value;
              return (
                <button
                  key={style.value}
                  onClick={() => updateTableStyle(style.value)}
                  className="relative p-4 rounded transition-colors text-left"
                  style={activeStyle(isActive)}
                >
                  {/* Preview SVG */}
                  <div className="mb-3 rounded overflow-hidden" style={{ border: `1px solid ${themeColors.border}` }}>
                    {style.value === 'card' ? (
                      <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
                        <rect width="120" height="60" fill={themeColors.surface} />
                        <rect x="6" y="6" width="108" height="48" rx="3" fill={theme !== 'light' ? 'rgba(255,255,255,0.04)' : '#F7F6F3'} stroke={themeColors.border} strokeWidth="0.8" />
                        <rect x="6" y="6" width="108" height="13" rx="3" fill={theme !== 'light' ? 'rgba(255,255,255,0.06)' : '#EEECE9'} />
                        <rect x="6" y="18" width="108" height="0.8" fill={themeColors.border} />
                        <rect x="6" y="30" width="108" height="0.8" fill={themeColors.border} />
                        <rect x="6" y="42" width="108" height="0.8" fill={themeColors.border} />
                        {[10, 22, 34, 46].map((y) => (
                          <React.Fragment key={y}>
                            <rect x="12" y={y + 2} width="30" height="5" rx="1.5" fill={themeColors.border} opacity="0.7" />
                            <rect x="48" y={y + 2} width="20" height="5" rx="1.5" fill={themeColors.border} opacity="0.5" />
                            <rect x="74" y={y + 2} width="24" height="5" rx="1.5" fill={themeColors.border} opacity="0.5" />
                          </React.Fragment>
                        ))}
                      </svg>
                    ) : (
                      <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
                        <rect width="120" height="60" fill={themeColors.surface} />
                        <rect x="0" y="13" width="120" height="0.8" fill={themeColors.border} />
                        <rect x="0" y="25" width="120" height="0.8" fill={themeColors.border} />
                        <rect x="0" y="37" width="120" height="0.8" fill={themeColors.border} />
                        <rect x="0" y="49" width="120" height="0.8" fill={themeColors.border} />
                        {[4, 16, 28, 40].map((y) => (
                          <React.Fragment key={y}>
                            <rect x="6" y={y + 2} width="30" height="5" rx="1.5" fill={themeColors.border} opacity="0.7" />
                            <rect x="42" y={y + 2} width="20" height="5" rx="1.5" fill={themeColors.border} opacity="0.5" />
                            <rect x="68" y={y + 2} width="24" height="5" rx="1.5" fill={themeColors.border} opacity="0.5" />
                          </React.Fragment>
                        ))}
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: themeColors.text }}>{t(style.labelKey)}</p>
                  <p className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>{t(style.descKey)}</p>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: themeColors.primary }}>
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded p-6 lg:col-span-2" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Bell size={16} style={{ color: themeColors.textSecondary }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('notifications')}</h2>
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('notificationChannelSettings')}</p>
            </div>
          </div>

          {/* Channels */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>{t('notificationChannel')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                className="flex items-center justify-between p-3 rounded cursor-pointer transition-colors"
                style={activeStyle(notificationSettings.emailEnabled)}
              >
                <div className="flex items-center gap-2.5">
                  <Mail size={16} style={{ color: themeColors.primary }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: themeColors.text }}>{t('email')}</p>
                    <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('emailAlert')}</p>
                  </div>
                </div>
                <input type="checkbox" checked={notificationSettings.emailEnabled}
                  onChange={(e) => handleChannelChange('emailEnabled', e.target.checked)}
                  className="w-4 h-4 rounded" style={{ accentColor: themeColors.primary }}
                />
              </label>
              <label
                className="flex items-center justify-between p-3 rounded cursor-pointer transition-colors"
                style={activeStyle(notificationSettings.webEnabled)}
              >
                <div className="flex items-center gap-2.5">
                  <WebIcon size={16} style={{ color: themeColors.primary }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: themeColors.text }}>{t('webNotification')}</p>
                    <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('browserNotification')}</p>
                  </div>
                </div>
                <input type="checkbox" checked={notificationSettings.webEnabled}
                  onChange={(e) => handleChannelChange('webEnabled', e.target.checked)}
                  className="w-4 h-4 rounded" style={{ accentColor: themeColors.primary }}
                />
              </label>
            </div>
          </div>

          {/* Notification Types */}
          <div>
            <h3 className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>{t('notificationEvents')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { key: 'maintenanceCreated' as const, labelKey: 'maintenanceCreated', descKey: 'maintenanceCreatedDesc' },
                { key: 'maintenanceAssigned' as const, labelKey: 'taskAssigned', descKey: 'taskAssignedDesc' },
                { key: 'maintenanceStatusChanged' as const, labelKey: 'statusChange', descKey: 'statusChangeDesc' },
                { key: 'maintenanceCompleted' as const, labelKey: 'taskCompleted', descKey: 'taskCompletedDesc' },
                { key: 'companyChanges' as const, labelKey: 'companyChanges', descKey: 'companyChangesDesc' },
                { key: 'systemAlerts' as const, labelKey: 'systemAlerts', descKey: 'systemAlertsDesc' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded cursor-pointer transition-colors"
                  style={activeStyle(notificationSettings.notificationTypes[item.key])}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: themeColors.text }}>{t(item.labelKey)}</p>
                    <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t(item.descKey)}</p>
                  </div>
                  <input type="checkbox"
                    checked={notificationSettings.notificationTypes[item.key]}
                    onChange={(e) => handleNotificationSettingChange(item.key, e.target.checked)}
                    className="w-4 h-4 rounded ml-3 flex-shrink-0" style={{ accentColor: themeColors.primary }}
                  />
                </label>
              ))}
            </div>
          </div>

          {webPermissionRequested && (
            <div className="mt-4 p-3 rounded flex items-center gap-2.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <Check size={16} className="text-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-600">{t('webNotificationEnabled')}</p>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('webNotificationEnabledDesc')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
