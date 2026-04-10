/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_ENV: string
  readonly VITE_AUTH_PASSWORD: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_KNOWLEDGE_API_URL: string
  readonly VITE_KNOWLEDGE_API_TOKEN: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_ASAAS_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
