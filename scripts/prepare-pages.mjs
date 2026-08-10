import { copyFile, readFile, writeFile } from 'node:fs/promises'

await copyFile('dist/index.html', 'dist/404.html')
const index = await readFile('dist/index.html', 'utf8')
const asset = index.match(/assets\/(index-[^"']+\.js)/)?.[1] || ''
await writeFile('dist/version.json', JSON.stringify({ asset, builtAt: new Date().toISOString() }))
