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

import type { HtmlTagDescriptor, Plugin } from 'vite';

export interface Options {
    csp: {
        'child-src'?: string | string[];
        'script-src'?: string | string[];
        'style-src'?: string | string[];
        'img-src'?: string | string[];
        'font-src'?: string | string[];
        'connect-src'?: string | string[];
        'default-src'?: string | string[];
        'frame-src'?: string | string[];
        'fenced-frame-src'?: string | string[];
        'object-src'?: string | string[];
        'manifest-src'?: string | string[];
        'media-src'?: string | string[];
        'worker-src'?: string | string[];
        [key: string]: string | string[] | undefined;
    };
    injectTo?: HtmlTagDescriptor['injectTo'];

    filter?: (html: string, ctx: { path: string }) => boolean;
}

/**
 * A Vite plugin that injects Content Security Policy (CSP) headers into the HTML.
 */
export default function cspPlugin(options: Options): Plugin {
    return {
        name: 'csp-plugin',
        transformIndexHtml(html, ctx) {
            if (options.filter && !options.filter(html, ctx)) {
                return;
            }

            const keys = Object.keys(options.csp);
            if (keys.length === 0) {
                return;
            }

            let cspContent = '';

            for (const key of keys) {
                const value = options.csp[key];
                if (value) {
                    if (Array.isArray(value)) {
                        cspContent += `${key} ${value.join(' ')}; `;
                    } else {
                        cspContent += `${key} ${value}; `;
                    }
                }
            }

            return [
                {
                    tag: 'meta',
                    attrs: {
                        'http-equiv': 'Content-Security-Policy',
                        content: cspContent.trim(),
                    },
                    injectTo: options.injectTo ?? 'head-prepend',
                },
            ];
        },
    };
}
