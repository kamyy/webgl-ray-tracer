import {
    createStore,
    combineReducers
}   from 'redux';

import {
    SET_NUM_SAMPLES,
    SET_NUM_BOUNCES,
    SET_CAMERA_FOV,
}   from './actions.js'

// ----------------------------------------------------------------
// default states
//
const defaultNumSamples = 100;
const defaultNumBounces = 2;
const defaultCameraFov  = 30;

// ----------------------------------------------------------------
// reducers
//
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

// ----------------------------------------------------------------
// redux store
//
export const reduxStore = createStore(
    combineReducers({ numSamples, numBounces, cameraFov })
);
