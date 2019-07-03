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
const maxSamples = 500;
const minBounces = 1;
const maxBounces = 8;
const minCameraFov = 10;
const maxCameraFov = 120;

function Params(props) {
    const cssRenderingFieldset = css`
        margin: 12px 4px;
        border-style: ridge none ridge none;
        border-width: medium;
    `
    const cssRenderingGroupDiv = css`
        display: flex;
        flex-direction: row;
        align-items: flex-start;
    `
    const cssSliderGroupsDiv = css`
        display: flex;
        flex-direction: column;
        flex-grow: 2;
        margin: 5px 0px;
    `
    const cssSliderGroupDiv = css`
        display: flex;
        flex-direction: row;
        padding-top: 5px;
        padding-bottom: 10px;
    `
    const cssMinLabel = css`
        flex-basis: 5%;
        text-align: right;
        margin-right: 10px;
    `
    const cssRangeInput = css`
        flex-basis: 85%;
    `
    const cssMaxLabel = css`
        flex-basis: 10%;
        text-align: left;
        margin-left: 10px;
    `
    const shadingTechniquesGroup = css`
        margin: 5px 0px;
        border-style: none none none ridge;
    `
    const shadingRadioButtonsGroup = css`
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
    `

    return <fieldset className={cx(cssRenderingFieldset)}>
        <legend>Rendering Controls</legend>

        <div className={cx(cssRenderingGroupDiv)}>
            <div className={cx(cssSliderGroupsDiv)}>

                <label htmlFor='cameraFov'>Camera Field of View</label>

                <div className={cx(cssSliderGroupDiv)}>
                    <label className={cx(cssMinLabel)}>{minCameraFov}</label>
                    <input type='range' className={cx(cssRangeInput)}
                        min={minCameraFov}
                        max={maxCameraFov}
                        value={props.cameraFov}
                        onChange={event => props.setCameraFov(parseInt(event.target.value))}
                    />
                    <label className={cx(cssMaxLabel)}>{maxCameraFov}</label>
                </div>

                <label htmlFor='numSamples'># of Samples Per Pixel</label>

                <div className={cx(cssSliderGroupDiv)}>
                    <label className={cx(cssMinLabel)}>{minSamples}</label>
                    <input type='range' className={cx(cssRangeInput)}
                        min={minSamples}
                        max={maxSamples}
                        value={props.numSamples}
                        onChange={event => props.setNumSamples(parseInt(event.target.value))}
                    />
                    <label className={cx(cssMaxLabel)}>{maxSamples}</label>
                </div>

                <label htmlFor='numBounces'># of Ray Bounces</label>

                <div className={cx(cssSliderGroupDiv)}>
                    <label className={cx(cssMinLabel)}>{minBounces}</label>
                    <input type='range' className={cx(cssRangeInput)}
                        min={minBounces}
                        max={maxBounces}
                        value={props.numBounces}
                        onChange={event => props.setNumBounces(parseInt(event.target.value))}
                    />
                    <label className={cx(cssMaxLabel)}>{maxBounces}</label>
                </div>
            </div>

            <fieldset className={cx(shadingTechniquesGroup)}>
                <legend>Shading Technique</legend>

                <div className={cx(shadingRadioButtonsGroup)}>
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
