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
import posthog from 'posthog-js';

if (import.meta.env.VITE_POSTHOG_API_KEY) {
    if (import.meta.env.DEV) {
        console.warn('PostHog is not initialized in development mode.');
    } else {
        const defaultHost = 'https://us.i.posthog.com';
        posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
            api_host: import.meta.env.VITE_POSTHOG_HOST ?? defaultHost,
            defaults: '2025-11-30',
        });
    }
} else {
    console.warn('PostHog API key is not defined.');
}
