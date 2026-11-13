/**
 * A titled box around a group of related settings.
 *
 * Every panel groups its controls with it, so the panels look alike. The box is a fieldset, so the title sits on its
 * border and screen readers announce it with each setting in the group.
 */

interface SettingsGroupProps {
  title: string
  children: React.ReactNode
}

// `min-w-0` lets the box shrink inside a grid column, which a fieldset otherwise refuses to do below its content's
// width.
export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <fieldset className="mt-3 min-w-0 rounded-xl border border-gray-300 px-2 pb-1.5 dark:border-gray-600 short:mt-0">
      <legend className="px-1 text-xs font-bold tracking-wide uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}
