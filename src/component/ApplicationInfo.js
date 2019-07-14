
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

function ApplicationInfo(props) {
    const cssApplicationInfo = css`
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        border-style: groove;
        border-width: thin;
        padding: 16px 32px;
    `;

    const cssProjectInfoStyle = css`
        margin: 6px;
        font-size: 14px;
        text-align: center;
    `;

    return <div className={cssApplicationInfo}>
        <div>
            <p className={cssProjectInfoStyle}>MIT License</p>
            <p className={cssProjectInfoStyle}><a href='https://github.com/kamyy/webgl-ray-tracer'>Project @ GitHub</a></p>
            <p className={cssProjectInfoStyle}>Copyright &copy; 2019 <a href='mailto:kam.yin.yip@gmail.com'>Kam Y Yip</a></p>
        </div>
    </div>
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

export default connect(mapStateToProps, mapDispatchToProps)(ApplicationInfo);