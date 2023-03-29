import { defineConfig } from 'vite'
import preprocess from 'svelte-preprocess'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import autoprefixer from 'autoprefixer'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    legacy({
      // for ie11
      targets: ["ie >= 11"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      polyfills: ["es.array.iterator"],
    }),
    svelte({
      preprocess: preprocess({
        scss: {
          includePaths: ["src"],
        },
        postcss: {
          plugins: [autoprefixer()],
        },
      }),
    }),
  ],
})
