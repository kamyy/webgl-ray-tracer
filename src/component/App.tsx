import React from 'react';
import { css } from 'emotion';
import { connect }  from 'react-redux';

import SceneTabs from './SceneTabs';
import OtherTabs from './OtherTabs';
import Canvas, { canvasWd }  from './Canvas';

const cssApp = css`
    font-family: 'Roboto';
    background-color: #f5f5f5;
    position: relative;
    width: ${canvasWd + 4}px;
    margin: auto;
`

const cssProgressRow = css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
`

const cssProgressPercentage = css`
    margin: 0px 0px 0px 4px;
    font-size: 12px;
    font-weight: bold;
`

function App(props: { renderingPass: number, numSamples: number }) {
    const ratio = props.renderingPass / props.numSamples;
    const width = ratio * canvasWd;

    const cssProgressBar = css`
        margin: 6px 0px 12px 2px;
        border-radius: 6px;
        width: ${width - 8}px;
        height: 3px;
        background-color: darkgreen;
    `

    const percentage = Math.floor(ratio * 100 + 0.5);

    return <div className={cssApp}>
        <SceneTabs/>
        <Canvas/>
        <div className={cssProgressRow}>
            <div className={cssProgressBar}/>
            <div className={cssProgressPercentage}>{percentage}%</div>
        </div>
        <OtherTabs/>
    </div>
}

function mapStateToProps(state: any) {
    return {
        numSamples: state.numSamples,
        renderingPass: state.renderingPass,
    };
}

export default connect(mapStateToProps, null)(App);
