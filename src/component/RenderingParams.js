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

function RenderingParams(props) {
    const cssRenderingParams = css`
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        border-style: none ridge ridge ridge;
        border-width: medium;
        padding: 16px 32px;
    `;
    const cssRenderingParamLabel = css`
        font-weight: bold;
        font-size: 12px;
    `;
    const cssSliderGroups = css`
        display: flex;
        flex-direction: column;
        flex-grow: 2;
        margin: 5px 0px;
    `;
    const cssSliderGroup = css`
        display: flex;
        flex-direction: row;
        padding-top: 5px;
        padding-bottom: 10px;
    `;
    const cssMinLabel = css`
        flex-basis: 5%;
        text-align: right;
        margin-right: 10px;
    `;
    const cssRangeInput = css`
        flex-basis: 90%;
    `;
    const cssMaxLabel = css`
        flex-basis: 5%;
        text-align: left;
        margin-left: 10px;
    `;
    const cssShadingMethodFieldset = css`
        border-style: none none none ridge;
        padding: 0px 0px 0px 16px;
        margin: 4px 4px;
    `;
    const cssShadingMethodRadioButtonsGroup = css`
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        padding: 8px 0px;
    `;
    const cssShadingMethodRadioButtonGroup = css`
        margin-right: 4px;
    `;

    return <div className={cx(cssRenderingParams)}>
        <div className={cx(cssSliderGroups)}>

            <label class={cx(cssRenderingParamLabel)}>Camera Field of View</label>

            <div className={cx(cssSliderGroup)}>
                <label className={cx(cssMinLabel)}>{minCameraFov}</label>
                <input type='range' className={cx(cssRangeInput)}
                    min={minCameraFov}
                    max={maxCameraFov}
                    value={props.cameraFov}
                    onChange={event => props.setCameraFov(parseInt(event.target.value))}
                />
                <label className={cx(cssMaxLabel)}>{maxCameraFov}</label>
            </div>

            <label class={cx(cssRenderingParamLabel)}># of Samples Per Pixel</label>

            <div className={cx(cssSliderGroup)}>
                <label className={cx(cssMinLabel)}>{minSamples}</label>
                <input type='range' className={cx(cssRangeInput)}
                    min={minSamples}
                    max={maxSamples}
                    value={props.numSamples}
                    onChange={event => props.setNumSamples(parseInt(event.target.value))}
                />
                <label className={cx(cssMaxLabel)}>{maxSamples}</label>
            </div>

            <label class={cx(cssRenderingParamLabel)}># of Ray Bounces</label>

            <div className={cx(cssSliderGroup)}>
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

        <fieldset className={cx(cssShadingMethodFieldset)}>
            <legend class={cx(cssRenderingParamLabel)}>Shading Method</legend>

            <div className={cx(cssShadingMethodRadioButtonsGroup)}>
                <label className={cssShadingMethodRadioButtonGroup}>
                    <input type='radio'
                        value={FLAT_SHADING}
                        checked={props.shadingMethod === FLAT_SHADING}
                        onChange={event => props.setShadingMethod(parseInt(event.target.value))}
                    />
                    Flat
                </label>

                <label className={cssShadingMethodRadioButtonGroup}>
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
