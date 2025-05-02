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

import { hasValue } from '../bots';

export interface VersionNumber {
    version: string | null;
    major: number | null;
    minor: number | null;
    patch: number | null;
    alpha: boolean | number | null;
    tag: string | null;
}

/**
 * Parses the given version number.
 * @param version The version number.
 */
export function parseVersionNumber(
    version: string | null | undefined
): VersionNumber {
    if (!version) {
        return {
            version: null,
            major: null,
            minor: null,
            patch: null,
            alpha: null,
            tag: null,
        };
    }
    const versionRegex = /^v?(\d+)\.(\d+)\.(\d+)((:|-)\w+\.?\d*)*$/i;
    const result = versionRegex.exec(version);
    if (!result) {
        return {
            version: null,
            major: null,
            minor: null,
            patch: null,
            alpha: null,
            tag: null,
        };
    }
    const [str, major, minor, patch, prerelease] = result;

    let alpha: boolean | number = false;
    if (hasValue(prerelease)) {
        alpha = true;
        const [first, number] = prerelease.split('.');
        if (hasValue(number)) {
            alpha = parseInt(number);
        }
    }

    return {
        version: str,
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch),
        alpha,
        tag: prerelease?.substring(1) ?? null,
    };
}

/**
 * Formats the given version number.
 * @param major The major version number.
 * @param minor The minor version number.
 * @param patch The patch.
 * @param tag The tag of the version number.
 */
export function formatVersionNumber(
    major: number,
    minor: number,
    patch: number,
    tag: string
): string {
    return `v${major}.${minor}.${patch}${tag ? `-${tag}` : ''}`;
}
