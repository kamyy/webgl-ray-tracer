// @flow

import React from 'react';

import {
    connect
}   from 'react-redux';

import {
    css
}   from 'emotion';

const cssTabPage = css`
    display: flex;
    flex-direction: row;
    justify-content: center;
    border-style: groove;
    border-width: thin;
    padding: 24px;
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
    width: 280px;
    text-align: center;
`

const cssTimeFieldset = css`
    border-style: none groove none none;
    border-width: thin;
    padding: 8px;
    width: 280px;
    text-align: center;
`

function RenderingStatus(props) {
    return <div className={cssTabPage}>
        <fieldset className={cssPassFieldset}>
            <legend class={cssLegend}>Rendering Pass</legend>
            <div> { props.renderingPass} / {props.numSamples} </div>
        </fieldset>

        <fieldset className={cssTimeFieldset}>
            <legend class={cssLegend}>Elapsed Time</legend>
            <div>{props.elapsedTime}</div>
        </fieldset>

        <fieldset className={cssTimeFieldset}>
            <legend class={cssLegend}>Remaining Time</legend>
            <div>{props.etaTime}</div>
        </fieldset>

        <fieldset className={cssTimeFieldset}>
            <legend class={cssLegend}>Avg. Duration Per Pass</legend>
            <div>{props.avgTime}</div>
        </fieldset>
    </div>
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        renderingPass: state.renderingPass,
        elapsedTime: state.elapsedTime,
        etaTime: state.etaTime,
        avgTime: state.avgTime,
    };
}

export default connect(mapStateToProps, null)(RenderingStatus);
