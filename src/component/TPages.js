
import React from 'react';

import {
    cx,
    css
}   from 'emotion';

import RenderingParams from './RenderingParams.js';
import RenderingStatus from './RenderingStatus.js';
import ApplicationInfo from './ApplicationInfo.js';

const RENDERING_PARAMS_TAB = 0;
const RENDERING_STATUS_TAB = 1;
const APPLICATION_INFO_TAB = 2;

const cssTabPages = css`
    display: flex;
    flex-direction: column;
    font-size: 14px;
`
const cssTabBar = css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    border-style: none none ridge none;
    margin: 0px 0px 0px 2px;
`
const cssTabButton = css`
    border-style: none ridge none none;
    border-radius: 5px 5px 0px 0px;
    padding: 8px 16px;
    &:focus {
        background-color: lightgray;
        outline: 0;
    }
    font-family: "Arial";
    font-weight: bold;
    font-size: 12px;
`
const cssSelectedTabButton = css`
    border-style: none ridge solid none;
    border-radius: 5px 5px 0px 0px;
    border-bottom-color: darkgray;
    padding: 8px 16px;
    &:focus {
        outline: 0;
    }
    font-family: "Arial";
    font-weight: bold;
    font-size: 12px;
`

export default class TPages extends React.Component<Props> {
    currentTab: number;

    constructor(props) {
        super(props);

        this.state = {
            currentTab: RENDERING_PARAMS_TAB
        };

        this.onClick = this.onClick.bind(this);
    }

    render() {
        const renderingParamsTabButtonStyle = this.state.currentTab === RENDERING_PARAMS_TAB ? cx(cssSelectedTabButton) : cx(cssTabButton);
        const renderingStatusTabButtonStyle = this.state.currentTab === RENDERING_STATUS_TAB ? cx(cssSelectedTabButton) : cx(cssTabButton);
        const applicationInfoTabButtonStyle = this.state.currentTab === APPLICATION_INFO_TAB ? cx(cssSelectedTabButton) : cx(cssTabButton);

        let tabPage;
        switch(this.state.currentTab) {
        case RENDERING_PARAMS_TAB: tabPage = <RenderingParams/>; break;
        case RENDERING_STATUS_TAB: tabPage = <RenderingStatus/>; break;
        case APPLICATION_INFO_TAB: tabPage = <ApplicationInfo/>; break;
        default: break;
        }

        return <div className={css(cssTabPages)}>

            <div className={cx(cssTabBar)}>
                <button type='button'
                    className={renderingParamsTabButtonStyle}
                    onClick={() => this.onClick(RENDERING_PARAMS_TAB)}>
                        Rendering Parameters
                </button>

                <button type='button'
                    className={renderingStatusTabButtonStyle}
                    onClick={() => this.onClick(RENDERING_STATUS_TAB)}>
                        Rendering Status
                </button>

                <button type='button'
                    className={applicationInfoTabButtonStyle}
                    onClick={() => this.onClick(APPLICATION_INFO_TAB)}>
                        App Info
                </button>
            </div>

            {tabPage}

        </div>
    }

    onClick(selectedTab) {
        this.setState({ currentTab: selectedTab });
    }

};
