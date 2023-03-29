import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { globbySync } from "globby"
import preprocess from "svelte-preprocess"
import autoprefixer from "autoprefixer"
import legacy from '@vitejs/plugin-legacy'
const components = []

globbySync("src/lib/**/*.svelte").map((path) =>
  components.push(path)
)

export default defineConfig({
  build: {
    rollupOptions: {
      input: components,
      output: {
        entryFileNames: "[name].js",
        format: "umd",
      },
    },
    outDir: "public/components/",
  },
  plugins: [
    legacy({
      // for ie11
      targets: ["ie >= 11"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      polyfills: ["es.array.iterator"],
    }),
    svelte({
      compilerOptions: {
        customElement: true,
      },
      exclude: ["./src/App.svelte"],
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
