import { defineConfig } from 'vite'

export default defineConfig({
  base: '/qiuxia-workshop/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        workshop: 'workshop.html'
      }
    }
  }
})
