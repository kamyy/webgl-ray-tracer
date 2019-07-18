// @flow

import React from 'react';
import {
    bindActionCreators
}   from 'redux';

import {
    connect
}   from 'react-redux';

import {
    css
}   from 'emotion';

import {
    setNumSamples,
    setNumBounces,
    setCameraFov,
    setShadingMethod,

    FLAT_SHADING,
    PHONG_SHADING,
}   from '../redux/actions.js';

const minSamples = 1;
const maxSamples = 5000;
const minBounces = 1;
const maxBounces = 16;
const minCameraFov = 10;
const maxCameraFov = 120;

const cssTabPage = css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    border-style: groove;
    border-width: thin;
    padding: 16px 32px;
`

const cssHeadingLabel = css`
    font-weight: bold;
    font-size: 12px;
`

const cssLtSection = css`
    display: flex;
    flex-direction: column;
    flex-grow: 2;
    margin: 5px 0px;
`

const cssRtSection = css`
    border-style: none none none groove;
    border-width: thin;
    padding: 0px 0px 0px 16px;
    margin: 4px 4px;
`

const cssRangeGroup = css`
    display: flex;
    flex-direction: row;
    padding-top: 5px;
    padding-bottom: 15px;
`

const cssMinLabel = css`
    flex-basis: 5%;
    text-align: right;
    margin-right: 10px;
`

const cssMaxLabel = css`
    flex-basis: 5%;
    text-align: left;
    margin-left: 10px;
`

const cssRangeInput = css`
    flex-basis: 90%;
`

const cssShadingMethodSection = css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 8px 0px;
`

const cssShadingMethodButtons = css`
    margin-right: 4px;
`

function RenderingParams(props) {
    return <div className={cssTabPage}>
        <div className={cssLtSection}>

            <label class={cssHeadingLabel}>Camera Field of View ( {props.cameraFov} )</label>

            <div className={cssRangeGroup}>
                <label className={cssMinLabel}>{minCameraFov}</label>
                <input type='range' className={cssRangeInput}
                    min={minCameraFov}
                    max={maxCameraFov}
                    value={props.cameraFov}
                    onChange={event => props.setCameraFov(parseInt(event.target.value))}
                />
                <label className={cssMaxLabel}>{maxCameraFov}</label>
            </div>

            <label class={cssHeadingLabel}># of Samples Per Pixel ( {props.numSamples} )</label>

            <div className={cssRangeGroup}>
                <label className={cssMinLabel}>{minSamples}</label>
                <input type='range' className={cssRangeInput}
                    min={minSamples}
                    max={maxSamples}
                    value={props.numSamples}
                    onChange={event => props.setNumSamples(parseInt(event.target.value))}
                />
                <label className={cssMaxLabel}>{maxSamples}</label>
            </div>

            <label class={cssHeadingLabel}># of Ray Bounces ( {props.numBounces} )</label>

            <div className={cssRangeGroup}>
                <label className={cssMinLabel}>{minBounces}</label>
                <input type='range' className={cssRangeInput}
                    min={minBounces}
                    max={maxBounces}
                    value={props.numBounces}
                    onChange={event => props.setNumBounces(parseInt(event.target.value))}
                />
                <label className={cssMaxLabel}>{maxBounces}</label>
            </div>
        </div>

        <fieldset className={cssRtSection}>
            <legend class={cssHeadingLabel}>Shading Method</legend>

            <div className={cssShadingMethodSection}>
                <label className={cssShadingMethodButtons}>
                    <input type='radio'
                        value={FLAT_SHADING}
                        checked={props.shadingMethod === FLAT_SHADING}
                        onChange={event => props.setShadingMethod(parseInt(event.target.value))}
                    />
                    Flat
                </label>

                <label className={cssShadingMethodButtons}>
                    <input type='radio'
                        value={PHONG_SHADING}
                        checked={props.shadingMethod === PHONG_SHADING}
                        onChange={event => props.setShadingMethod(parseInt(event.target.value))}
                    />
                    Phong
                </label>
            </div>
        </fieldset>
    </div>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov:  state.cameraFov,
        shadingMethod: state.shadingMethod,
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({
        setNumSamples,
        setNumBounces,
        setCameraFov,
        setShadingMethod,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(RenderingParams);
