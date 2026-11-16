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
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

describe('player service worker configuration routes', () => {
    it('prefers fresh configuration and bootstrap HTML before the precached shell', () => {
        const routes: {
            match: (context: { url: URL }) => boolean;
            strategy: any;
        }[] = [];
        class NetworkFirst {
            constructor(public options: any) {}
        }
        class CachedStrategy {}
        const modules = {
            'workbox-precaching': {
                cleanupOutdatedCaches() {},
                precacheAndRoute() {
                    routes.push({ match: () => true, strategy: 'precache' });
                },
            },
            'workbox-core': { clientsClaim() {} },
            'workbox-routing': {
                registerRoute(
                    match: (context: { url: URL }) => boolean,
                    strategy: any
                ) {
                    routes.push({ match, strategy });
                },
            },
            'workbox-strategies': {
                NetworkFirst,
                StaleWhileRevalidate: CachedStrategy,
                CacheFirst: CachedStrategy,
            },
            'workbox-expiration': { ExpirationPlugin: CachedStrategy },
            '../shared/service-worker': {},
        };
        const source = fs.readFileSync(`${__dirname}/sw.ts`, 'utf8');
        const compiled = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText;
        vm.runInNewContext(compiled, {
            exports: {},
            require: (name: string) => modules[name as keyof typeof modules],
            self: { __WB_MANIFEST: [], addEventListener() {} },
            addEventListener() {},
        });
        for (const path of [
            '/',
            '/?inst=new-inst',
            '/index.html',
            '/api/config',
        ]) {
            const url = new URL(path, 'https://test.spaceladders.io');
            const route = routes.find((route) => route.match({ url }));
            expect(route.strategy).toBeInstanceOf(NetworkFirst);
            expect(route.strategy.options.cacheName).toBe(
                path === '/api/config' ? 'web-config' : 'root'
            );
        }
    });
});
