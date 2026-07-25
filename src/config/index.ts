export const config = {
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Open Plan AI',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',
    wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3001',
  },
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    errorTracking: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
  },
  support: {
    // Third-party bug-report/ticketing API — called directly from the browser
    // with a bearer key, so only ever put a key here that is safe to expose
    // client-side (scoped to ticket creation, rate-limited, rotatable).
    apiUrl: import.meta.env.VITE_SUPPORT_API_URL || 'https://api.openplanai.com/api/v1',
    apiKey: import.meta.env.VITE_SUPPORT_API_KEY || '',
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

export type Config = typeof config;
