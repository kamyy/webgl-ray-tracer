type GtagCommand = ['js', Date] | ['config', string]

declare global {
  interface Window {
    dataLayer?: GtagCommand[]
  }
}

export function initializeGoogleAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
  if (!measurementId) {
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.append(script)

  window.dataLayer = window.dataLayer ?? []

  function gtag(...args: GtagCommand) {
    window.dataLayer?.push(args)
  }

  gtag('js', new Date())
  gtag('config', measurementId)
}
