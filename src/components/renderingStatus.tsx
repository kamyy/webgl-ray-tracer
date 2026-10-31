/**
 * Elapsed time, estimated time left and average pass time for the render in progress.
 *
 * The values come from the app store, where `PathTracer` writes them a few times a second.
 */
import { useAppStore } from '../lib/store/appStore'

export function RenderingStatus() {
  const elapsedTime = useAppStore(state => state.elapsedTime)
  const etaTime = useAppStore(state => state.etaTime)
  const avgTime = useAppStore(state => state.avgTime)

  const rows = [
    { label: 'Elapsed', value: elapsedTime },
    { label: 'Remaining', value: etaTime },
    { label: 'Avg. per pass', value: avgTime },
  ]

  return (
    <dl className="mt-2 text-[0.9rem] tabular-nums">
      {rows.map(row => (
        <div key={row.label} className="flex justify-between border-t border-gray-300 py-1.5">
          <dt className="text-gray-600">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
