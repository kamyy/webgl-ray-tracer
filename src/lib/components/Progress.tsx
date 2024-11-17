import { useAppSelector } from '../redux/hooks';
import styles from './Progress.module.scss';

export function Progress() {
  const renderingPass = useAppSelector((state) => state.renderingPass);
  const numSamples = useAppSelector((state) => state.numSamples);
  const proportion = renderingPass / numSamples; // 0.0 - 1.0

  return (
    <section className={styles.progress}>
      <div className={styles.bar} style={{ width: `${proportion * 97}%` }} id="bar" />
      <div className={styles.percent}>{Math.floor(proportion * 100 + 0.5)}%</div>
    </section>
  );
}
