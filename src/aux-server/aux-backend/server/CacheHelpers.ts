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
export interface CacheControlHeaderValues {
    public?: boolean;
    private?: boolean;
    'max-age'?: number;
    's-maxage'?: number;
    'no-cache'?: boolean;
    'no-store'?: boolean;
}

/**
 * Parses the value of a cache control header.
 * @param value The value.
 */
export function parseCacheControlHeader(
    value: string
): CacheControlHeaderValues {
    let values: any = {};

    const directives = value.split(',').map((d) => d.trim());
    for (let i = 0; i < directives.length; i++) {
        const split = directives[i].split('=');
        if (split.length === 2) {
            values[split[0]] = parseInt(split[1]);
        } else if (split.length === 1) {
            values[split[0]] = true;
        }
    }

    return values;
}

export function formatCacheControlHeader(header: CacheControlHeaderValues) {
    let entries: string[] = [];
    for (let key in header) {
        if (Object.prototype.hasOwnProperty.call(header, key)) {
            let val = (<any>header)[key];
            if (typeof val === 'boolean') {
                entries.push(key);
            } else {
                entries.push(`${key}=${val}`);
            }
        }
    }

    return entries.join(', ');
}
