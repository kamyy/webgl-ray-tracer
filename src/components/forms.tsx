import classnames from 'classnames'
import { useState } from 'react'
import AppInfo from './appInfo'
import styles from './forms.module.scss'
import RenderingParams from './renderingParams'
import RenderingStatus from './renderingStatus'

export default function Forms() {
  enum FormType {
    renderingParams,
    renderingStatus,
    applicationInfo,
  }
  const [currentFormType, setCurrentFormType] = useState<FormType>(FormType.renderingParams)

  return (
    <footer className={styles.tabs}>
      <nav>
        <button
          type="button"
          className={classnames({ [styles.selected]: currentFormType === FormType.renderingParams })}
          onClick={() => setCurrentFormType(FormType.renderingParams)}
        >
          Rendering Parameters
        </button>

        <button
          type="button"
          className={classnames({ [styles.selected]: currentFormType === FormType.renderingStatus })}
          onClick={() => setCurrentFormType(FormType.renderingStatus)}
        >
          Rendering Status
        </button>

        <button
          type="button"
          className={classnames({ [styles.selected]: currentFormType === FormType.applicationInfo })}
          onClick={() => setCurrentFormType(FormType.applicationInfo)}
        >
          Application Info
        </button>
      </nav>

      <div className={styles.tabContent}>
        {currentFormType === FormType.renderingParams && <RenderingParams />}
        {currentFormType === FormType.renderingStatus && <RenderingStatus />}
        {currentFormType === FormType.applicationInfo && <AppInfo />}
      </div>
    </footer>
  )
}
