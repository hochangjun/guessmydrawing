/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_MULTISYNQ_API_KEY: string
  readonly VITE_MULTISYNQ_APP_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 