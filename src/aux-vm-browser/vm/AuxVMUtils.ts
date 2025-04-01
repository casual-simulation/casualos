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

export function getVMOrigin(
    configuredOrigin: string | null,
    defaultOrigin: string,
    instId: string
): string {
    if (!configuredOrigin) {
        return defaultOrigin;
    }

    let indexOfBraces = configuredOrigin.indexOf('{{');
    if (indexOfBraces >= 0) {
        let endOfBraces = configuredOrigin.indexOf('}}', indexOfBraces);
        if (
            endOfBraces >= 0 &&
            configuredOrigin.substring(indexOfBraces + 2, endOfBraces) ===
                'inst'
        ) {
            instId = instId.replace(/[^a-zA-Z0-9]/g, '-');
            return (
                configuredOrigin.substring(0, indexOfBraces) +
                instId +
                configuredOrigin.substring(endOfBraces + 2)
            );
        }
    }

    return configuredOrigin;
}

/**
 * Gets the base domain of the given origin. That is, the hostname but with all subdomains removed.
 * @param origin The origin that should be used.
 */
export function getBaseOrigin(origin: string): string {
    try {
        let url = new URL(origin);
        let parts = url.hostname.split('.');
        if (parts.length < 3) {
            return url.origin;
        }
        url.hostname = parts.slice(1).join('.');
        return url.origin;
    } catch (err) {
        console.warn('[AuxVMUtils] Could not parse origin:', origin, err);
        return origin;
    }
}
