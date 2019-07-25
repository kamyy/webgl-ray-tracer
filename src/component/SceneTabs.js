// @flow

import React from 'react';

import {
    reduxStore
}   from '../redux/reducers.js';

import {
    cx,
    css
}   from 'emotion';

import {
    SCENE_UNINITIALIZED,
    SCENE_INITIALIZING,
    SCENE_INITIALIZED,
}   from '../texture/Scene.js';

import {
    setScene,
    setLoadStatus,

    SPINNER_SHOW,
    SPINNER_HIDE,
    LOAD_FAILURE,
}   from '../redux/actions.js';

import Scene from '../texture/Scene.js';

const cssTabBar = css`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    margin-top: 8px;
    border-style: none;
`
const cssSelectedTabButton = css`
    border-style: none ridge solid none;
    border-radius: 5px 5px 0px 0px;
    border-bottom-color: darkgreen;
    padding: 8px 24px;
    &:focus {
        outline: 0;
    }
    font-family: 'Roboto';
    font-weight: bold;
    font-size: 12px;
`
const cssUnselectedTabButton = css`
    border-style: none ridge none none;
    border-radius: 5px 5px 0px 0px;
    border-bottom-color: lightgray;
    padding: 8px 24px;
    &:focus {
        background-color: lightgray;
        outline: 0;
    }
    font-family: 'Roboto';
    font-weight: bold;
    font-size: 12px;
`

const scenes = [
    null,
    null,
    null,
];

export function createScenes(GL: WebGL2RenderingContext) {
    scenes[0] = new Scene(GL, '/suzanne.obj', '/suzanne.mtl');
    scenes[1] = new Scene(GL, '/suzanne.obj', '/suzanne.mtl');
    scenes[2] = new Scene(GL, '/suzanne.obj', '/suzanne.mtl');

    scenes[0].init().then(() => reduxStore.dispatch(setLoadStatus(SPINNER_HIDE)));
    reduxStore.dispatch(setLoadStatus(SPINNER_SHOW));
    reduxStore.dispatch(setScene(scenes[0]));
}

function onClick(index: number) {
    const scene = scenes[index];

    if (scene && scene !== reduxStore.getState().scene) {
        switch (scene.sceneStatus) {
        case SCENE_UNINITIALIZED:
            scene.init().then(scene => {
                if (scene === reduxStore.getState().scene) {
                    reduxStore.dispatch(setLoadStatus(SPINNER_HIDE))
                }
            });
            reduxStore.dispatch(setLoadStatus(SPINNER_SHOW));
            reduxStore.dispatch(setScene(scene));
            break;
        case SCENE_INITIALIZING:
            reduxStore.dispatch(setLoadStatus(SPINNER_SHOW));
            reduxStore.dispatch(setScene(scene));
            break;
        case SCENE_INITIALIZED:
            reduxStore.dispatch(setLoadStatus(SPINNER_HIDE));
            reduxStore.dispatch(setScene(scene));
            break;
        default:
            break;
        }
    }
}

export default function SceneTabs(props: {}) {
    const scene = reduxStore.getState().scene;
    const styleTabButton0 = scene === scenes[0] ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);
    const styleTabButton1 = scene === scenes[1] ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);
    const styleTabButton2 = scene === scenes[2] ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);

    let spinner;

    switch (reduxStore.getState().loadStatus) {
    case LOAD_FAILURE:
        spinner = <h1>*** Error! WebGL 2 not supported or GPU does not meet minimum requirements! ***</h1>
        break;
    case SPINNER_SHOW:
        spinner = <div className='spinner'/>;
        break;
    case SPINNER_HIDE:
    default:
        spinner = null;
        break;
    }

    return <div> {spinner}
        <div className={cx(cssTabBar)}>
            <button type='button' className={styleTabButton0} onClick={() => onClick(0)}>
                Suzanne
            </button>

            <button type='button' className={styleTabButton1} onClick={() => onClick(1)}>
                Marble
            </button>

            <button type='button' className={styleTabButton2} onClick={() => onClick(2)}>
                Fog
            </button>
        </div>
    </div>
}
