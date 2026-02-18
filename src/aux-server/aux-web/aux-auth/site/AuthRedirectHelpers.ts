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

import type VueRouter from 'vue-router';

/**
 * Redirects the user to the appropriate page after logging in or registering.
 * @param router The Vue router instance to use for navigation.
 * @param after The location to redirect to after logging in. This can be a URL or a named route.
 */
export function redirectAfterLogin(
    router: VueRouter,
    after: string | null | undefined
) {
    if (after) {
        if (after.startsWith('casualquilt-auth:')) {
            // If the after value looks like a URL, redirect to it directly
            location.href = after;
        } else {
            router.push(after);
        }
    } else {
        router.push({ name: 'home' });
    }
}
