import { appActions, ShadingMethod } from '../redux/appSlice';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import styles from './RenderingParams.module.scss';

const minSamples = 1;
const maxSamples = 10000;
const minBounces = 1;
const maxBounces = 16;
const minCameraFov = 10;
const maxCameraFov = 120;

export default function RenderingParams(): JSX.Element {
  const dispatch = useAppDispatch();
  const cameraFov = useAppSelector((state) => state.cameraFov);
  const numSamples = useAppSelector((state) => state.numSamples);
  const numBounces = useAppSelector((state) => state.numBounces);
  const shadingMethod = useAppSelector((state) => state.shadingMethod);

  return (
    <form className={styles.renderingParams}>
      <div className={styles.inputRanges}>
        <div className={styles.rangeHeader}>
          <div className={styles.rangeTitle}>Camera Field of View</div>
          <div className={styles.rangeValue}>{cameraFov}</div>
        </div>
        <div className={styles.rangeSlider}>
          <label className={styles.rangeMin}>{minCameraFov}</label>
          <input
            type="range"
            min={minCameraFov}
            max={maxCameraFov}
            value={cameraFov}
            onChange={(event) => dispatch(appActions.setCameraFov(parseInt(event.target.value)))}
          />
          <label className={styles.rangeMax}>{maxCameraFov}</label>
        </div>

        <div className={styles.rangeHeader}>
          <div className={styles.rangeTitle}># of Samples Per Pixel</div>
          <div className={styles.rangeValue}>{numSamples}</div>
        </div>
        <div className={styles.rangeSlider}>
          <label className={styles.rangeMin}>{minSamples}</label>
          <input
            type="range"
            min={minSamples}
            max={maxSamples}
            value={numSamples}
            onChange={(event) => dispatch(appActions.setNumSamples(parseInt(event.target.value)))}
          />
          <label className={styles.rangeMax}>{maxSamples}</label>
        </div>

        <div className={styles.rangeHeader}>
          <div className={styles.rangeTitle}># of Ray Bounces</div>
          <div className={styles.rangeValue}>{numBounces}</div>
        </div>
        <div className={styles.rangeSlider}>
          <label className={styles.rangeMin}>{minBounces}</label>
          <input
            type="range"
            min={minBounces}
            max={maxBounces}
            value={numBounces}
            onChange={(event) => dispatch(appActions.setNumBounces(parseInt(event.target.value)))}
          />
          <label className={styles.rangeMax}>{maxBounces}</label>
        </div>
      </div>

      <fieldset className={styles.shadingMethod}>
        <legend>Shading Method</legend>

        <div className={styles.radioButtons}>
          <input
            id="flat"
            type="radio"
            value={ShadingMethod.flat}
            checked={shadingMethod === ShadingMethod.flat}
            onChange={(event) => dispatch(appActions.setShadingMethod(parseInt(event.target.value)))}
          />
          <label htmlFor="flat">Flat</label>

          <input
            id="phong"
            type="radio"
            value={ShadingMethod.phong}
            checked={shadingMethod === ShadingMethod.phong}
            onChange={(event) => dispatch(appActions.setShadingMethod(parseInt(event.target.value)))}
          />
          <label htmlFor="phong">Phong</label>
        </div>
      </fieldset>
    </form>
  );
}
