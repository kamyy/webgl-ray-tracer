// @flow

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

type Props = {
    renderingPass: number,
    numSamples: number
};

function App(props: Props) {
    const ratio = props.renderingPass / props.numSamples;
    const width = ratio * canvasWd;

    const cssApp = css`
        font-family: 'Roboto';
        background-color: '#f5f5f5';
        position: relative;
        width: ${canvasWd + 4}px;
        margin: auto;
    `
    const cssProgressRow = css`
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
    `
    const cssProgressBar = css`
        margin: 6px 0px 12px 2px;
        border-radius: 6px;
        width: ${width - 8}px;
        height: 3px;
        background-color: darkgreen;
    `
    const cssProgressPercentage = css`
        margin: 0px 0px 0px 4px;
        font-size: 12px;
        font-weight: bold;
    `

    const percentage = Math.floor(ratio * 100 + 0.5);

    return <div className={cssApp}>
        <Canvas/>
        <div className={cssProgressRow}>
            <div className={cssProgressBar}/><div className={cssProgressPercentage}>{percentage}%</div>
        </div>
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
