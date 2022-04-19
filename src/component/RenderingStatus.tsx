import { css } from "@emotion/css";
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/reducers";

const cssTabPage = css`
  display: flex;
  flex-direction: row;
  justify-content: center;
  border-style: groove;
  border-width: thin;
  padding: 24px;
`;

const cssLegend = css`
  margin: 0px;
  font-weight: bold;
  font-size: 12px;
`;

const cssPassFieldset = css`
  border-style: none groove none groove;
  border-width: thin;
  padding: 8px;
  width: 280px;
  text-align: center;
`;

const cssTimeFieldset = css`
  border-style: none groove none none;
  border-width: thin;
  padding: 8px;
  width: 280px;
  text-align: center;
`;

export default function RenderingStatus(): JSX.Element {
  const renderingPass = useSelector((state: RootState) => state.renderingPass);
  const elapsedTime = useSelector((state: RootState) => state.elapsedTime);
  const numSamples = useSelector((state: RootState) => state.numSamples);
  const etaTime = useSelector((state: RootState) => state.etaTime);
  const avgTime = useSelector((state: RootState) => state.avgTime);

  return (
    <div className={cssTabPage}>
      <fieldset className={cssPassFieldset}>
        <legend className={cssLegend}>Rendering Pass</legend>
        <div>
          {" "}
          {renderingPass} / {numSamples}{" "}
        </div>
      </fieldset>

      <fieldset className={cssTimeFieldset}>
        <legend className={cssLegend}>Elapsed Time</legend>
        <div>{elapsedTime}</div>
      </fieldset>

      <fieldset className={cssTimeFieldset}>
        <legend className={cssLegend}>Remaining Time</legend>
        <div>{etaTime}</div>
      </fieldset>

      <fieldset className={cssTimeFieldset}>
        <legend className={cssLegend}>Avg. Duration Per Pass</legend>
        <div>{avgTime}</div>
      </fieldset>
    </div>
  );
}
