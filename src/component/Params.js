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
    setShading,

    FLAT_SHADING,
    GOURAUD_SHADING,
}   from '../redux/actions.js';

const minSamples = 1;
const maxSamples = 1000;
const minBounces = 1;
const maxBounces = 16;
const minCameraFov = 5;
const maxCameraFov = 90;

function Params(props) {
    const rangeStyle = {
        color: 'yellow',
        backgroundColor: 'black'
    };

    return <fieldset>
        <legend>Rendering Controls</legend>

        <div style={ {
            display: 'flex',
            flexDirection: 'row',
        } }>
            <div style={ {
                margin: '5px 15px 5px 15px',
                display: 'flex',
                flexDirection: 'column',
                flexGrow: '2'
            } }>
                <label htmlFor='cameraFov'>Camera Field of View</label>
                <input type='range' id='cameraFov'
                    min={minCameraFov}
                    max={maxCameraFov}
                    style={rangeStyle}
                    value={props.cameraFov}
                    onChange={event => props.setCameraFov(parseInt(event.target.value))}
                />

                <label htmlFor='numSamples'># of Samples Per Pixel</label>
                <input type='range' id='numSamples'
                    min={minSamples}
                    max={maxSamples}
                    style={rangeStyle}
                    value={props.numSamples}
                    onChange={event => props.setNumSamples(parseInt(event.target.value))}
                />

                <label htmlFor='numBounces'># of Ray Bounces</label>
                <input type='range' id='numBounces'
                    min={minBounces}
                    max={maxBounces}
                    style={rangeStyle}
                    value={props.numBounces}
                    onChange={event => props.setNumBounces(parseInt(event.target.value))}
                />
            </div>

            <fieldset style={ {
                margin: '5px 15px 15px 15px',
                borderStyle: 'none none none solid',
            } }>
                <legend>Shading</legend>

                <div style={ {
                    display: 'flex',
                    flexDirection: 'column',
                } }>
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
                            value={GOURAUD_SHADING}
                            checked={props.shading === GOURAUD_SHADING}
                            onChange={event => props.setShading(parseInt(event.target.value))}
                        />
                        Gouraud
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
