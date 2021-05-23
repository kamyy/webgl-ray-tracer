import {
  createStore,
  combineReducers,
} from 'redux';

import {
  SET_SCENE,
  SET_LOAD_STATUS,
  SET_NUM_SAMPLES,
  SET_NUM_BOUNCES,
  SET_CAMERA_FOV,
  SET_SHADING_METHOD,
  SET_RENDERING_PASS,
  SET_ELAPSED_TIME,
  SET_ETA_TIME,
  SET_AVG_TIME,

  SPINNER_SHOW,
  FLAT_SHADING,
} from './actions.js';

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
const defaultElapsedTime = 0;
const defaultEtaTime = 0;
const defaultAvgTime = 0;

// ----------------------------------------------------------------
// reducers
//

function scene(state = defaultScene, action) {
  if (action.type === SET_SCENE) {
    return action.scene;
  }
  return state;
}

function loadStatus(state = defaultLoadStatus, action) {
  if (action.type === SET_LOAD_STATUS) {
    return action.loadStatus;
  }
  return state;
}

function numSamples(state = defaultNumSamples, action) {
  if (action.type === SET_NUM_SAMPLES) {
    return action.numSamples;
  }
  return state;
}

function numBounces(state = defaultNumBounces, action) {
  if (action.type === SET_NUM_BOUNCES) {
    return action.numBounces;
  }
  return state;
}

function cameraFov(state = defaultCameraFov, action) {
  if (action.type === SET_CAMERA_FOV) {
    return action.cameraFov;
  }
  return state;
}

function shadingMethod(state = defaultShadingMethod, action) {
  if (action.type === SET_SHADING_METHOD) {
    return action.shadingMethod;
  }
  return state;
}

function renderingPass(state = defaultRenderingPass, action) {
  if (action.type === SET_RENDERING_PASS) {
    return action.renderingPass;
  }
  return state;
}

function elapsedTime(state = defaultElapsedTime, action) {
  if (action.type === SET_ELAPSED_TIME) {
    return action.elapsedTime;
  }
  return state;
}

function etaTime(state = defaultEtaTime, action) {
  if (action.type === SET_ETA_TIME) {
    return action.etaTime;
  }
  return state;
}

function avgTime(state = defaultAvgTime, action) {
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
  }),
);
