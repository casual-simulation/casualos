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

export async function getPushManager(): Promise<PushManager | null> {
    return (await getServiceWorkerRegistration())?.pushManager ?? null;
}

/**
 * Gets the service worker registration for the current browser or null if not supported.
 * @param timeoutMs The number of milliseconds to wait before timing out.
 */
export async function getServiceWorkerRegistration(
    timeoutMs: number = 15000
): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        return null;
    }
    const registration = (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(null);
            }, 15000);
        }),
    ])) as ServiceWorkerRegistration;

    return registration ?? null;
}
