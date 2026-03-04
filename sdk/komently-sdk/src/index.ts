export * from './types';
export * from './config';
export * from './api-client';
export * from './token-manager';

export { CommentSection } from './components/CommentSection';
export type { CommentSectionProps, ReactionHandler } from './components/CommentSection';

// Convenience factory
import { KomentlyClient } from './api-client';
import { getBaseUrl } from './config';
import type { EmbedConfig } from './types';

export function createClient(config?: { baseUrl?: string; apiKey?: string }) {
  return new KomentlyClient(config);
}

/**
 * Easy embed function (for non-React usage)
 */
export function embedComments(config: EmbedConfig): void {
  if (typeof window === 'undefined') return;

  const containerId = config.containerId || 'komently-comments';
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Komently: Container with ID "${containerId}" not found`);
    return;
  }

  const iframe = document.createElement('iframe');
  const baseUrl = getBaseUrl();
  const iframeSrc = `${baseUrl}/embed/${config.publicId || config.sectionId}?apiKey=${encodeURIComponent(config.apiKey)}`;
  
  iframe.src = iframeSrc;
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = '400px';
  iframe.setAttribute('title', 'Komently Comments');
  iframe.setAttribute('loading', 'lazy');

  // Handle iframe resize messages
  window.addEventListener('message', (event) => {
    if (event.origin !== baseUrl) return;
    if (event.data.type === 'komently-resize') {
      iframe.style.height = event.data.height + 'px';
    }
  });

  container.appendChild(iframe);
}

