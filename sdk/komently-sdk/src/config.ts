let defaultBaseUrl = "http://localhost:3000";

let defaultApiKey = '';

export function configure(config: { baseUrl: string; apiKey?: string }) {
  defaultBaseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  if (config.apiKey) {
    defaultApiKey = config.apiKey;
  }
}

export function getBaseUrl(): string {
  return defaultBaseUrl;
}

export function getApiKey(): string {
  return defaultApiKey;
}

