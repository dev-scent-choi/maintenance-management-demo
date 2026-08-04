import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import SidebarLayout from './SidebarLayout';
import TabLayout from './TabLayout';

const Layout: React.FC = () => {
  const layoutType = useSettingsStore((state) => state.settings.layoutType);

  return layoutType === 'sidebar' ? <SidebarLayout /> : <TabLayout />;
};

export default Layout;