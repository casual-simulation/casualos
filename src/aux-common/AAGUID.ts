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

// Contains general information on passkey (webauthn) authenticators.

export type AuthenticatorKind =
    | 'google-password-manager'
    | 'chrome-on-mac'
    | 'windows-hello'
    | 'icloud-keychain'
    | 'dashlane'
    | '1password'
    | 'nord-pass'
    | 'keeper'
    | 'enpass'
    | 'chromium-browser'
    | 'ms-edge-on-mac'
    | 'idmelon'
    | 'bitwarden'
    | 'samsung-pass'
    | 'thales'
    | 'unknown';

export interface AAGUIDInfo {
    kind: AuthenticatorKind;
    name: string;
}

export interface AAGUIDMap {
    [aaguid: string]: AAGUIDInfo;
}

export const aaguidMap: AAGUIDMap = {
    'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': {
        kind: 'google-password-manager',
        name: 'Google Password Manager',
    },
    'adce0002-35bc-c60a-648b-0b25f1f05503': {
        kind: 'chrome-on-mac',
        name: 'Chrome on Mac',
    },
    '08987058-cadc-4b81-b6e1-30de50dcbe96': {
        kind: 'windows-hello',
        name: 'Windows Hello',
    },
    '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': {
        kind: 'windows-hello',
        name: 'Windows Hello',
    },
    '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': {
        kind: 'windows-hello',
        name: 'Windows Hello',
    },
    'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': {
        kind: 'icloud-keychain',
        name: 'iCloud Keychain (Managed)',
    },
    '531126d6-e717-415c-9320-3d9aa6981239': {
        kind: 'dashlane',
        name: 'Dashlane',
    },
    'bada5566-a7aa-401f-bd96-45619a55120d': {
        kind: '1password',
        name: '1Password',
    },
    'b84e4048-15dc-4dd0-8640-f4f60813c8af': {
        kind: 'nord-pass',
        name: 'NordPass',
    },
    '0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': {
        kind: 'keeper',
        name: 'Keeper',
    },
    'f3809540-7f14-49c1-a8b3-8f813b225541': {
        kind: 'enpass',
        name: 'Enpass',
    },
    'b5397666-4885-aa6b-cebf-e52262a439a2': {
        kind: 'chromium-browser',
        name: 'Chromium Browser',
    },
    '771b48fd-d3d4-4f74-9232-fc157ab0507a': {
        kind: 'ms-edge-on-mac',
        name: 'Edge on Mac',
    },
    '39a5647e-1853-446c-a1f6-a79bae9f5bc7': {
        kind: 'idmelon',
        name: 'IDmelon',
    },
    'd548826e-79b4-db40-a3d8-11116f7e8349': {
        kind: 'bitwarden',
        name: 'Bitwarden',
    },
    'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': {
        kind: 'icloud-keychain',
        name: 'iCloud Keychain',
    },
    '53414d53-554e-4700-0000-000000000000': {
        kind: 'samsung-pass',
        name: 'Samsung Pass',
    },
    '66a0ccb3-bd6a-191f-ee06-e375c50b9846': {
        kind: 'thales',
        name: 'Thales Bio iOS SDK',
    },
    '8836336a-f590-0921-301d-46427531eee6': {
        kind: 'thales',
        name: 'Thales Bio Android SDK',
    },
    'cd69adb5-3c7a-deb9-3177-6800ea6cb72a': {
        kind: 'thales',
        name: 'Thales PIN Android SDK',
    },
    '17290f1e-c212-34d0-1423-365d729f09d9': {
        kind: 'thales',
        name: 'Thales PIN iOS SDK',
    },
} as const;

export function getInfoForAAGUID(aaguid: string): AAGUIDInfo {
    const info = aaguidMap[aaguid];

    if (info) {
        return info;
    } else {
        return {
            name: 'Unknown Authenticator',
            kind: 'unknown',
        };
    }
}
