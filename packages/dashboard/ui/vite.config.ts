import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.DASHBOARD_UI_PORT ?? 3000),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.DASHBOARD_API_PORT ?? 3001}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              proxyRes.headers['set-cookie'] = cookies.map((c) =>
                c.replace(/;\s*Secure/i, '').replace(/Domain=[^;]+;?\s*/i, ''),
              );
            }
          });
        },
      },
    },
  },
});
