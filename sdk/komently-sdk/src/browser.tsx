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
    // Check for elements with data-public-id (new pattern)
    const dataContainers = document.querySelectorAll('[data-public-id]');
    dataContainers.forEach((el) => {
        // If it's already initialized or specifically meant for Komently
        if (el.id === 'komently-container' || el.hasAttribute('data-komently')) {
            const publicId = el.getAttribute('data-public-id');
            const baseUrl = el.getAttribute('data-base-url') || undefined;
            const pageSize = parseInt(el.getAttribute('data-page-size') || '5', 10);

            if (publicId) {
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
        }
    });

    // Legacy/Simple ID-based check
    const container = document.getElementById('komently-container');
    if (container && !container.hasAttribute('data-komently-initialized')) {
        const publicId = container.getAttribute('data-public-id');
        if (publicId) {
            container.setAttribute('data-komently-initialized', 'true');
            const root = createRoot(container);
            root.render(
                <React.StrictMode>
                    <CommentSection
                        publicId={publicId}
                        baseUrl={container.getAttribute('data-base-url') || undefined}
                    />
                </React.StrictMode>
            );
        }
    }
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
