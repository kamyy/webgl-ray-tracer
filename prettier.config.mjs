/** @type {import("prettier").Config} */
export default {
  // The first plugin uses TypeScript's organize imports (same as VS Code source.organizeImports). The Tailwind plugin
  // sorts class names and must come last.
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/styles/globals.css',

  // Line formatting
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,

  // Quotes and commas
  singleQuote: true,
  trailingComma: 'all',
  semi: false,

  // Brackets and spacing
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',

  // Line endings
  endOfLine: 'lf',

  // File-specific overrides
  overrides: [
    {
      files: '*.css',
      options: {
        singleQuote: false,
      },
    },
  ],
}
