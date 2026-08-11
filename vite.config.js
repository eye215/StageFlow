import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    // PDF/XLSX are intentionally lazy-loaded tools. The interactive app bundle
    // stays well below this threshold and the large analyzers load on demand.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('lucide-react')) return 'icons'
          return undefined
        },
      },
    },
  },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['stageflow-icon.svg'],
    manifest: {
      name: 'StageFlow 공연 준비',
      short_name: 'StageFlow',
      description: '뮤지컬 공연 준비와 무대 진행을 한곳에서 관리합니다.',
      theme_color: '#070a12',
      background_color: '#070a12',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/StageFlow/',
      start_url: '/StageFlow/',
      icons: [{ src: '/StageFlow/stageflow-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    workbox: {
      navigateFallback: '/StageFlow/index.html',
      globPatterns: ['**/*.{js,css,html,svg,mjs}'],
      globIgnores: ['assets/pdf-*', 'assets/pdf.worker*', 'assets/xlsx-*'],
      maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    },
  })],
})
