import { useAppSelector } from '../redux/hooks';
import styles from './RenderingStatus.module.scss';

export default function RenderingStatus() {
  const renderingPass = useAppSelector((state) => state.renderingPass);
  const elapsedTime = useAppSelector((state) => state.elapsedTime);
  const numSamples = useAppSelector((state) => state.numSamples);
  const etaTime = useAppSelector((state) => state.etaTime);
  const avgTime = useAppSelector((state) => state.avgTime);

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
