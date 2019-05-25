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
}   from '../redux/actions.js';

const minSamples = 1;
const maxSamples = 1000;
const minBounces = 1;
const maxBounces = 32;

function Params(props) {
    const { 
        numSamples,
        numBounces,
        setNumSamples,
        setNumBounces,
    } = props;

    return <fieldset><legend>Ray Trace Parameters</legend>
        <span>Number of Rays Per Pixel</span>
        <span>
            <input
                type='number' 
                min={minSamples} 
                max={maxSamples} 
                value={numSamples}
                onChange={event => setNumSamples(event.target.value)}
            />
        </span>
        <span>Number of Ray Bounces</span>
        <span>
            <input
                type='number'
                min={minBounces}
                max={maxBounces}
                value={numBounces}
                onChange={event => setNumBounces(event.target.value)}
            />
        </span>
        <span>
            <button>Apply</button>
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
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({ 
        setNumSamples,
        setNumBounces,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Params);
