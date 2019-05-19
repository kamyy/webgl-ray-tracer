import Sphere from './Sphere.js';

import { 
    createStore,
    combineReducers
} from 'redux';

import {
    CREATE_SPHERE,
    REMOVE_SPHERE,
    CREATE_MATERIAL,
    REMOVE_MATERIAL
} from './actions.js'

function spheres(state = [], action) {
    switch (action.type) {
    case CREATE_SPHERE:
        return [ ...state, new Sphere(action.center, action.radius) ];
    case REMOVE_SPHERE:
        return state.filter((s, i) => i !== action.id);
    default:
        return state;
    }
}

function materials(state = [], action) {
    switch (action.type) {
    case CREATE_MATERIAL:
    case REMOVE_MATERIAL:
    default:
        return state;
    }
}

export const store = createStore(
    combineReducers({ spheres, materials })
);
