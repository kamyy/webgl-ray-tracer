import React from "react";
import { css } from "@emotion/css";

const cssApplicationInfo = css`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: center;
  border-style: groove;
  border-width: thin;
  padding: 16px 32px;
`;

const cssProjectInfo = css`
  margin: 6px;
  font-size: 14px;
  text-align: center;
`;

const cssMouseInfo = css`
  margin: 2px;
  font-size: 14px;
  text-align: center;
`;

const cssMouseBold = css`
  font-weight: bold;
`;

export default function ApplicationInfo(): JSX.Element {
  return (
    <div className={cssApplicationInfo}>
      <div>
        <p className={cssProjectInfo}>MIT License</p>
        <p className={cssProjectInfo}>
          <a href="https://github.com/kamyy/webgl-ray-tracer">Project @ GitHub</a>
        </p>
        <p className={cssProjectInfo}>
          Copyright &copy; 2019
          <a href="mailto:kam.yin.yip@gmail.com">Kam Y Yip</a>
        </p>
      </div>
      <div className={cssMouseInfo}>
        <p>
          <span className={cssMouseBold}>* Rotate</span> Left click + drag.
        </p>
        <p>
          <span className={cssMouseBold}>* Translate</span> Right click + drag. Or ctrl + left click + drag.
        </p>
        <p>
          <span className={cssMouseBold}>* Dolly In/Out</span> Left + right click + drag. Or shift + left click + drag.
        </p>
      </div>
    </div>
  );
}
