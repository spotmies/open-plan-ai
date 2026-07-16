export interface GoogleTokenResponse {
  error?: string;
  error_description?: string;
  access_token?: string;
  expires_in?: number;
}

export interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (tokenResponse: GoogleTokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

export interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
        };
      };
    };
  }
}
