
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

function RenderingStatus(props) {
    const cssRenderingStatus = css`
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        border-style: none ridge ridge ridge;
        border-width: medium;
        padding: 16px 32px;
    `;

    return <div className={cx(cssRenderingStatus)}></div>
}

function mapStateToProps(state) {
    return {
        /*
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov:  state.cameraFov,
        shadingMethod: state.shadingMethod,
        */
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({
        /*
        setNumSamples,
        setNumBounces,
        setCameraFov,
        setShadingMethod,
        */
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(RenderingStatus);
