
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
        padding: 24px 32px;
    `

    const cssProgressArea = css`
        margin 0px 32px;
        height: 3px;
        background-color: lightgray;
    `

    const cssProgressFill = css`
        width: ${percentComplete}%;
        height: 3px;
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

    const cssBottomSection = css`
        display: flex;
        flex-direction: row;
        justify-content: center;
        margin-top: 24px;
    `

    const cssLegend = css`
        margin: 0px;
        font-weight: bold;
        font-size: 12px;
    `

    const cssPassFieldset = css`
        border-style: none groove none groove;
        border-width: thin;
        padding: 8px;
        width: 250px;
        text-align: center;
    `

    const cssTimeFieldset = css`
        border-style: none groove none none;
        border-width: thin;
        padding: 8px;
        width: 250px;
        text-align: center;
    `

    return <div className={cssTabPage}>
        <div className={cssHeadingLabel}>Completion</div>
        <div className={cssProgressArea}>
            <div className={cssProgressFill}/>
        </div>
        <div className={cssPercentLabel}>
            {percentComplete}%
        </div>

        <div className={cssBottomSection}>

            <fieldset className={cssPassFieldset}>
                <legend class={cssLegend}>Rendering Pass</legend>
                <div> { props.renderingPass} / {props.numSamples} </div>
            </fieldset>

            <fieldset className={cssTimeFieldset}>
                <legend class={cssLegend}>Elapsed Time</legend>
                <div>02:16:33</div>
            </fieldset>

            <fieldset className={cssTimeFieldset}>
                <legend class={cssLegend}>Estimated Time Left</legend>
                <div>01:03:12</div>
            </fieldset>

            <fieldset className={cssTimeFieldset}>
                <legend class={cssLegend}>Avg. Rendering Pass Duration</legend>
                <div>500ms</div>
            </fieldset>

        </div>

    </div>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        renderingPass: state.renderingPass,
    };
}

export default connect(mapStateToProps, null)(RenderingStatus);
