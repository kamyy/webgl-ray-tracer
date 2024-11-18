import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export enum LoadingSpinner {
  show,
  hide,
  fail,
}
export enum ShadingMethod {
  flat,
  phong,
}

interface AppState {
  readonly loadingSpinner: LoadingSpinner;
  readonly shadingMethod: ShadingMethod;
  readonly renderingPass: number;
  readonly numSamples: number;
  readonly numBounces: number;
  readonly cameraFov: number;
  readonly elapsedTime: string;
  readonly etaTime: string;
  readonly avgTime: string;
}

export const initialAppState: AppState = {
  loadingSpinner: LoadingSpinner.hide,
  shadingMethod: ShadingMethod.flat,
  renderingPass: 0,
  numSamples: 10,
  numBounces: 6,
  cameraFov: 45,
  elapsedTime: '',
  etaTime: '',
  avgTime: '',
};

export const appSlice = createSlice({
  name: 'appSlice',
  initialState: initialAppState,
  reducers: {
    setLoadingSpinner(state, action: PayloadAction<LoadingSpinner>) {
      state.loadingSpinner = action.payload;
    },

    setShadingMethod(state, action: PayloadAction<ShadingMethod>) {
      state.shadingMethod = action.payload;
    },

    setRenderingPass(state, action: PayloadAction<number>) {
      state.renderingPass = action.payload;
    },

    setNumSamples(state, action: PayloadAction<number>) {
      state.numSamples = action.payload;
    },

    setNumBounces(state, action: PayloadAction<number>) {
      state.numBounces = action.payload;
    },

    setCameraFov(state, action: PayloadAction<number>) {
      state.cameraFov = action.payload;
    },

    setElapsedTime(state, action: PayloadAction<string>) {
      state.elapsedTime = action.payload;
    },

    setEtaTime(state, action: PayloadAction<string>) {
      state.etaTime = action.payload;
    },

    setAvgTime(state, action: PayloadAction<string>) {
      state.avgTime = action.payload;
    },
  },
});

export const appReducer = appSlice.reducer;
export const appActions = appSlice.actions;
