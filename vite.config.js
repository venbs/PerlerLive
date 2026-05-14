import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/PerlerLive/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globIgnores: ['**/mediapipe/**'],
      },
      manifest: {
        name: 'PerlerLive',
        short_name: 'PerlerLive',
        description: '基于P5.js的拼豆设计与创作工具',
        theme_color: '#ffffff',
        background_color: '#f8f9fa',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
