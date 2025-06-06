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
import { toBase64String, fromBase64String } from '../utils';

/**
 * Defines a type that represents the different kinds of policies that a record key can have.
 *
 * - null and "subjectfull" indicate that actions performed with this key must require a subject to provide their access token in order for operations to succeed.
 * - "subjectless" indicates that actions may be performed with key despite not having an access key from a subject.
 *
 * @dochash types/records/key
 * @docname PublicRecordKeyPolicy
 */
export type PublicRecordKeyPolicy = null | 'subjectfull' | 'subjectless';

/**
 * The default policy for keys that do not have a specified record key.
 */
export const DEFAULT_RECORD_KEY_POLICY: PublicRecordKeyPolicy = 'subjectfull';

/**
 * Formats the given record name and record secret into a record key.
 * @param recordName The name of the record.
 * @param recordSecret The secret that is used to access the record.
 */
export function formatV1RecordKey(
    recordName: string,
    recordSecret: string
): string {
    return `vRK1.${toBase64String(recordName)}.${toBase64String(recordSecret)}`;
}

/**
 * Formats the given record name and record secret into a record key.
 * @param recordName The name of the record.
 * @param recordSecret The secret that is used to access the record.
 * @param keyPolicy The policy that the key uses.
 */
export function formatV2RecordKey(
    recordName: string,
    recordSecret: string,
    keyPolicy: PublicRecordKeyPolicy
): string {
    return `vRK2.${toBase64String(recordName)}.${toBase64String(
        recordSecret
    )}.${keyPolicy ?? DEFAULT_RECORD_KEY_POLICY}`;
}

/**
 * Parses the given record key into a name and password pair.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 */
export function parseRecordKey(
    key: string
): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    return parseV2RecordKey(key) ?? parseV1RecordKey(key);
}

/**
 * Parses a version 2 record key into a name, password, and policy trio.
 * Returns null if the key cannot be parsed or if it is not a V2 key.
 * @param key The key to parse.
 */
export function parseV2RecordKey(
    key: string
): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vRK2.')) {
        return null;
    }

    const withoutVersion = key.slice('vRK2.'.length);
    let periodAfterName = withoutVersion.indexOf('.');
    if (periodAfterName < 0) {
        return null;
    }

    const nameBase64 = withoutVersion.slice(0, periodAfterName);
    const passwordPlusPolicy = withoutVersion.slice(periodAfterName + 1);

    if (nameBase64.length <= 0 || passwordPlusPolicy.length <= 0) {
        return null;
    }

    const periodAfterPassword = passwordPlusPolicy.indexOf('.');
    if (periodAfterPassword < 0) {
        return null;
    }

    const passwordBase64 = passwordPlusPolicy.slice(0, periodAfterPassword);
    const policy = passwordPlusPolicy.slice(periodAfterPassword + 1);

    if (passwordBase64.length <= 0 || policy.length <= 0) {
        return null;
    }

    if (policy !== 'subjectfull' && policy !== 'subjectless') {
        return null;
    }

    try {
        const name = fromBase64String(nameBase64);
        const password = fromBase64String(passwordBase64);

        return [name, password, policy];
    } catch (err) {
        return null;
    }
}

/**
 * Parses a version 1 record key into a name and password pair.
 * Returns null if the key cannot be parsed or if it is not a V1 key.
 * @param key The key to parse.
 */
export function parseV1RecordKey(
    key: string
): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vRK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vRK1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }

    const nameBase64 = withoutVersion.slice(0, nextPeriod);
    const passwordBase64 = withoutVersion.slice(nextPeriod + 1);

    if (nameBase64.length <= 0 || passwordBase64.length <= 0) {
        return null;
    }

    try {
        const name = fromBase64String(nameBase64);
        const password = fromBase64String(passwordBase64);

        return [name, password, DEFAULT_RECORD_KEY_POLICY];
    } catch (err) {
        return null;
    }
}

/**
 * Determines if the given value is a record key.
 * @param key The value to check.
 * @returns
 */
export function isRecordKey(key: unknown): key is string {
    return typeof key === 'string' && parseRecordKey(key) !== null;
}
