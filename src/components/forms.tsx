import classnames from 'classnames'
import { useState } from 'react'
import AppInfo from './appInfo'
import RenderingParams from './renderingParams'
import RenderingStatus from './renderingStatus'

const tabClass =
  'rounded-t-[1em] border-2 border-b-0 border-[lightgray] px-8 py-3 not-first:border-l-0 hover:bg-[lightgray]'
const selectedTabClass = 'bg-[lightgray] font-bold'

export default function Forms() {
  enum FormType {
    renderingParams,
    renderingStatus,
    applicationInfo,
  }
  const [currentFormType, setCurrentFormType] = useState<FormType>(FormType.renderingParams)

  return (
    <footer>
      <nav className="flex items-end overflow-x-auto">
        <button
          type="button"
          className={classnames(tabClass, { [selectedTabClass]: currentFormType === FormType.renderingParams })}
          onClick={() => setCurrentFormType(FormType.renderingParams)}
        >
          Rendering Parameters
        </button>

        <button
          type="button"
          className={classnames(tabClass, { [selectedTabClass]: currentFormType === FormType.renderingStatus })}
          onClick={() => setCurrentFormType(FormType.renderingStatus)}
        >
          Rendering Status
        </button>

        <button
          type="button"
          className={classnames(tabClass, { [selectedTabClass]: currentFormType === FormType.applicationInfo })}
          onClick={() => setCurrentFormType(FormType.applicationInfo)}
        >
          Application Info
        </button>
      </nav>

      <div className="rounded-[0_1em_1em_1em] border border-[lightgray]">
        {currentFormType === FormType.renderingParams && <RenderingParams />}
        {currentFormType === FormType.renderingStatus && <RenderingStatus />}
        {currentFormType === FormType.applicationInfo && <AppInfo />}
      </div>
    </footer>
  )
}
