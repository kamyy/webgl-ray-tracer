/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.scss' {
  const classes: { [key: string]: string }
  export default classes
}

declare module '*.css' {
  const classes: { [key: string]: string }
  export default classes
}
