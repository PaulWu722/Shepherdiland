import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /[\/]@supabase[\/]/ },
          ],
        },
      },
    },
  },
  plugins: [VitePWA({
    injectRegister: false,
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg', 'notification.js', 'avatars/*.png', 'bg/*.webp', 'islands/*.webp', 'sprites/*/*.webp'],
    manifest: {
      name: 'Shepherdiland 我的回訪',
      short_name: '我的回訪',
      lang: 'zh-Hant',
      start_url: '/',
      display: 'standalone',
      background_color: '#fff9ef',
      theme_color: '#fff9ef',
      icons: [192, 512].map(size => ({ src: `icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable' })),
    },
    workbox: {
      importScripts: ['notification.js'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
    },
  })],
})
