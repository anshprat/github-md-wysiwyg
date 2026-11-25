import { readFileSync, rmSync, statSync } from 'node:fs'

import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')
const outdir = 'dist'

rmSync(outdir, { recursive: true, force: true })

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outdir,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': '"production"',
    // lodash finds the global object with `global || self || Function('return this')()`.
    // In a Firefox content script `self` is the page window seen through a wrapper, so
    // lodash falls back to Function(), which the extension CSP blocks and the editor fails
    // to load. With `global` set, lodash stops at the first check in every browser.
    global: 'globalThis',
  },
}

const entries = [
  { in: 'src/content/bridge-main.ts', out: 'bridge-main' },
  { in: 'src/content/loader.ts', out: 'loader' },
  { in: 'src/content/loader.css', out: 'loader' },
  { in: 'src/background.ts', out: 'background' },
  { in: 'src/editor/index.ts', out: 'editor' },
]

const ctx = await esbuild.context({ ...common, entryPoints: entries, metafile: true })
if (watch) {
  await ctx.watch()
} else {
  const result = await ctx.rebuild()
  await ctx.dispose()
  for (const file of Object.keys(result.metafile.outputs)) {
    console.log(`${file.padEnd(28)} ${(statSync(file).size / 1024).toFixed(0).padStart(6)} KB`)
  }
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
  console.log(`built ${manifest.name} v${manifest.version}`)
}
