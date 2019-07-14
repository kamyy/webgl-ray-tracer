
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

function RenderingStatus(props) {
    const cssRenderingStatus = css`
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        border-style: groove;
        border-width: thin;
        padding: 16px 32px;
    `;

    return <div className={cssRenderingStatus}></div>
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
