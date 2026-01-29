import { useAppSelector } from '../lib/store/hooks';
import type { RootState } from '../lib/store/store';
import styles from './renderingStatus.module.scss';

export default function RenderingStatus() {
  const renderingPass = useAppSelector((state: RootState) => state.renderingPass);
  const elapsedTime = useAppSelector((state: RootState) => state.elapsedTime);
  const numSamples = useAppSelector((state: RootState) => state.numSamples);
  const etaTime = useAppSelector((state: RootState) => state.etaTime);
  const avgTime = useAppSelector((state: RootState) => state.avgTime);

  return (
    <form className={styles.renderingStatus}>
      <fieldset className={styles.renderingPass}>
        <legend>Rendering Pass</legend>
        <div>
          {renderingPass} / {numSamples}
        </div>
      </fieldset>

      <fieldset>
        <legend>Elapsed Time</legend>
        <div>{elapsedTime}</div>
      </fieldset>

      <fieldset>
        <legend>Remaining Time</legend>
        <div>{etaTime}</div>
      </fieldset>

      <fieldset>
        <legend>Avg. Duration Per Pass</legend>
        <div>{avgTime}</div>
      </fieldset>
    </form>
  );
}
