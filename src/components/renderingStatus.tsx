import { useAppStore } from '../lib/store/appStore'

const fieldsetClass = 'w-1/4 p-4 not-first:border-l not-first:border-[lightgray]'
const legendClass = 'mx-auto text-[0.9rem] font-bold'

export default function RenderingStatus() {
  const renderingPass = useAppStore(state => state.renderingPass)
  const elapsedTime = useAppStore(state => state.elapsedTime)
  const numSamples = useAppStore(state => state.numSamples)
  const etaTime = useAppStore(state => state.etaTime)
  const avgTime = useAppStore(state => state.avgTime)

  return (
    <form className="flex p-8 text-center">
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Rendering Pass</legend>
        <div>
          {renderingPass} / {numSamples}
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Elapsed Time</legend>
        <div>{elapsedTime}</div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Remaining Time</legend>
        <div>{etaTime}</div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Avg. Duration Per Pass</legend>
        <div>{avgTime}</div>
      </fieldset>
    </form>
  )
}
