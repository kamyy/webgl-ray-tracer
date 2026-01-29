import { configureStore } from '@reduxjs/toolkit';
import { appReducer } from './appSlice';

export function makeStore() {
  return configureStore({
    reducer: appReducer,
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
