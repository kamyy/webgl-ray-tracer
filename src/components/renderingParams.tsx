import { ReactElement } from 'react'
import { appActions, ShadingMethod } from '../lib/store/appSlice'
import { useAppDispatch, useAppSelector } from '../lib/store/hooks'
import type { RootState } from '../lib/store/store'

const minSamples = 1
const maxSamples = 10000
const minBounces = 1
const maxBounces = 16
const minCameraFov = 10
const maxCameraFov = 120

const rangeHeaderClass = 'flex'
const rangeTitleClass = 'grow text-[0.9rem] font-bold'
const rangeValueClass = 'basis-[5%] text-left text-[0.9rem] font-bold'
const rangeSliderClass = 'flex pt-2 pb-3'
const rangeMinClass = 'basis-[6%] text-right'
const rangeMaxClass = 'basis-[5%] text-left'
const rangeInputClass = 'mx-4 grow'

export default function RenderingParams(): ReactElement {
  const dispatch = useAppDispatch()
  const cameraFov = useAppSelector((state: RootState) => state.cameraFov)
  const numSamples = useAppSelector((state: RootState) => state.numSamples)
  const numBounces = useAppSelector((state: RootState) => state.numBounces)
  const shadingMethod = useAppSelector((state: RootState) => state.shadingMethod)

  return (
    <form className="flex p-8">
      <div className="flex grow flex-col">
        <div className={rangeHeaderClass}>
          <div className={rangeTitleClass}>Camera Field of View</div>
          <div className={rangeValueClass}>{cameraFov}</div>
        </div>
        <div className={rangeSliderClass}>
          <label className={rangeMinClass}>{minCameraFov}</label>
          <input
            className={rangeInputClass}
            type="range"
            min={minCameraFov}
            max={maxCameraFov}
            value={cameraFov}
            onChange={event => dispatch(appActions.setCameraFov(parseInt(event.target.value)))}
          />
          <label className={rangeMaxClass}>{maxCameraFov}</label>
        </div>

        <div className={rangeHeaderClass}>
          <div className={rangeTitleClass}># of Samples Per Pixel</div>
          <div className={rangeValueClass}>{numSamples}</div>
        </div>
        <div className={rangeSliderClass}>
          <label className={rangeMinClass}>{minSamples}</label>
          <input
            className={rangeInputClass}
            type="range"
            min={minSamples}
            max={maxSamples}
            value={numSamples}
            onChange={event => dispatch(appActions.setNumSamples(parseInt(event.target.value)))}
          />
          <label className={rangeMaxClass}>{maxSamples}</label>
        </div>

        <div className={rangeHeaderClass}>
          <div className={rangeTitleClass}># of Ray Bounces</div>
          <div className={rangeValueClass}>{numBounces}</div>
        </div>
        <div className={rangeSliderClass}>
          <label className={rangeMinClass}>{minBounces}</label>
          <input
            className={rangeInputClass}
            type="range"
            min={minBounces}
            max={maxBounces}
            value={numBounces}
            onChange={event => dispatch(appActions.setNumBounces(parseInt(event.target.value)))}
          />
          <label className={rangeMaxClass}>{maxBounces}</label>
        </div>
      </div>

      <fieldset className="border-l border-[lightgray] pl-4">
        <legend className="text-[0.9rem] font-bold">Shading Method</legend>

        <div className="flex">
          <input
            className="mt-2"
            id="flat"
            type="radio"
            value={ShadingMethod.flat}
            checked={shadingMethod === ShadingMethod.flat}
            onChange={event => dispatch(appActions.setShadingMethod(parseInt(event.target.value)))}
          />
          <label className="mt-2" htmlFor="flat">
            Flat
          </label>

          <input
            className="mt-2 ml-4"
            id="phong"
            type="radio"
            value={ShadingMethod.phong}
            checked={shadingMethod === ShadingMethod.phong}
            onChange={event => dispatch(appActions.setShadingMethod(parseInt(event.target.value)))}
          />
          <label className="mt-2" htmlFor="phong">
            Phong
          </label>
        </div>
      </fieldset>
    </form>
  )
}
