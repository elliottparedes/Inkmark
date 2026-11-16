import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Multi-page app: index.html (the editor) + faq.html (SEO practice page).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        faq: resolve(import.meta.dirname, 'faq.html'),
      },
    },
  },
})
