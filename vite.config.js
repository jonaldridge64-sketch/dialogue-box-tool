import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Change this to your repo name when deploying
  // e.g. base: '/dialogue-box-tool/'
  base: '/dialogue-box-tool/',
})
