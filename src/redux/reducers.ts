import { combineReducers, createStore } from "redux";
import Scene from "../texture/Scene";
import {
  FLAT_SHADING,
  setAvgTimeResult,
  setCameraFovResult,
  setElapsedTimeResult,
  setEtaTimeResult,
  setLoadStatusResult,
  setNumBouncesResult,
  setNumSamplesResult,
  setRenderingPassResult,
  setSceneResult,
  setShadingMethodResult,
  SET_AVG_TIME,
  SET_CAMERA_FOV,
  SET_ELAPSED_TIME,
  SET_ETA_TIME,
  SET_LOAD_STATUS,
  SET_NUM_BOUNCES,
  SET_NUM_SAMPLES,
  SET_RENDERING_PASS,
  SET_SCENE,
  SET_SHADING_METHOD,
  SPINNER_SHOW,
} from "./actions";

// ----------------------------------------------------------------
// default states
//
const defaultScene = null;
const defaultLoadStatus = SPINNER_SHOW;
const defaultNumSamples = 100;
const defaultNumBounces = 12;
const defaultCameraFov = 45;
const defaultShadingMethod = FLAT_SHADING;
const defaultRenderingPass = 0;
const defaultElapsedTime = "";
const defaultEtaTime = "";
const defaultAvgTime = "";

// ----------------------------------------------------------------
// reducers
//

function scene(state: Scene | null = defaultScene, action: setSceneResult) {
  if (action.type === SET_SCENE) {
    return action.scene;
  }
  return state;
}

function loadStatus(state = defaultLoadStatus, action: setLoadStatusResult) {
  if (action.type === SET_LOAD_STATUS) {
    return action.loadStatus;
  }
  return state;
}

function numSamples(state = defaultNumSamples, action: setNumSamplesResult) {
  if (action.type === SET_NUM_SAMPLES) {
    return action.numSamples;
  }
  return state;
}

function numBounces(state = defaultNumBounces, action: setNumBouncesResult) {
  if (action.type === SET_NUM_BOUNCES) {
    return action.numBounces;
  }
  return state;
}

function cameraFov(state = defaultCameraFov, action: setCameraFovResult) {
  if (action.type === SET_CAMERA_FOV) {
    return action.cameraFov;
  }
  return state;
}

function shadingMethod(state = defaultShadingMethod, action: setShadingMethodResult) {
  if (action.type === SET_SHADING_METHOD) {
    return action.shadingMethod;
  }
  return state;
}

function renderingPass(state = defaultRenderingPass, action: setRenderingPassResult) {
  if (action.type === SET_RENDERING_PASS) {
    return action.renderingPass;
  }
  return state;
}

function elapsedTime(state = defaultElapsedTime, action: setElapsedTimeResult) {
  if (action.type === SET_ELAPSED_TIME) {
    return action.elapsedTime;
  }
  return state;
}

function etaTime(state = defaultEtaTime, action: setEtaTimeResult) {
  if (action.type === SET_ETA_TIME) {
    return action.etaTime;
  }
  return state;
}

function avgTime(state = defaultAvgTime, action: setAvgTimeResult) {
  if (action.type === SET_AVG_TIME) {
    return action.avgTime;
  }
  return state;
}

// ----------------------------------------------------------------
// redux store
//

export const reduxStore = createStore(
  combineReducers({
    scene,
    loadStatus,
    numSamples,
    numBounces,
    cameraFov,
    shadingMethod,
    renderingPass,
    elapsedTime,
    etaTime,
    avgTime,
  })
);

export type RootState = ReturnType<typeof reduxStore.getState>;
