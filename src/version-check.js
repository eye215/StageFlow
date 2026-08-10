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
    sessionStorage.setItem(guard, '1')
    const registration = await navigator.serviceWorker?.getRegistration()
    await registration?.update()
    if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    window.setTimeout(() => window.location.reload(), 700)
  } catch {
    // Offline sessions keep the cached app and retry on the next launch.
  }
}

window.setTimeout(refreshWhenDeploymentChanged, 1200)
