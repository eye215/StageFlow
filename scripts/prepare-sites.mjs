import { cp, mkdir, readdir, rename, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const client = new URL('../dist/client/', import.meta.url)
const server = new URL('../dist/server/', import.meta.url)
const entries = await readdir(dist)

await mkdir(client, { recursive: true })
for (const entry of entries) {
  if (entry === 'client' || entry === 'server' || entry === '.openai') continue
  await rename(new URL(`../dist/${entry}`, import.meta.url), new URL(`../dist/client/${entry}`, import.meta.url))
}

await mkdir(server, { recursive: true })
await writeFile(new URL('../dist/server/index.js', import.meta.url), `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404) return withFreshHtml(response)
    const url = new URL(request.url)
    url.pathname = '/index.html'
    return withFreshHtml(await env.ASSETS.fetch(new Request(url, request)))
  }
}

function withFreshHtml(response) {
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}\n`)

await mkdir(new URL('../dist/.openai/', import.meta.url), { recursive: true })
await cp(new URL('../.openai/hosting.json', import.meta.url), new URL('../dist/.openai/hosting.json', import.meta.url))
