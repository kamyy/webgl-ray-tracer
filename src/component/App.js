import React from 'react';
import Canvas from './Canvas.js';
import TPages from './TPages.js';

import {
    css
}   from 'emotion';

import {
    connect
}   from 'react-redux';

import {
    canvasWd,
}   from './Canvas.js';

function App(props) {
    const progressBarWidth = props.renderingPass / props.numSamples * canvasWd + 2;

    const cssApp = css`
        font-family: 'Roboto';
        background-color: '#f5f5f5';
        position: relative;
        width: ${canvasWd + 4}px;
        margin: auto;
    `
    const cssProgressBar = css`
        margin: 4px 0px 12px 2px;
        border-radius: 6px;
        width: ${progressBarWidth}px;
        height: 2px;
        background-color: darkgreen;
    `

    return <div className={cssApp}>
        <Canvas/>
        <div className={cssProgressBar}/>
        <TPages/>
    </div>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        renderingPass: state.renderingPass,
    };
}

export default connect(mapStateToProps, null)(App);
