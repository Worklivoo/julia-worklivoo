import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const metaAccessToken = env.META_ACCESS_TOKEN || env.VITE_META_ACCESS_TOKEN || '';
  const metaAppId = env.META_APP_ID || env.VITE_META_APP_ID || '';
  const asaasApiKeyFromViteEnv = env.VITE_ASAAS_API_KEY || '';
  const asaasApiKeyFromServerEnv = env.ASAAS_API_KEY || '';
  const readSalvyTokenFromPhp = () => {
    try {
      const phpPath = path.resolve(process.cwd(), "salvy-secrets.php");
      if (!fs.existsSync(phpPath)) return '';
      const content = fs.readFileSync(phpPath, "utf8");
      const match = content.match(/SALVY_ACCESS_TOKEN'\s*=>\s*'([^']+)'/);
      return match?.[1]?.trim() || '';
    } catch {
      return '';
    }
  };
  const readSalvyTokenFromIni = () => {
    try {
      const iniPath = path.resolve(process.cwd(), ".salvy-secrets.ini");
      if (!fs.existsSync(iniPath)) return '';
      const content = fs.readFileSync(iniPath, "utf8");
      const match = content.match(/SALVY_ACCESS_TOKEN\s*=\s*(.+)/);
      return match?.[1]?.trim().replace(/^["']|["']$/g, "") || '';
    } catch {
      return '';
    }
  };
  const salvyAccessToken = env.SALVY_ACCESS_TOKEN || readSalvyTokenFromPhp() || readSalvyTokenFromIni() || '';
  
  return {
    ...(asaasApiKeyFromViteEnv
      ? {}
      : asaasApiKeyFromServerEnv
        ? {
            define: {
              'import.meta.env.VITE_ASAAS_API_KEY': JSON.stringify(asaasApiKeyFromServerEnv),
            },
          }
        : {}),
    server: {
      host: "::",
    port: 8080,
    proxy: {
      '/api/asaas': {
        target: 'https://api.asaas.com/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/asaas/, ''),
      },
      '/meta-proxy.php': {
        target: 'https://graph.facebook.com',
        changeOrigin: true,
        secure: true,
        rewrite: (reqPath) => {
          try {
            const url = new URL(reqPath, 'http://vite.local');
            const graphPath = String(url.searchParams.get('path') || '').replace(/^\/+/, '');
            if (!graphPath) return reqPath;

            const isUploadSessionStart = /^v\d+\.\d+\/uploads$/i.test(graphPath);
            const graphPathParts = graphPath.split('?');
            const graphPathOnly = graphPathParts[0];
            const embeddedQuery = graphPathParts.slice(1).join('?');
            const isUploadBinary = graphPathOnly.includes('/upload:') || /^v\d+\.\d+\/upload:/i.test(graphPathOnly);

            url.searchParams.delete('path');
            url.searchParams.delete('debug');

            if (embeddedQuery) {
              const embeddedParams = new URLSearchParams(embeddedQuery);
              for (const [k, v] of embeddedParams.entries()) {
                if (!url.searchParams.has(k)) {
                  url.searchParams.set(k, v);
                }
              }
            }

            let finalGraphPath = graphPathOnly;
            if (isUploadSessionStart && metaAppId) {
              const version = graphPathOnly.split('/')[0];
              finalGraphPath = `${version}/${metaAppId}/uploads`;
              if (metaAccessToken && !url.searchParams.get('access_token')) {
                url.searchParams.set('access_token', metaAccessToken);
              }
            }

            const qs = url.searchParams.toString();
            const finalPath = `/${finalGraphPath}${qs ? `?${qs}` : ''}`;
            return finalPath;
          } catch {
            return reqPath;
          }
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            try {
              const originalUrl = new URL(req.url || '', 'http://vite.local');
              const graphPath = String(originalUrl.searchParams.get('path') || '');
              const graphPathOnly = graphPath.split('?')[0];
              const isUploadBinary = graphPathOnly.includes('/upload:') || /^v\d+\.\d+\/upload:/i.test(graphPathOnly);
              if (metaAccessToken) {
                proxyReq.setHeader('Authorization', `${isUploadBinary ? 'OAuth' : 'Bearer'} ${metaAccessToken}`);
              }
            } catch {
              // ignore
            }
          });
        },
      },
      '/api/salvy-proxy': {
        target: 'https://api.salvy.com.br/api/v2',
        changeOrigin: true,
        secure: true,
        rewrite: (reqPath) => {
          try {
            const url = new URL(reqPath, 'http://vite.local');
            const upstreamPath = String(url.searchParams.get('path') || '').replace(/^\/+/, '');
            return upstreamPath ? `/${upstreamPath}` : reqPath;
          } catch {
            return reqPath;
          }
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (salvyAccessToken) {
              proxyReq.setHeader('Authorization', `Bearer ${salvyAccessToken}`);
            }
            proxyReq.setHeader('Accept', 'application/json');
          });
        },
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
