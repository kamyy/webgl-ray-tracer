import React from 'react';
import {
    bindActionCreators
}   from 'redux';

import {
    connect
}   from 'react-redux';

import {
    cx,
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
    const renderingControlsClass = css`
        display: flex;
        flex-direction: row;
        align-items: flex-start;
    `
    const rangeControlsClass  = css`
        display: flex;
        flex-direction: column;
        flex-grow: 2;
        margin: 5px 10px;
    `
    const rangeControlClass  = css`
        display: flex;
        flex-direction: row;
        padding-bottom: 10px;
    `
    const rangeInputMinLabelClass = css`
        flex-basis: 5%;
        text-align: right;
        padding-right: 10px;
    `
    const rangeInputMaxLabelClass = css`
        flex-basis: 10%;
        text-align: left;
        padding-left: 10px;
    `
    const rangeInputClass = css`
        flex-basis: 85%;
    `
    const shadingTechniquesClass = css`
        margin: 5px 0px;
        border-style: none none none solid;
    `
    const shadingRadioButtonsClass = css`
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
    `

    return <fieldset>
        <legend>Rendering Controls</legend>

        <div className={cx(renderingControlsClass)}>
            <div className={cx(rangeControlsClass)}>

                <label htmlFor='cameraFov'>Camera Field of View</label>

                <div className={cx(rangeControlClass)}>
                    <label className={cx(rangeInputMinLabelClass)}>{minCameraFov}</label>
                    <input type='range' className={cx(rangeInputClass)}
                        min={minCameraFov}
                        max={maxCameraFov}
                        value={props.cameraFov}
                        onChange={event => props.setCameraFov(parseInt(event.target.value))}
                    />
                    <label className={cx(rangeInputMaxLabelClass)}>{maxCameraFov}</label>
                </div>

                <label htmlFor='numSamples'># of Samples Per Pixel</label>

                <div className={cx(rangeControlClass)}>
                    <label className={cx(rangeInputMinLabelClass)}>{minSamples}</label>
                    <input type='range' className={cx(rangeInputClass)}
                        min={minSamples}
                        max={maxSamples}
                        value={props.numSamples}
                        onChange={event => props.setNumSamples(parseInt(event.target.value))}
                    />
                    <label className={cx(rangeInputMaxLabelClass)}>{maxSamples}</label>
                </div>

                <label htmlFor='numBounces'># of Ray Bounces</label>

                <div className={cx(rangeControlClass)}>
                    <label className={cx(rangeInputMinLabelClass)}>{minBounces}</label>
                    <input type='range' className={cx(rangeInputClass)}
                        min={minBounces}
                        max={maxBounces}
                        value={props.numBounces}
                        onChange={event => props.setNumBounces(parseInt(event.target.value))}
                    />
                    <label className={cx(rangeInputMaxLabelClass)}>{maxBounces}</label>
                </div>
            </div>

            <fieldset className={cx(shadingTechniquesClass)}>
                <legend>Shading Technique</legend>

                <div className={cx(shadingRadioButtonsClass)}>
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
