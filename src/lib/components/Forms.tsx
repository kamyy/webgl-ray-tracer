import classnames from 'classnames';
import { useState } from 'react';
import ApplicationInfo from './ApplicationInfo';
import styles from './Forms.module.scss';
import RenderingParams from './RenderingParams';
import RenderingStatus from './RenderingStatus';

export default function Forms() {
  enum FormType {
    renderingParams,
    renderingStatus,
    applicationInfo,
  }
  const [currentFormType, setCurrentFormType] = useState<FormType>(FormType.renderingParams);

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
        {currentFormType === FormType.applicationInfo && <ApplicationInfo />}
      </div>
    </footer>
  );
}
