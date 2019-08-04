import React from 'react';
import { cx, css } from 'emotion';

import { reduxStore } from '../redux/reducers';

import {
    SpinnerState,
    setScene,
    setLoadStatus,
}   from '../redux/actions';

import Scene, {
    SceneState,
}   from '../texture/Scene';

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
    background-color: #dddddd;
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
    background-color: #dddddd;
    &:focus {
        background-color: #dddddd;
        outline: 0;
    }
    font-family: 'Roboto';
    font-weight: bold;
    font-size: 12px;
`

const scenes: Array<Scene> = [];

export function createScenes(GL: WebGL2RenderingContext) {
    scenes[0] = new Scene(GL, '/suzanne.obj', '/suzanne.mtl');
    scenes[1] = new Scene(GL, '/crazy.obj', '/crazy.mtl');
    scenes[2] = new Scene(GL, '/suzanne.obj', '/suzanne.mtl');

    scenes[0].init().then(() => reduxStore.dispatch(setLoadStatus(SpinnerState.HIDE)));
    reduxStore.dispatch(setLoadStatus(SpinnerState.SHOW))
    reduxStore.dispatch(setScene(scenes[0]));
}

function onClick(index: number) {
    const scene = scenes[index];
    if (scene !== undefined &&
        scene !== reduxStore.getState().scene) {

        switch (scene.state) {
        case SceneState.UNINITIALIZED:
            scene.init().then(scene => {
                if (scene === reduxStore.getState().scene) {
                    reduxStore.dispatch(setLoadStatus(SpinnerState.HIDE))
                }
            });
            reduxStore.dispatch(setLoadStatus(SpinnerState.SHOW));
            reduxStore.dispatch(setScene(scene));
            break;
        case SceneState.INITIALIZING:
            reduxStore.dispatch(setLoadStatus(SpinnerState.SHOW));
            reduxStore.dispatch(setScene(scene));
            break;
        case SceneState.INITIALIZED:
            reduxStore.dispatch(setLoadStatus(SpinnerState.HIDE));
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
    case SpinnerState.FAIL:
        spinner = <h1>*** Error! WebGL 2 not supported or GPU does not meet minimum requirements! ***</h1>
        break;
    case SpinnerState.SHOW:
        spinner = <div className='spinner'/>;
        break;
    case SpinnerState.HIDE:
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
                Crazy Dog
            </button>

            <button type='button' className={styleTabButton2} onClick={() => onClick(2)}>
                Fog
            </button>
        </div>
    </div>
}
