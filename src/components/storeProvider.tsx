import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { AppStore, makeStore } from '../lib/store/store';

interface StoreProviderProps {
  children: React.ReactNode;
}

export default function StoreProvider({ children }: StoreProviderProps) {
  const store = useMemo<AppStore>(() => makeStore(), []);

  return <Provider store={store}>{children}</Provider>;
}
