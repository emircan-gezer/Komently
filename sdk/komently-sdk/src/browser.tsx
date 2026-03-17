import React from 'react';
import { createRoot } from 'react-dom/client';
import { CommentSection, CommentSectionProps } from './components/CommentSection';
import './styles/komently.css';

/**
 * Komently Browser SDK
 * Auto-mounts to <div id="komently-container"> or elements with [data-public-id]
 */

export function init(options: CommentSectionProps & { container?: string | HTMLElement }) {
    const { container, ...props } = options;
    const target = typeof container === 'string'
        ? document.getElementById(container)
        : (container || document.getElementById('komently-container'));

    if (!target) {
        console.warn('Komently: Target container not found.');
        return;
    }

    const root = createRoot(target);
    root.render(
        <React.StrictMode>
            <CommentSection {...props} />
        </React.StrictMode>
    );
}

function autoInit() {
    // Check for elements with data-public-id, data-section-id, or the legacy ID
    const selectors = ['[data-public-id]', '[data-section-id]', '#komently-container'];
    const containers = document.querySelectorAll(selectors.join(','));

    containers.forEach((el) => {
        if (el.hasAttribute('data-komently-initialized')) return;

        const publicId = el.getAttribute('data-public-id') || el.getAttribute('data-section-id');
        const baseUrl = el.getAttribute('data-base-url') || undefined;
        const pageSize = parseInt(el.getAttribute('data-page-size') || '5', 10);

        if (publicId) {
            el.setAttribute('data-komently-initialized', 'true');
            const root = createRoot(el);
            root.render(
                <React.StrictMode>
                    <CommentSection
                        publicId={publicId}
                        baseUrl={baseUrl}
                        pageSize={pageSize}
                    />
                </React.StrictMode>
            );
        }
    });
}

if (typeof window !== 'undefined') {
    // @ts-ignore
    window.Komently = { init };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}
