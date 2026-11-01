/**
 * Build orchestrator.
 *  1) app build   — popup.html / sidepanel.html / options.html (ESM + hashed assets)
 *  2) worker      — service-worker.js (ES module, fixed name, referenced by manifest)
 *  3) hook-main   — content script in MAIN world  (IIFE, fixed name)
 *  4) bridge      — content script in ISOLATED world (IIFE, fixed name)
 * public/ (manifest.json, icons/, _locales/) is copied by the app build.
 *
 * The dev preview harness (preview.html) is intentionally NOT built.
 */
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cp, rm, writeFile, readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function run() {
  console.log('[1/4] building app pages…')
  await build({
    root,
    configFile: resolve(root, 'vite.config.js'),
    logLevel: 'warn'
  })

  console.log('[2/4] building service worker…')
  await build({
    root,
    logLevel: 'warn',
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      target: 'chrome116',
      rollupOptions: {
        input: resolve(root, 'src/background/service-worker.js'),
        output: {
          format: 'es',
          entryFileNames: 'service-worker.js',
          inlineDynamicImports: true,
          assetFileNames: 'assets/bg-[name][extname]'
        }
      }
    }
  })

  console.log('[3/4] building MAIN-world request hook…')
  await build({
    root,
    logLevel: 'warn',
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      target: 'chrome116',
      rollupOptions: {
        input: resolve(root, 'src/content/hook-main.js'),
        output: {
          format: 'iife',
          entryFileNames: 'content/hook-main.js',
          inlineDynamicImports: true
        }
      }
    }
  })

  console.log('[4/4] building bridge content script…')
  await build({
    root,
    logLevel: 'warn',
    build: {
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      target: 'chrome116',
      rollupOptions: {
        input: resolve(root, 'src/content/bridge.js'),
        output: {
          format: 'iife',
          entryFileNames: 'content/bridge.js',
          inlineDynamicImports: true
        }
      }
    }
  })

  // ensure the manifest matches package version
  try {
    const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
    const manifestPath = resolve(root, 'dist/manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.version !== pkg.version) {
      manifest.version = pkg.version
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    }
  } catch {
    /* manifest sync is best-effort */
  }

  console.log('✓ build complete → dist/')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
