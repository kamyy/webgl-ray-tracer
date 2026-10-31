import { useAppStore } from '../lib/store/appStore'

export function Progress() {
  const renderingPass = useAppStore(state => state.renderingPass)
  const numSamples = useAppStore(state => state.numSamples)
  const proportion = renderingPass / numSamples // 0.0 - 1.0

  return (
    <section className="mt-1 mb-4 flex items-center">
      <div className="h-[3px] bg-[darkgreen]" style={{ width: `${proportion * 97}%` }} id="bar" />
      <div className="ml-[0.25%] text-right text-[0.9rem] font-semibold">{Math.floor(proportion * 100 + 0.5)}%</div>
    </section>
  )
}
