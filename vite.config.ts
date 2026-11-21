import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /[\/]three[\/]build[\/]three\.core\.js$/ },
            { name: 'three-renderer', test: /[\/]three[\/]/ },
            { name: 'supabase', test: /[\/]@supabase[\/]/ },
          ],
        },
      },
    },
  },
  plugins: [VitePWA({
    injectRegister: false,
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg', 'notification.js', 'avatars/*.png'],
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
      runtimeCaching: [{
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/models\/(?:island|char)_[a-z]+\.glb$/.test(url.pathname),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'shepherdiland-glb-v1',
          plugins: [{
            cacheWillUpdate: async ({ response }) => {
              if (response.status !== 200) return null
              const bytes = await response.clone().arrayBuffer()
              if (bytes.byteLength < 20) return null
              const header = new DataView(bytes)
              return header.getUint32(0, true) === 0x46546c67 && header.getUint32(8, true) === bytes.byteLength
                ? response : null
            },
          }],
        },
      }],
    },
  })],
})
