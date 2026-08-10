const currentAsset = [...document.scripts].map((script) => script.src).find((src) => /\/assets\/index-[^/]+\.js/.test(src))?.split('/').pop() || ''

async function refreshWhenDeploymentChanged() {
  try {
    const base = import.meta.env.BASE_URL || '/'
    const response = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return
    const version = await response.json()
    if (!version.asset || !currentAsset || version.asset === currentAsset) return
    const guard = `stageflow-refresh-${version.asset}`
    if (sessionStorage.getItem(guard)) return
    const registration = await navigator.serviceWorker?.getRegistration()
    let reloading = false
    const reload = () => {
      if (reloading) return
      reloading = true
      sessionStorage.setItem(guard, '1')
      window.location.reload()
    }
    if (!registration) return reload()
    navigator.serviceWorker?.addEventListener('controllerchange', reload, { once: true })
    await registration?.update()
    if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    // Some mobile browsers activate the new worker after the update promise.
    // The controllerchange handler reloads immediately; this fallback prevents
    // a stale app shell when that event is delayed or omitted.
    window.setTimeout(reload, 2500)
  } catch {
    // Offline sessions keep the cached app and retry on the next launch.
  }
}

window.setTimeout(refreshWhenDeploymentChanged, 1200)
