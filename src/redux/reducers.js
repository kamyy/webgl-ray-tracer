import Sphere from '../math/Sphere.js';
import Vector1x4 from '../math/Vector1x4.js';

import MetallicMaterial from '../rendering/MetallicMaterial.js';
import LambertianMaterial from '../rendering/LambertianMaterial.js';
import DielectricMaterial from '../rendering/DielectricMaterial.js';

import { 
    createStore,
    combineReducers
}   from 'redux';

import {
    SET_NUM_SAMPLES,
    SET_NUM_BOUNCES,
    SET_CAMERA_FOV,
    CREATE_MATERIAL,
    REMOVE_MATERIAL,
    CREATE_SPHERE,
    REMOVE_SPHERE,
    INSERT_SCENE,
    CHANGE_SCENE,
}   from './actions.js'

// ----------------------------------------------------------------
// default states
//
const defaultNumSamples = 2;
const defaultNumBounces = 2;
const defaultCameraFov  = 30;

const defaultMaterials = [
    new MetallicMaterial(
        'Metal 0',
        new Vector1x4(0.9, 0.9, 0.9), 
        0.95,
    ),
    new LambertianMaterial(
        'Matte 0',
        new Vector1x4(0.4, 0.4, 0.8)
    ),
    new LambertianMaterial(
        'Matte 1',
        new Vector1x4(0.5, 0.1, 0.1)
    ),
    new LambertianMaterial(
        'Matte 2',
        new Vector1x4(0.8, 0.1, 0.8)
    ),
    new DielectricMaterial(
        'Glass 0',
        new Vector1x4(1.0, 1.0, 1.0), 
        1.33
    ),
];

const defaultSpheres = [
    new Sphere( 
        'Jupiter',
        new Vector1x4(0.0, 1300.0, -900.0), 
        900.0, 
        'Matte 1'
    ),
    new Sphere( 
        'Saturn',
        new Vector1x4(-20.0, 1000.0, 30.0), 
        80.0, 
        'Matte 2'
    ),
    new Sphere( 
        'Venus',
        new Vector1x4(-200.0, 800.0, -80.0), 
        60.0, 
        'Metal 0'
    ),
    new Sphere(
        'Pluto',
        new Vector1x4(30.0, 400.0, 0.0), 
        40.0, 
        'Glass 0'
    ),
    new Sphere(
        'Mercury',
        new Vector1x4(300.0, 900.0, 10.0), 
        90.0, 
        'Matte 0'
    ),
];

const defaultScenes = [ 
];

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

function materials(state = defaultMaterials, action) {
    switch (action.type) {
    case CREATE_MATERIAL:
    case REMOVE_MATERIAL:
    default:
        return state;
    }
}

function spheres(state = defaultSpheres, action) {
    switch (action.type) {
    case CREATE_SPHERE:
        return [ ...state, new Sphere(action.id, action.center, action.radius, action.materialId) ];
    case REMOVE_SPHERE:
        return state.filter(sphere => sphere.id !== action.id);
    default:
        return state;
    }
}

function scenes(state = defaultScenes, action) {
    switch(action.type) {
    case INSERT_SCENE:
        return state;
    case CHANGE_SCENE:
        return state;
    default:
        return state;
    }
};

// ----------------------------------------------------------------
// redux store
//
export const reduxStore = createStore(
    combineReducers({ numSamples, numBounces, cameraFov, materials, spheres, scenes })
);
