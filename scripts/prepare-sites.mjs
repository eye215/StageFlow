import { cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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
    if (response.status !== 404) return response
    const url = new URL(request.url)
    url.pathname = '/index.html'
    return env.ASSETS.fetch(new Request(url, request))
  }
}\n`)

await mkdir(new URL('../dist/.openai/', import.meta.url), { recursive: true })
await cp(new URL('../.openai/hosting.json', import.meta.url), new URL('../dist/.openai/hosting.json', import.meta.url))
