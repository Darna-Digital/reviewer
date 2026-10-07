import * as React from 'react';
import type { App } from '../app/useApp';

export const AppContext = React.createContext<App | null>(null);

export function useAppContext(): App {
  const app = React.useContext(AppContext);
  if (!app)
    throw new Error('useAppContext must be used inside <AppContext.Provider>');
  return app;
}
