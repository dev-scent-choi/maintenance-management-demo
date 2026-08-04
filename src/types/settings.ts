export type Theme = 'light' | 'dark' | 'yellow';
export type Language = 'ko' | 'en';
export type LayoutType = 'sidebar' | 'tabs';
export type TableStyle = 'card' | 'flat';

export interface UserSettings {
  theme: Theme;
  language: Language;
  layoutType: LayoutType;
  fontSize: 'small' | 'medium' | 'large';
  tableStyle: TableStyle;
  companyEmail: string;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
}

export const defaultSettings: UserSettings = {
  theme: 'light',
  language: 'ko',
  layoutType: 'sidebar',
  fontSize: 'medium',
  tableStyle: 'card',
  companyEmail: '',
  notifications: {
    email: true,
    push: true,
    desktop: false,
  },
};
