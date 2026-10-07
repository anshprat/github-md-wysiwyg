/**
 * End-to-end test: loads the built extension into Chromium and drives it on
 * a mock github.com edit page (see fixture/mock-github.ts).
 *
 *   npm run test:e2e            # headless
 *   HEADED=1 npm run test:e2e   # watch it run
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const shotDir = process.env.SHOT_DIR ?? tmpdir()

const README = `# Acme Docs

Some *intro* text with __bold__ and a [ref link][docs].

![logo](docs/logo.png) ![badge](https://img.shields.io/badge/build-passing-green)

- one
- two
- three

| Name | Value |
|------|-------|
| a    | 1     |

\`\`\`js
const answer = 42
\`\`\`

<p align="center">
  <b>HTML block</b>
</p>

Last paragraph.

[docs]: https://example.com/docs
`

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const mockJs = (
  await esbuild.build({
    entryPoints: [join(root, 'test/e2e/fixture/mock-github.ts')],
    bundle: true,
    format: 'iife',
    write: false,
  })
).outputFiles[0].text
const markdownCss = readFileSync(join(root, 'node_modules/github-markdown-css/github-markdown-light.css'), 'utf8')

function page(file) {
  return `<!doctype html><html data-color-mode="light"><head><meta charset="utf-8">
<style>${markdownCss}
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; }
.markdown-body { box-sizing: border-box; }
.Panel-module__Box__AdYCI { border: 1px solid #d1d9e0; border-radius: 6px; max-width: 980px; }
.BlobEditHeader-module__Box__zKgc2 { padding: 8px; border-bottom: 1px solid #d1d9e0; }
ul[aria-label="Edit mode"] { display: inline-flex; list-style: none; margin: 0; padding: 2px; background: #eff2f5; border-radius: 6px; }
ul[aria-label="Edit mode"] li button { border: 0; background: none; padding: 4px 12px; border-radius: 4px; font: inherit; }
ul[aria-label="Edit mode"] li[data-selected] button { background: #fff; font-weight: 600; box-shadow: 0 0 0 1px #d1d9e0; }
</style></head><body><div id="app"></div>
<script>window.__MOCK_FILE__ = ${JSON.stringify(file)}</script>
<script>${mockJs}</script></body></html>`
}

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'gmw-e2e-')), {
  channel: 'chromium',
  headless: !process.env.HEADED,
  viewport: { width: 1200, height: 900 },
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
})

const camoCalls = []
await context.route('https://github.com/**', (route) => {
  const url = new URL(route.request().url())
  if (url.pathname === '/acme/docs/edit/main/README.md') return route.fulfill({ contentType: 'text/html', body: page(README) })
  if (url.pathname === '/acme/docs/edit/main/index.js') return route.fulfill({ contentType: 'text/html', body: page('console.log(1)\n') })
  if (url.pathname.startsWith('/acme/docs/raw/')) return route.fulfill({ contentType: 'image/png', body: PNG })
  return route.fulfill({ status: 404, body: 'not found' })
})
await context.route('https://api.github.com/markdown', (route) => {
  const { text } = JSON.parse(route.request().postData())
  camoCalls.push(text)
  const html = [...text.matchAll(/!\[\d+\]\(<([^>]+)>\)/g)]
    .map((m, i) => `<p><img src="https://camo.githubusercontent.com/fake${i}" data-canonical-src="${m[1]}"></p>`)
    .join('')
  return route.fulfill({ contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: html })
})
await context.route('https://camo.githubusercontent.com/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))

const tab = context.pages()[0] ?? (await context.newPage())
tab.on('pageerror', (err) => console.log('  [pageerror]', err.message))
const doc = () => tab.evaluate(() => window.__mock.doc())
const settle = () => tab.waitForTimeout(400)

let failures = 0
async function step(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures++
    console.log(`  ✗ ${name}\n    ${String(err.message).split('\n').join('\n    ')}`)
    await tab.screenshot({ path: join(shotDir, `gmw-fail-${failures}.png`) }).catch(() => {})
  }
}

console.log('e2e: GitHub Markdown WYSIWYG')

await step('no toggle on a non-Markdown file', async () => {
  await tab.goto('https://github.com/acme/docs/edit/main/index.js')
  await tab.waitForSelector('.cm-editor')
  await tab.waitForTimeout(300)
  assert.equal(await tab.locator('.gmw-toggle').count(), 0)
})

await step('adds a "Rich text" option to the Edit / Preview control', async () => {
  await tab.goto('https://github.com/acme/docs/edit/main/README.md')
  const toggle = tab.locator('ul[aria-label="Edit mode"] .gmw-toggle button')
  await toggle.waitFor()
  assert.equal((await toggle.textContent()).trim(), 'Rich text')
})

await step('opens the WYSIWYG editor in place of the source editor', async () => {
  await tab.click('.gmw-toggle button')
  await tab.waitForSelector('.gmw-root .ProseMirror.markdown-body h1', { timeout: 15000 })
  assert.equal(await tab.locator('[data-gmw-host]').isVisible(), false)
  assert.equal(await tab.locator('.gmw-root .ProseMirror h1').textContent(), 'Acme Docs')
  assert.equal(await tab.locator('.gmw-root .ProseMirror .milkdown-table-block').count(), 1)
  assert.equal(await tab.getAttribute('.gmw-toggle', 'data-selected'), '')
  const states = await tab
    .locator('ul[aria-label="Edit mode"] li')
    .evaluateAll((lis) => lis.map((li) => `${li.textContent.trim()}:${li.hasAttribute('data-selected')}`))
  assert.deepEqual(states, ['Edit:false', 'Preview:false', 'Rich text:true'])
})

await step('opening rich mode does not change the file', async () => {
  await settle()
  assert.equal(await doc(), README)
})

await step('resolves relative images and proxies third-party images via camo', async () => {
  const srcs = await tab.locator('.gmw-root .ProseMirror img').evaluateAll((imgs) => imgs.map((i) => i.src))
  assert.ok(srcs.includes('https://github.com/acme/docs/raw/main/docs/logo.png'), srcs.join(', '))
  assert.ok(srcs.some((s) => s.startsWith('https://camo.githubusercontent.com/')), srcs.join(', '))
  assert.equal(camoCalls.length, 1)
})

await step('typing changes only the edited block in the file', async () => {
  await tab.locator('.gmw-root .ProseMirror p', { hasText: 'Last paragraph.' }).click()
  await tab.keyboard.press('End')
  await tab.keyboard.type(' Added text.')
  await settle()
  assert.equal(await doc(), README.replace('Last paragraph.', 'Last paragraph. Added text.'))
})

await step('keyboard formatting produces Markdown (bold)', async () => {
  await tab.keyboard.type(' ')
  await tab.keyboard.press('ControlOrMeta+b')
  await tab.keyboard.type('Strong')
  await tab.keyboard.press('ControlOrMeta+b')
  await settle()
  // The file already uses __bold__, so new bold text follows that style.
  assert.match(await doc(), /Last paragraph\. Added text\. __Strong__\n/)
})

await step('a new list item keeps the list style and leaves other blocks intact', async () => {
  await tab.locator('.gmw-root .ProseMirror li', { hasText: 'three' }).click()
  await tab.keyboard.press('End')
  await tab.keyboard.press('Enter')
  await tab.keyboard.type('four')
  await settle()
  const text = await doc()
  assert.ok(text.includes('- one\n- two\n- three\n- four\n'), text)
  assert.ok(text.includes('Some *intro* text with __bold__ and a [ref link][docs].'), text)
  assert.ok(text.includes('| Name | Value |\n|------|-------|\n| a    | 1     |'), text)
  assert.ok(text.includes('[docs]: https://example.com/docs'), text)
})

await tab.screenshot({ path: join(shotDir, 'gmw-rich.png'), fullPage: true })

await step('Edit returns to the source editor with the changes', async () => {
  const before = await doc()
  await tab.click('ul[aria-label="Edit mode"] li:first-child button')
  await tab.waitForSelector('.gmw-root', { state: 'detached' })
  assert.equal(await tab.locator('.cm-editor').isVisible(), true)
  assert.equal(await doc(), before)
  assert.equal(await tab.getAttribute('ul[aria-label="Edit mode"] li:first-child', 'data-selected'), '')
})

await step('source edits show up when rich mode reopens', async () => {
  await tab.evaluate(() => window.__mock.setDoc(window.__mock.doc() + '\nFrom source.\n'))
  await tab.click('.gmw-toggle button')
  await tab.locator('.gmw-root .ProseMirror p', { hasText: 'From source.' }).waitFor()
})

await step('Preview leaves rich mode and shows GitHub preview', async () => {
  await tab.click('ul[aria-label="Edit mode"] li:nth-child(2) button')
  await tab.waitForSelector('.gmw-root', { state: 'detached' })
  assert.equal(await tab.evaluate(() => window.__mock.previewShown()), true)
  assert.equal(await tab.locator('ul[aria-label="Edit mode"] li[data-selected]').count(), 1)
})

await step('remembers rich mode as the preferred mode', async () => {
  await tab.reload()
  await tab.waitForSelector('.gmw-root .ProseMirror h1', { timeout: 15000 })
})

await context.close()
console.log(failures ? `\n${failures} step(s) failed` : '\nall steps passed')
process.exit(failures ? 1 : 0)
