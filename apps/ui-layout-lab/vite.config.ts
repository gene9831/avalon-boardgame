import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 4175,
  },
})
