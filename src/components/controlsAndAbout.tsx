/**
 * How to move the camera, plus the license and project links.
 *
 * It sits in a collapsed `<details>` at the bottom of the sidebar, so the controls help is one tap away without
 * taking up room while the render settings are in use.
 */
const gestures = [
  { action: 'Rotate', mouse: 'Left-drag', touch: 'One finger' },
  { action: 'Pan', mouse: 'Right-drag', touch: 'Two fingers' },
  { action: 'Zoom', mouse: 'Wheel or middle-drag', touch: 'Pinch' },
]

export function ControlsAndAbout() {
  return (
    <details className="group border-t border-gray-300">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 text-[0.9rem] font-bold">
        Controls and about
        <svg
          className="h-5 w-5 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-3.5 text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-2 font-semibold">Action</th>
              <th className="py-1 pr-2 font-semibold">Mouse</th>
              <th className="py-1 font-semibold">Touch</th>
            </tr>
          </thead>
          <tbody>
            {gestures.map(gesture => (
              <tr key={gesture.action} className="border-t border-gray-300 align-top">
                <td className="py-1.5 pr-2 font-semibold">{gesture.action}</td>
                <td className="py-1.5 pr-2">{gesture.mouse}</td>
                <td className="py-1.5">{gesture.touch}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 text-gray-600">
          <p>
            MIT License ·{' '}
            <a className="text-[#0000ee] underline" href="https://github.com/kamyy/webgl-ray-tracer">
              Project on GitHub
            </a>
          </p>
          <p className="mt-0.5">
            Copyright &copy; 2019{' '}
            <a className="text-[#0000ee] underline" href="mailto:kam.yin.yip@gmail.com">
              Kam Y Yip
            </a>
          </p>
        </div>
      </div>
    </details>
  )
}
