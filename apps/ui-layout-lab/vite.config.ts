import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        roomLayoutLab: new URL('./index.html', import.meta.url).pathname,
        stadiumLayoutLab: new URL('./stadium-layout-lab.html', import.meta.url).pathname,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4175,
  },
})
