/**
 * The wireframe controls: switches for the triangle edges and the BVH boxes, and the band of BVH levels to show.
 *
 * They fill the popover that the wireframe button opens. While the mesh switch is on, tracing pauses and the canvas
 * shows the triangle edges instead of the traced image. The BVH boxes draw over whichever is shown, and leave tracing
 * running. The BVH (bounding volume hierarchy) is the tree of boxes the path tracer walks to find which triangles a ray
 * hits. The boxes come from one of two modes. In depth range mode, two sliders pick which levels are drawn, from the
 * root down to the loaded scene's deepest level. In selected triangle mode, a tap picks one triangle, and only the
 * boxes from its mesh's root box down to its leaf box are drawn.
 */
import { useAppStore } from '../lib/store/appStore'
import { RangeRow } from './rangeRow'
import { SegmentedControl } from './segmentedControl'
import { SettingsGroup } from './settingsGroup'

// The two ways to pick which BVH boxes to show, in the order the segmented control shows them.
const boxModes: { value: 'depth' | 'selected'; label: string }[] = [
  { value: 'depth', label: 'Depth range' },
  { value: 'selected', label: 'Selected triangle' },
]

interface ToggleProps {
  label: string
  checked: boolean
  disabled?: boolean // greys out the switch and ignores presses, for a switch that has no effect right now
  onChange: (checked: boolean) => void
}

// An on and off switch. The whole row is the button, so a press anywhere on the label flips it.
function Toggle({ label, checked, disabled = false, onChange }: ToggleProps) {
  const track = checked ? 'bg-(--accent)' : 'bg-gray-300 dark:bg-gray-600'
  const knob = checked ? 'translate-x-5' : 'translate-x-0'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="flex min-h-11 w-full items-center justify-between gap-2.5 rounded-lg text-left text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed disabled:opacity-40 short:min-h-9"
      onClick={() => onChange(!checked)}
    >
      {label}
      <span className={`flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors ${track}`}>
        <span className={`size-5 rounded-full bg-white shadow transition-transform ${knob}`} />
      </span>
    </button>
  )
}

export function WireframeSettings() {
  const showMeshWireframe = useAppStore(state => state.showMeshWireframe)
  const showBvhWireframe = useAppStore(state => state.showBvhWireframe)
  const bvhMinDepth = useAppStore(state => state.bvhMinDepth)
  const bvhMaxDepth = useAppStore(state => state.bvhMaxDepth)
  const bvhDepthRange = useAppStore(state => state.bvhDepthRange)
  const showSelectedBoxesOnly = useAppStore(state => state.showSelectedBoxesOnly)
  const setShowMeshWireframe = useAppStore(state => state.setShowMeshWireframe)
  const setShowBvhWireframe = useAppStore(state => state.setShowBvhWireframe)
  const setBvhMinDepth = useAppStore(state => state.setBvhMinDepth)
  const setBvhMaxDepth = useAppStore(state => state.setBvhMaxDepth)
  const setShowSelectedBoxesOnly = useAppStore(state => state.setShowSelectedBoxesOnly)

  // The BVH boxes come from either a band of depths or one tapped triangle, so only the chosen mode's controls show.
  // The prompt takes the sliders' height, so switching modes leaves the popover the same size. On a short landscape
  // screen the two sliders share one row, which leaves room for the space between the groups.
  let boxControls: React.ReactNode = (
    <div className="short:grid short:grid-cols-2 short:gap-x-3">
      <RangeRow
        title="Min depth"
        value={bvhMinDepth}
        min={bvhDepthRange.min}
        max={bvhDepthRange.max}
        disabled={!showBvhWireframe}
        onChange={setBvhMinDepth}
      />
      <RangeRow
        title="Max depth"
        value={bvhMaxDepth}
        min={bvhDepthRange.min}
        max={bvhDepthRange.max}
        disabled={!showBvhWireframe}
        onChange={setBvhMaxDepth}
      />
    </div>
  )
  if (showSelectedBoxesOnly) {
    boxControls = (
      <p
        className={`flex min-h-22 items-center text-xs text-gray-600 dark:text-gray-400 short:min-h-9 ${showBvhWireframe ? '' : 'opacity-40'}`}
      >
        Select a triangle to show every BVH box from the root node down to its leaf node. Select empty space to clear.
      </p>
    )
  }

  // `SettingsGroup` drops its top margin on a short screen, where the settings card's groups sit side by side. These
  // groups stay stacked, so the space between them comes from here instead.
  return (
    <div className="short:space-y-2.5">
      <SettingsGroup title="Mesh geometry">
        <Toggle label="Triangular faces" checked={showMeshWireframe} onChange={setShowMeshWireframe} />
      </SettingsGroup>
      <SettingsGroup title="Bounding volume hierarchy">
        <Toggle label="Axis-aligned bounding boxes" checked={showBvhWireframe} onChange={setShowBvhWireframe} />
        <SegmentedControl
          legend="Which boxes to show"
          options={boxModes}
          value={showSelectedBoxesOnly ? 'selected' : 'depth'}
          disabled={!showBvhWireframe}
          onChange={mode => setShowSelectedBoxesOnly(mode === 'selected')}
        />
        {boxControls}
      </SettingsGroup>
    </div>
  )
}
