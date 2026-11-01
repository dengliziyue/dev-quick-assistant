import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * App build: popup / sidepanel / options entry pages.
 * Service worker + content scripts are built separately in scripts/build.mjs.
 * The `test` field configures Vitest.
 */
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    rollupOptions: {
      input: {
        popup: 'popup.html',
        sidepanel: 'sidepanel.html',
        options: 'options.html'
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
