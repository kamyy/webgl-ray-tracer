/**
 * A circular progress indicator with the percentage in its middle.
 *
 * The ring is a conic gradient: the accent color fills a pie slice from the top, and a white disc covers the middle so
 * only a ring shows. The caller sets the size with a Tailwind size class, so the ring can be bigger on a desktop than
 * on a phone. It repeats the pass count that the progress pill already prints, so it is hidden from screen readers.
 */
interface ProgressRingProps {
  proportion: number // 0.0 - 1.0
  className: string // a Tailwind size class such as `size-14`
}

export function ProgressRing({ proportion, className }: ProgressRingProps) {
  // Round to the nearest whole percent, because the label and the ring edge use the same number.
  const percent = Math.floor(proportion * 100 + 0.5)

  return (
    <div
      className={`relative flex-none rounded-full ${className}`}
      style={{ background: `conic-gradient(var(--accent) ${percent}%, var(--accent-track) 0)` }}
      aria-hidden="true"
    >
      {/* The white disc that hides the middle of the pie slice, and holds the label. */}
      <div className="absolute inset-[6%] grid place-items-center rounded-full bg-white dark:bg-gray-900 text-base font-medium md:text-lg tabular-nums">
        {percent}%
      </div>
    </div>
  )
}
