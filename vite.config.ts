import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Set VITE_DEV_PROXY_TARGET (e.g. https://api.openplanai.com) to point the local
  // frontend at a deployed backend while keeping requests same-origin. The deployed
  // backend's auth cookies are SameSite=Lax, so a direct cross-site call from
  // localhost never gets them back on the next request (login "succeeds" but every
  // following call 401s). Proxying through Vite means the browser only ever talks
  // to localhost:8080, so cookies flow normally; pair with VITE_API_BASE_URL and
  // VITE_WS_URL set to http://localhost:8080/... in .env.
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET;

  return {
  server: {
    // Explicit localhost keeps the HMR WebSocket + HTTP ping on the same host as the page
    // (fixes endless failed fetch() in vite/dist/client/client.mjs waitForSuccessfulPing when
    // using host: "::" or mismatched IPv6/LAN URLs). For real-device testing via LAN IP, set
    // host: true and configure server.hmr.host to that IP.
    host: "localhost",
    port: 8080,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 8080,
    },
    ...(devProxyTarget && {
      proxy: {
        "/api": { target: devProxyTarget, changeOrigin: true, secure: true },
        "/socket.io": { target: devProxyTarget, changeOrigin: true, secure: true, ws: true },
      },
    }),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large vendor libraries into separate chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-dates': ['date-fns'],
          'vendor-dnd': ['@hello-pangea/dnd'],
          'vendor-pdf': ['react-pdf', 'pdfjs-dist'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
    // Enable tree-shaking
    treeshake: true,
    // Improve source maps for production debugging
    sourcemap: mode === 'development',
    // Minify in production
    minify: mode === 'production' ? 'esbuild' : false,
  },
  };
});
