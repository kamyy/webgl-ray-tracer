import React from "react";
import { css } from "@emotion/css";
import { connect } from "react-redux";
import Canvas, { canvasWd } from "./Canvas";
import OtherTabs from "./OtherTabs";

const cssApp = css`
  font-family: "Roboto";
  background-color: "#f5f5f5";
  position: relative;
  width: ${canvasWd + 4}px;
  margin: auto;
`;

const cssProgressRow = css`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
`;

const cssProgressPercentage = css`
  margin: 0px 0px 0px 4px;
  font-size: 12px;
  font-weight: bold;
`;

interface AppProps {
  renderingPass: number;
  numSamples: number;
}

function App({ renderingPass, numSamples }: AppProps) {
  const ratio = renderingPass / numSamples;
  const width = ratio * canvasWd;

  const cssProgressBar = css`
    margin: 6px 0px 12px 2px;
    border-radius: 6px;
    width: ${width - 8}px;
    height: 3px;
    background-color: darkgreen;
  `;

  return (
    <div className={cssApp}>
      <Canvas />
      <div className={cssProgressRow}>
        <div className={cssProgressBar} />
        <div className={cssProgressPercentage}>{Math.floor(ratio * 100 + 0.5)}%</div>
      </div>
      <OtherTabs />
    </div>
  );
}

function mapStateToProps(state) {
  return {
    numSamples: state.numSamples,
    renderingPass: state.renderingPass,
  };
}

export default connect(mapStateToProps, null)(App);
