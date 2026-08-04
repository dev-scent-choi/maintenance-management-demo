import React, { createContext, useContext, useState } from 'react';

interface PageRefreshContextValue {
  refreshKey: number;
  triggerRefresh: () => void;
}

const PageRefreshContext = createContext<PageRefreshContextValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export const PageRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <PageRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </PageRefreshContext.Provider>
  );
};

export const usePageRefresh = () => useContext(PageRefreshContext);
