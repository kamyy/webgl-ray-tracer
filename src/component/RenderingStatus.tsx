import React from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';

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

interface IProps {
    numSamples: number,
    renderingPass: number,
    elapsedTime: string,
    etaTime: string,
    avgTime: string,
};

function RenderingStatus(props: IProps) {
    return <div className={cssTabPage}>
        <fieldset className={cssPassFieldset}>
            <legend className={cssLegend}>Rendering Pass</legend>
            <div> { props.renderingPass} / {props.numSamples} </div>
        </fieldset>

        <fieldset className={cssTimeFieldset}>
            <legend className={cssLegend}>Elapsed Time</legend>
            <div>{props.elapsedTime}</div>
        </fieldset>

        <fieldset className={cssTimeFieldset}>
            <legend className={cssLegend}>Remaining Time</legend>
            <div>{props.etaTime}</div>
        </fieldset>

        <fieldset className={cssTimeFieldset}>
            <legend className={cssLegend}>Avg. Duration Per Pass</legend>
            <div>{props.avgTime}</div>
        </fieldset>
    </div>
}

function mapStateToProps(state: any) {
    return {
        numSamples: state.numSamples,
        renderingPass: state.renderingPass,
        elapsedTime: state.elapsedTime,
        etaTime: state.etaTime,
        avgTime: state.avgTime,
    };
}

export default connect(mapStateToProps, null)(RenderingStatus);
