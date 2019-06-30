import React from 'react';
import {
    bindActionCreators
}   from 'redux';

import {
    connect
}   from 'react-redux';

import {
    css
}   from 'emotion'

import {
    setNumSamples,
    setNumBounces,
    setCameraFov,
    setShading,

    FLAT_SHADING,
    PHONG_SHADING,
}   from '../redux/actions.js';

const minSamples = 1;
const maxSamples = 1000;
const minBounces = 1;
const maxBounces = 16;
const minCameraFov = 5;
const maxCameraFov = 90;

function Params(props) {
    return <fieldset>
        <legend>Rendering Controls</legend>

        <div className={css`
            display: flex;
            flex-direction: row;
            align-items: flex-start;
        `}>
            <div className={css`
                display: flex;
                flex-direction: column;
                flex-grow: 2;
                margin: 5px 10px;
            `}>
                <label htmlFor='cameraFov'>Camera Field of View</label>
                <input type='range' id='cameraFov'
                    min={minCameraFov}
                    max={maxCameraFov}
                    value={props.cameraFov}
                    onChange={event => props.setCameraFov(parseInt(event.target.value))}
                />

                <label htmlFor='numSamples'># of Samples Per Pixel</label>
                <input type='range' id='numSamples'
                    min={minSamples}
                    max={maxSamples}
                    value={props.numSamples}
                    onChange={event => props.setNumSamples(parseInt(event.target.value))}
                />

                <label htmlFor='numBounces'># of Ray Bounces</label>
                <input type='range' id='numBounces'
                    min={minBounces}
                    max={maxBounces}
                    value={props.numBounces}
                    onChange={event => props.setNumBounces(parseInt(event.target.value))}
                />
            </div>

            <fieldset className={css`
                flex-grow: 0;
                margin: 5px 10px;
                border-style: none none none solid;
            `}>
                <legend>Shading Technique</legend>

                <div className={css`
                    display: flex;
                    flex-direction: row;
                    justify-content: space-evenly;
                `}>
                    <label>
                        <input type='radio'
                            value={FLAT_SHADING}
                            checked={props.shading === FLAT_SHADING}
                            onChange={event => props.setShading(parseInt(event.target.value))}
                        />
                        Flat
                    </label>

                    <label>
                        <input type='radio'
                            value={PHONG_SHADING}
                            checked={props.shading === PHONG_SHADING}
                            onChange={event => props.setShading(parseInt(event.target.value))}
                        />
                        Phong
                    </label>
                </div>
            </fieldset>
        </div>
    </fieldset>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov:  state.cameraFov,
        shading:    state.shading,
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({
        setNumSamples,
        setNumBounces,
        setCameraFov,
        setShading,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Params);
