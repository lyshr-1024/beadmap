import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages 挂在 /beadmap/ 子路径，资源用绝对根路径会 404
  base: process.env.GITHUB_ACTIONS ? '/beadmap/' : '/',
  plugins: [react(), tailwindcss()],
})
