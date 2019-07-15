
import React from 'react';

import {
    connect
}   from 'react-redux';

import {
    css
}   from 'emotion';

function RenderingStatus(props) {
    const percentComplete = Math.floor(props.renderingPass / props.numSamples * 100.0 + 0.5);

    const cssTabPage = css`
        display: flex;
        flex-direction: column;
        border-style: groove;
        border-width: thin;
        padding: 16px 32px;
    `

    const cssProgressArea = css`
        margin 0px 32px;
        height: 2px;
        background-color: lightgray;
    `

    const cssProgressFill = css`
        width: ${percentComplete}%;
        height: 2px;
        background-color: darkgreen;
    `

    const cssPercentLabel = css`
        margin: 4px 32px;
        text-align: center;
    `

    const cssHeadingLabel = css`
        margin-bottom: 8px;
        font-weight: bold;
        font-size: 12px;
    `

    return <div className={cssTabPage}>
        <div className={cssHeadingLabel}>Rendering Progress</div>
        <div className={cssProgressArea}>
            <div className={cssProgressFill}/>
        </div>
        <div className={cssPercentLabel}>
            {percentComplete}%
        </div>
        <div> {props.renderingPass} </div>
        <div> {props.numSamples} </div>
    </div>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        renderingPass: state.renderingPass,
    };
}

export default connect(mapStateToProps, null)(RenderingStatus);
