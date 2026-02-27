import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: "/" because this is a GitHub Pages *user* site (kingjas3.github.io),
// not a project site — user sites serve from the root, not a sub-path.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
