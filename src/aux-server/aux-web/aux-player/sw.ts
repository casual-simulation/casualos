import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, Route } from 'workbox-routing';
import {
    StaleWhileRevalidate,
    CacheFirst,
    NetworkFirst,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import '../shared/service-worker';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    clientsClaim();
});

registerRoute(
    ({ url }) => /esbuild(\.\w+)?\.wasm$/.test(url.pathname),
    new CacheFirst({
        cacheName: 'esbuild',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 1,
            }),
        ],
    })
);

registerRoute(
    ({ url }) => /draco_decoder(\.\w+)?\.wasm$/.test(url.pathname),
    new StaleWhileRevalidate({
        plugins: [
            new ExpirationPlugin({
                maxEntries: 1,
            }),
        ],
    })
);

registerRoute(
    ({ url }) => /\.wasm$/.test(url.pathname),
    new CacheFirst({
        cacheName: 'wasm',
        plugins: [
            new ExpirationPlugin({
                maxAgeSeconds: 604800, // 7 days in seconds
            }),
        ],
    })
);

registerRoute(
    ({ url }) => /\/api\/config$/.test(url.pathname),
    new NetworkFirst()
);
