import React from 'react';
import { cx, css }  from 'emotion';

import RenderingParams from './RenderingParams';
import RenderingStatus from './RenderingStatus';
import ApplicationInfo from './ApplicationInfo';

enum Tab {
    RenderingParams = 0,
    RenderingStatus = 1,
    ApplicationInfo = 2,
}

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

interface IProps {
};

interface IState {
    currentTab: Tab
};

export default class OtherTabs extends React.Component<IProps, IState> {
    state: IState = {
        currentTab: Tab.RenderingParams
    };

    render() {
        const renderingParamsTabButtonStyle = this.state.currentTab === Tab.RenderingParams ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);
        const renderingStatusTabButtonStyle = this.state.currentTab === Tab.RenderingStatus ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);
        const applicationInfoTabButtonStyle = this.state.currentTab === Tab.ApplicationInfo ? cx(cssSelectedTabButton) : cx(cssUnselectedTabButton);

        let tabPage;
        switch(this.state.currentTab) {
        case Tab.RenderingParams: tabPage = <RenderingParams/>; break;
        case Tab.RenderingStatus: tabPage = <RenderingStatus/>; break;
        case Tab.ApplicationInfo: tabPage = <ApplicationInfo/>; break;
        default: break;
        }

        return <div className={css(cssTabPages)}>
            <div className={cx(cssTabBar)}>
                <button type='button' className={renderingParamsTabButtonStyle} onClick={() => this.onClick(Tab.RenderingParams)}>
                    Rendering Parameters
                </button>

                <button type='button' className={renderingStatusTabButtonStyle} onClick={() => this.onClick(Tab.RenderingStatus)}>
                    Rendering Status
                </button>

                <button type='button' className={applicationInfoTabButtonStyle} onClick={() => this.onClick(Tab.ApplicationInfo)}>
                    App Info
                </button>
            </div>
            {tabPage}
        </div>
    }

    onClick(selectedTab: Tab) {
        this.setState({
            currentTab: selectedTab
        });
    }
};
