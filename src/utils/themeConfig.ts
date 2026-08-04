import type { Theme } from '../types/settings';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActive: string;
  card: string;
  cardHover: string;
  primaryTint: string;
}

export const themeConfigs: Record<Theme, ThemeColors> = {
  // Notion Light — green accent
  light: {
    primary: '#2F9E44',
    secondary: '#2B8A3E',
    accent: '#40C057',
    background: '#F9F9F8',
    surface: '#FFFFFF',
    text: '#37352F',
    textSecondary: '#787774',
    border: 'rgba(55, 53, 47, 0.12)',
    sidebarBg: '#F7F6F3',
    sidebarText: '#787774',
    sidebarActive: '#37352F',
    card: '#FFFFFF',
    cardHover: 'rgba(55, 53, 47, 0.03)',
    primaryTint: 'rgba(47, 158, 68, 0.08)',
  },
  // GitHub Dark
  dark: {
    primary: '#3B82F6',
    secondary: '#2563EB',
    accent: '#60A5FA',
    background: '#0D1117',
    surface: '#161B22',
    text: '#E6EDF3',
    textSecondary: '#8B949E',
    border: '#30363D',
    sidebarBg: '#0D1117',
    sidebarText: '#8B949E',
    sidebarActive: '#3B82F6',
    card: '#161B22',
    cardHover: '#21262D',
    primaryTint: 'rgba(59, 130, 246, 0.10)',
  },
  // GitHub Dark Protanopia & Deuteranopia
  yellow: {
    primary: '#E3B341',
    secondary: '#D29922',
    accent: '#F0C84C',
    background: '#0D1117',
    surface: '#161B22',
    text: '#E6EDF3',
    textSecondary: '#8B949E',
    border: '#30363D',
    sidebarBg: '#010409',
    sidebarText: '#8B949E',
    sidebarActive: '#E3B341',
    card: '#161B22',
    cardHover: '#1C2128',
    primaryTint: 'rgba(227, 179, 65, 0.10)',
  },
};

export const applyTheme = (theme: Theme) => {
  const config = themeConfigs[theme];
  const root = document.documentElement;

  // CSS 변수 적용
  root.style.setProperty('--color-primary', config.primary);
  root.style.setProperty('--color-secondary', config.secondary);
  root.style.setProperty('--color-accent', config.accent);
  root.style.setProperty('--color-background', config.background);
  root.style.setProperty('--color-surface', config.surface);
  root.style.setProperty('--color-text', config.text);
  root.style.setProperty('--color-text-secondary', config.textSecondary);
  root.style.setProperty('--color-border', config.border);

  // body 배경색 적용
  document.body.style.backgroundColor = config.background;
};
