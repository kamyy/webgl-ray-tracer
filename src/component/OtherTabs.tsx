import React from 'react';
import { cx, css }  from 'emotion';

import RenderingParams from './RenderingParams';
import RenderingStatus from './RenderingStatus';
import ApplicationInfo from './ApplicationInfo';

const RENDERING_PARAMS_TAB = 0;
const RENDERING_STATUS_TAB = 1;
const APPLICATION_INFO_TAB = 2;

const cssTabPages = css`
    display: flex;
    flex-direction: column;
    font-size: 14px;
    margin: 0px;
`
const cssTabBar = css`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    margin: 0px;
    border-style: none;
`
const cssSelectedTabButton = css`
    border-style: none ridge solid none;
    border-radius: 5px 5px 0px 0px;
    border-bottom-color: darkgreen;
    padding: 8px 16px;
    background-color: #dddddd;
    &:focus {
        outline: 0;
    }
    font-family: 'Roboto';
    font-weight: bold;
    font-size: 12px;
`
const cssUnselectedTabButton = css`
    border-style: none ridge none none;
    border-radius: 5px 5px 0px 0px;
    border-bottom-color: #dddddd;
    padding: 8px 16px;
    background-color: #dddddd;
    &:focus {
        background-color: #dddddd;
        outline: 0;
    }
    font-family: 'Roboto';
    font-weight: bold;
    font-size: 12px;
`

type Props = {
};
type State = {
    currentTab: number
};

export default class OtherTabs extends React.Component<Props, State> {
    state: State = {
        currentTab: RENDERING_PARAMS_TAB
    };

    render() {
        const renderingParamsTabButtonStyle = this.state.currentTab === RENDERING_PARAMS_TAB ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);
        const renderingStatusTabButtonStyle = this.state.currentTab === RENDERING_STATUS_TAB ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);
        const applicationInfoTabButtonStyle = this.state.currentTab === APPLICATION_INFO_TAB ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);

        let tabPage;
        switch(this.state.currentTab) {
        case RENDERING_PARAMS_TAB: tabPage = <RenderingParams/>; break;
        case RENDERING_STATUS_TAB: tabPage = <RenderingStatus/>; break;
        case APPLICATION_INFO_TAB: tabPage = <ApplicationInfo/>; break;
        default: break;
        }

        return <div className={css(cssTabPages)}>

            <div className={cx(cssTabBar)}>
                <button type='button' className={renderingParamsTabButtonStyle} onClick={() => this.onClick(RENDERING_PARAMS_TAB)}>
                    Rendering Parameters
                </button>

                <button type='button' className={renderingStatusTabButtonStyle} onClick={() => this.onClick(RENDERING_STATUS_TAB)}>
                    Rendering Status
                </button>

                <button type='button' className={applicationInfoTabButtonStyle} onClick={() => this.onClick(APPLICATION_INFO_TAB)}>
                    App Info
                </button>
            </div>

            {tabPage}

        </div>
    }

    onClick(selectedTab: 0 | 1 | 2) {
        this.setState({
            currentTab: selectedTab
        });
    }
};
