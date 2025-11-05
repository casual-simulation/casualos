/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import {
    StaleWhileRevalidate,
    CacheFirst,
    NetworkFirst,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import type { PushNotificationPayload } from '@casual-simulation/aux-records';
import '../shared/service-worker';

declare let self: ServiceWorkerGlobalScope;
declare let GIT_TAG: string;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', (event) => {
    console.log('[sw.ts] Install.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[sw.ts] Activate.');
    if (!GIT_TAG.startsWith('v2.0.14')) {
        console.log('[sw.ts] Claim Clients');
        clientsClaim();
    }
});

globalThis.addEventListener('push', (event: any) => {
    if (
        !(
            globalThis.Notification &&
            globalThis.Notification.permission === 'granted'
        )
    ) {
        return;
    }

    console.log('Got notification!', event);
    const data: PushNotificationPayload = event.data?.json();

    if (data) {
        const notificationPromise = globalThis.registration.showNotification(
            data.title,
            {
                body: data.body ?? undefined,
                icon: data.icon ?? undefined,
                badge: data.badge ?? undefined,
                silent: data.silent ?? undefined,
                tag: data.tag ?? undefined,
                timestamp: data.timestamp ?? undefined,
                actions: data.actions?.map((a) => ({
                    title: a.title,
                    action: JSON.stringify(a.action),
                    icon: a.icon ?? undefined,
                })),
                data: data,
            }
        );

        event.waitUntil(notificationPromise);
    }
});

globalThis.addEventListener('notificationclick', (event: any) => {
    console.log('Clicked notification!', event);

    const eventAction =
        event.action ||
        event.notification.action ||
        event.notification.data.action;
    let action: PushNotificationPayload['action'];
    if (typeof eventAction === 'string') {
        action = JSON.parse(eventAction);
    } else {
        action = eventAction;
    }

    let promise: Promise<any> | null = null;
    if (action) {
        if (action.type === 'open_url') {
            promise = globalThis.clients.openWindow(action.url);
        } else {
            promise = globalThis.fetch(action.url, {
                method: action.method,
                headers: action.headers as any,
            });
        }
    }

    if (promise) {
        event.waitUntil(promise);
    }
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
        cacheName: 'draco_decoder',
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
