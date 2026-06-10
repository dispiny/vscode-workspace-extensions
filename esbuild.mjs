import { build, context } from 'esbuild'

const watch = process.argv.includes('--watch')
const production = process.argv.includes('--production')

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: 'info'
}

// 1) Extension host (Node) — `vscode` stays external, everything else bundled in.
const extension = {
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode']
}

// 2) Webview (browser) — React app, fully bundled.
const webview = {
  ...common,
  entryPoints: ['webview/main.tsx'],
  outfile: 'media/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic'
}

if (watch) {
  const [ec, wc] = await Promise.all([context(extension), context(webview)])
  await Promise.all([ec.watch(), wc.watch()])
  console.log('[aurora] watching…')
} else {
  await Promise.all([build(extension), build(webview)])
  console.log('[aurora] build complete')
}
