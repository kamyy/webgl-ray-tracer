import React from 'react';

import { 
    bindActionCreators 
}   from 'redux';

import { 
    connect 
}   from 'react-redux';

import {
    setNumSamples,
    setNumBounces,
    setCameraFov,
}   from '../redux/actions.js';

const minSamples = 1;
const maxSamples = 1000;
const minBounces = 1;
const maxBounces = 32;
const minCameraFov = 5;
const maxCameraFov = 90;

function Params(props) {
    const { 
        numSamples,
        numBounces,
        cameraFov,
        setNumSamples,
        setNumBounces,
        setCameraFov,
    } = props;

    return <fieldset><legend>Parameters</legend>
        <span># of Rays Per Pixel</span>
        <span>
            <input
                type='number' 
                min={minSamples} 
                max={maxSamples} 
                value={numSamples}
                onChange={event => setNumSamples(event.target.value)}
            />
        </span>
        <span># of Ray Bounces</span>
        <span>
            <input
                type='number'
                min={minBounces}
                max={maxBounces}
                value={numBounces}
                onChange={event => setNumBounces(event.target.value)}
            />
        </span>
        <span>Camera Field of View</span>
        <span>
            <input
                type='number'
                min={minCameraFov}
                max={maxCameraFov}
                value={cameraFov}
                onChange={event => setCameraFov(event.target.value)}
            />
        </span>

        {/*
        <span id='Clear' onClick={event => onChangeMaterialFilter(curSceneId, '')}>&times;</span>
        */}
    </fieldset>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov:  state.cameraFov,
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({ 
        setNumSamples,
        setNumBounces,
        setCameraFov,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Params);
