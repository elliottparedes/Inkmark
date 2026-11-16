/**
 * Minimal, provider-agnostic analytics helper.
 *
 * Cloudflare Web Analytics (the default on this project) records page views
 * automatically but does not support custom events natively. This helper
 * forwards events to any of the following if they're installed, and logs
 * everything in development:
 *
 *   - Plausible:  window.plausible(event, { props })
 *   - Umami:      window.umami.track(event, props)
 *   - GA4:        window.gtag('event', event, props)
 */
export function track(event, props = {}) {
  if (typeof window === 'undefined') return

  if (typeof window.plausible === 'function') {
    window.plausible(event, { props })
  }
  if (window.umami && typeof window.umami.track === 'function') {
    window.umami.track(event, props)
  }
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, props)
  }
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, props)
  }
}
