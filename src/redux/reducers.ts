import { createStore, combineReducers } from 'redux';

import {
    ActionType,
    SpinnerState,
    ShadingMethod,
    ISceneAction,
    ILoadStatusAction,
    INumSamplesAction,
    INumBouncesAction,
    ICameraFovAction,
    IShadingMethodAction,
    IRenderingPassAction,
    IElapsedTimeAction,
    IEtaTimeAction,
    IAvgTimeAction,
}   from './actions'

import Scene from '../texture/Scene'

// ----------------------------------------------------------------
// default states
//
const defaultLoadStatus    = SpinnerState.SHOW;
const defaultNumSamples    = 100;
const defaultNumBounces    = 12;
const defaultCameraFov     = 45;
const defaultShadingMethod = ShadingMethod.FLAT;
const defaultRenderingPass = 0;
const defaultElapsedTime   = '00:00:00';
const defaultEtaTime = '??:??:??';
const defaultAvgTime = '????';

// ----------------------------------------------------------------
// reducers
//
function scene(state: Scene | null = null, action: ISceneAction) {
    if (action.type === ActionType.SET_SCENE) {
        return action.scene;
    }
    return state;
}

function loadStatus(state: number = defaultLoadStatus, action: ILoadStatusAction) {
    if (action.type === ActionType.SET_LOAD_STATUS) {
        return action.loadStatus;
    }
    return state;
}

function numSamples(state: number = defaultNumSamples, action: INumSamplesAction) {
    if (action.type === ActionType.SET_NUM_SAMPLES) {
        return action.numSamples;
    }
    return state;
}

function numBounces(state: number = defaultNumBounces, action: INumBouncesAction) {
    if (action.type === ActionType.SET_NUM_BOUNCES) {
        return action.numBounces;
    }
    return state;
}

function cameraFov(state: number = defaultCameraFov, action: ICameraFovAction) {
    if (action.type === ActionType.SET_CAMERA_FOV) {
        return action.cameraFov;
    }
    return state;
}

function shadingMethod(state: number = defaultShadingMethod, action: IShadingMethodAction) {
    if (action.type === ActionType.SET_SHADING_METHOD) {
        return action.shadingMethod;
    }
    return state;
}

function renderingPass(state: number = defaultRenderingPass, action: IRenderingPassAction) {
    if (action.type === ActionType.SET_RENDERING_PASS) {
        return action.renderingPass;
    }
    return state;
}

function elapsedTime(state: string = defaultElapsedTime, action: IElapsedTimeAction) {
    if (action.type === ActionType.SET_ELAPSED_TIME) {
        return action.elapsedTime;
    }
    return state;
}

function etaTime(state: string = defaultEtaTime, action: IEtaTimeAction) {
    if (action.type === ActionType.SET_ETA_TIME) {
        return action.etaTime;
    }
    return state;
}

function avgTime(state: string = defaultAvgTime, action: IAvgTimeAction) {
    if (action.type === ActionType.SET_AVG_TIME) {
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
