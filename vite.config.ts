import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  console.log('--- DEBUG VITE CONFIG ---');
  console.log('VITE_ASAAS_API_KEY:', env.VITE_ASAAS_API_KEY ? 'DEFINED' : 'UNDEFINED');
  console.log('VITE_ASAAS_API_KEY (first 10 chars):', env.VITE_ASAAS_API_KEY ? env.VITE_ASAAS_API_KEY.substring(0, 10) : 'N/A');
  console.log('-------------------------');
  
  return {
    server: {
      host: "::",
    port: 8080,
    proxy: {
      '/api/asaas': {
        target: 'https://api-sandbox.asaas.com/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/asaas/, ''),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
