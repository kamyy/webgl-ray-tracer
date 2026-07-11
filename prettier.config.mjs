/** @type {import("prettier").Config} */
export default {
  // Uses TypeScript's organize imports (same as VS Code source.organizeImports)
  plugins: ['prettier-plugin-organize-imports'],

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
      files: '*.{css,scss}',
      options: {
        singleQuote: false,
      },
    },
  ],
}
