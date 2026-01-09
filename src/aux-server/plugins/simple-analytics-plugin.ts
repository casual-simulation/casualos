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

import type { Plugin } from 'vite';

export interface Options {}

/**
 * A Vite plugin that injects Simple Analytics tracking code into the HTML.
 */
export default function simpleAnalyticsPlugin(options: Options = {}): Plugin {
    return {
        name: 'simple-analytics',
        transformIndexHtml(html) {
            html.replace(
                '<!--%analytics%-->',
                `<script
            async
            defer
            data-allow-params="pattern,ab,ask,inst"
            src="https://scripts.simpleanalyticscdn.com/latest.js"
        ></script>
        <noscript
            ><img
                src="https://queue.simpleanalyticscdn.com/noscript.gif"
                alt=""
                referrerpolicy="no-referrer-when-downgrade"
        /></noscript>`
            );
        },
    };
}
