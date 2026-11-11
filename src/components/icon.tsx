/**
 * A line icon drawn with SVG shapes on a 24 by 24 grid.
 *
 * Every icon in the app is outlined in the current text color with round line ends, so it follows the theme and the
 * hover color of the button around it. This component holds those shared SVG attributes once, and the caller supplies
 * only the shapes, the size and, where it differs, the line width. The icon is hidden from screen readers, because the
 * button around it carries the label.
 */

interface IconProps {
  className?: string // the size, and any color that differs from the surrounding text
  strokeWidth?: number // the line width in grid units
  children: React.ReactNode // the SVG shapes
}

export function Icon({ className = 'h-5 w-5', strokeWidth = 2, children }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}
