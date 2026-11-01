/**
 * How to move the camera, plus the license and project links.
 *
 * It fills the About popover, so this information is one tap away without taking up room while the render settings are
 * in use.
 */
// One row per camera action, with the mouse and touch gesture that does it. The camera controls come from drei's
// `CameraControls`, whose default bindings these rows describe.
const gestures = [
  { action: 'Rotate', mouse: 'Left-drag', touch: 'One finger' },
  { action: 'Pan', mouse: 'Right-drag', touch: 'Two fingers' },
  { action: 'Zoom', mouse: 'Wheel or middle-drag', touch: 'Pinch' },
]

export function About() {
  return (
    <div className="text-base">
      {/* The gesture table. */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600 dark:text-gray-400">
            <th className="py-1 pr-2 font-semibold">Action</th>
            <th className="py-1 pr-2 font-semibold">Mouse</th>
            <th className="py-1 font-semibold">Touch</th>
          </tr>
        </thead>
        <tbody>
          {gestures.map(gesture => (
            <tr key={gesture.action} className="border-t border-gray-300 align-top dark:border-gray-600">
              <td className="py-1.5 pr-2 font-semibold">{gesture.action}</td>
              <td className="py-1.5 pr-2">{gesture.mouse}</td>
              <td className="py-1.5">{gesture.touch}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The license and the project links. */}
      <div className="mt-3 text-gray-600 dark:text-gray-400">
        <p>
          MIT License ·{' '}
          <a className="text-[#0000ee] underline dark:text-sky-400" href="https://github.com/kamyy/webgl-ray-tracer">
            github.com/kamyy/webgl-ray-tracer
          </a>
        </p>
        <p className="mt-0.5">
          Copyright &copy; 2026{' '}
          <a className="text-[#0000ee] underline dark:text-sky-400" href="mailto:kam.yin.yip@gmail.com">
            Kam Y Yip
          </a>
        </p>
      </div>
    </div>
  )
}
