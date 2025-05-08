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
import { fromBase64String, toBase64String } from '../utils';
import { sha256, hmac } from 'hash.js';
import { toByteArray } from 'base64-js';
import {
    formatV1ConnectionToken,
    parseV1ConnectionToken,
} from '../common/ConnectionToken';

/**
 * Defines an interface that represents the role that a user can have.
 *
 * - "none" means that the user has no special permissions.
 * - "superUser" means that the user has additional permissions that only special users should have.
 * - "system" means that the user is the system and is performing a system operation.
 * - "moderator" means that the user is a moderator and has additional permissions to moderate content.
 */
export type UserRole = 'none' | 'superUser' | 'system' | 'moderator';

/**
 * The default lifetime at which a session key should be refreshed.
 */
export const REFRESH_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

/**
 * Formats the given user ID, session ID, session secret, and expiration time into a key that is used to authenticate a user to a particular session.
 * @param userId The ID of the user.
 * @param sessionId The ID of the session.
 * @param sessionSecret The secret for the session.
 * @param expireTimeMs The unix timestamp that the key expires at.
 */
export function formatV1SessionKey(
    userId: string,
    sessionId: string,
    sessionSecret: string,
    expireTimeMs: number | null
): string {
    return `vSK1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(sessionSecret)}.${toBase64String(
        (expireTimeMs ?? Infinity).toString()
    )}`;
}

/**
 * Parses the given session key into a user ID and session ID, and session secret array.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 */
export function parseSessionKey(
    key: string | null
): [
    userId: string,
    sessionId: string,
    sessionSecret: string,
    expireTimeMs: number
] {
    return parseV1SessionKey(key);
}

/**
 * Parses a version 1 session key into a user ID, session ID, session secret, and expiration time.
 * Returns null if the key cannot be parsed or if it is not a V1 key.
 * @param key The key to parse.
 */
export function parseV1SessionKey(
    key: string
): [
    userId: string,
    sessionId: string,
    sessionSecret: string,
    expireTimeMs: number
] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vSK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vSK1.'.length);
    let periodAfterUserId = withoutVersion.indexOf('.');
    if (periodAfterUserId < 0) {
        return null;
    }

    const userIdBase64 = withoutVersion.slice(0, periodAfterUserId);
    const sessionIdPlusPassword = withoutVersion.slice(periodAfterUserId + 1);

    if (userIdBase64.length <= 0 || sessionIdPlusPassword.length <= 0) {
        return null;
    }

    const periodAfterSessionId = sessionIdPlusPassword.indexOf('.');
    if (periodAfterSessionId < 0) {
        return null;
    }

    const sessionIdBase64 = sessionIdPlusPassword.slice(
        0,
        periodAfterSessionId
    );
    const passwordPlusExpireTime = sessionIdPlusPassword.slice(
        periodAfterSessionId + 1
    );

    if (sessionIdBase64.length <= 0 || passwordPlusExpireTime.length <= 0) {
        return null;
    }

    const periodAfterPassword = passwordPlusExpireTime.indexOf('.');
    if (periodAfterPassword < 0) {
        return null;
    }

    const passwordBase64 = passwordPlusExpireTime.slice(0, periodAfterPassword);
    const expireTimeBase64 = passwordPlusExpireTime.slice(
        periodAfterPassword + 1
    );

    if (passwordBase64.length <= 0 || expireTimeBase64.length <= 0) {
        return null;
    }

    try {
        const userId = fromBase64String(userIdBase64);
        const sessionId = fromBase64String(sessionIdBase64);
        const password = fromBase64String(passwordBase64);
        const expireTimeText = fromBase64String(expireTimeBase64);
        const expireTime =
            expireTimeText === 'Infinity' ? null : parseInt(expireTimeText);

        return [userId, sessionId, password, expireTime];
    } catch (err) {
        return null;
    }
}

/**
 * Formats the given user ID, session ID, connection secret, and expiration time into a key that is used to generate connection tokens.
 * @param userId The ID of the user.
 * @param sessionId The ID of the session.
 * @param sessionSecret The secret for the connections.
 * @param expireTimeMs The unix timestamp that the key expires at.
 */
export function formatV1ConnectionKey(
    userId: string,
    sessionId: string,
    connectionSecret: string,
    expireTimeMs: number | null
): string {
    return `vCK1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(connectionSecret)}.${toBase64String(
        (expireTimeMs ?? Infinity).toString()
    )}`;
}

/**
 * Parses the given connection key into a user ID and session ID, and connection secret array.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 */
export function parseConnectionKey(
    key: string | null
): [
    userId: string,
    sessionId: string,
    connectionSecret: string,
    expireTimeMs: number
] {
    return parseV1ConnectionKey(key);
}

/**
 * Parses a version 1 session key into a user ID, session ID, session secret, and expiration time.
 * Returns null if the key cannot be parsed or if it is not a V1 key.
 * @param key The key to parse.
 */
export function parseV1ConnectionKey(
    key: string
): [
    userId: string,
    sessionId: string,
    connectionSecret: string,
    expireTimeMs: number
] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vCK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vCK1.'.length);
    let periodAfterUserId = withoutVersion.indexOf('.');
    if (periodAfterUserId < 0) {
        return null;
    }

    const userIdBase64 = withoutVersion.slice(0, periodAfterUserId);
    const sessionIdPlusPassword = withoutVersion.slice(periodAfterUserId + 1);

    if (userIdBase64.length <= 0 || sessionIdPlusPassword.length <= 0) {
        return null;
    }

    const periodAfterSessionId = sessionIdPlusPassword.indexOf('.');
    if (periodAfterSessionId < 0) {
        return null;
    }

    const sessionIdBase64 = sessionIdPlusPassword.slice(
        0,
        periodAfterSessionId
    );
    const passwordPlusExpireTime = sessionIdPlusPassword.slice(
        periodAfterSessionId + 1
    );

    if (sessionIdBase64.length <= 0 || passwordPlusExpireTime.length <= 0) {
        return null;
    }

    const periodAfterPassword = passwordPlusExpireTime.indexOf('.');
    if (periodAfterPassword < 0) {
        return null;
    }

    const passwordBase64 = passwordPlusExpireTime.slice(0, periodAfterPassword);
    const expireTimeBase64 = passwordPlusExpireTime.slice(
        periodAfterPassword + 1
    );

    if (passwordBase64.length <= 0 || expireTimeBase64.length <= 0) {
        return null;
    }

    try {
        const userId = fromBase64String(userIdBase64);
        const sessionId = fromBase64String(sessionIdBase64);
        const password = fromBase64String(passwordBase64);
        const expireTimeText = fromBase64String(expireTimeBase64);
        const expireTime =
            expireTimeText === 'Infinity' ? null : parseInt(expireTimeText);

        return [userId, sessionId, password, expireTime];
    } catch (err) {
        return null;
    }
}

/**
 * Formats the given OpenAI Key into a string that is detectable as an OpenAI Key.
 * @param apiKey The API Key that should be formatted.
 */
export function formatV1OpenAiKey(apiKey: string): string {
    return `vAI1.${toBase64String(apiKey)}`;
}

/**
 * Determines if the given string represents an OpenAI Key.
 * @param apiKey The API Key.
 */
export function isOpenAiKey(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.startsWith(`vAI1.`);
}

/**
 * Parses the given OpenAI Key.
 * @param key The key that should be parsed.
 */
export function parseOpenAiKey(key: string): [key: string] {
    if (!key || typeof key !== 'string') {
        return null;
    }

    if (!key.startsWith('vAI1.')) {
        return null;
    }

    const withoutVersion = key.slice('vAI1.'.length);
    return [fromBase64String(withoutVersion)];
}

/**
 * Generates a new connection token from the given key, connection ID, and device ID.
 *
 * Returns null if the key cannot be parsed.
 * @param key The connection key that should be used to generate the token.
 * @param connectionId The connection ID.
 * @param deviceId The device ID.
 * @param inst The ID of the instance that the connection is for.
 */
export function generateV1ConnectionToken(
    key: string,
    connectionId: string,
    recordName: string | null,
    inst: string
): string {
    const parsed = parseConnectionKey(key);

    if (!parsed) {
        return null;
    }

    recordName = recordName ?? '';

    const [userId, sessionId, connectionSecret, expireTimeMs] = parsed;
    const hashHex = v1ConnectionTokenHmac(
        connectionSecret,
        connectionId,
        recordName,
        inst
    );
    return formatV1ConnectionToken(
        userId,
        sessionId,
        connectionId,
        recordName,
        inst,
        hashHex
    );
}

/**
 * Calculates the SHA-256 HMAC of the given connection ID, record name, and inst using the given connection secret.
 * @param connectionSecret The connection secret.
 * @param connectionId The ID of the connection.
 * @param recordName The name of the record.
 * @param inst The inst.
 */
export function v1ConnectionTokenHmac(
    connectionSecret: string,
    connectionId: string,
    recordName: string,
    inst: string
): string {
    const hash = hmac(sha256 as any, toByteArray(connectionSecret), 'hex');
    hash.update(connectionId);
    hash.update(recordName);
    hash.update(inst);
    const hashHex = hash.digest('hex');
    return hashHex;
}

/**
 * Validates whether the given connection token is valid and was generated from the given connection key.
 * @param connectionToken The connection token to validate.
 * @param connectionSecret The secret for the connection.
 */
export function verifyConnectionToken(
    connectionToken: string,
    connectionSecret: string
): boolean {
    if (!connectionToken || !connectionSecret) {
        return false;
    }
    try {
        const parsed = parseV1ConnectionToken(connectionToken);
        if (parsed) {
            const [userId, sessionId, connectionId, recordName, inst, hash] =
                parsed;
            const expectedHash = v1ConnectionTokenHmac(
                connectionSecret,
                connectionId,
                recordName,
                inst
            );
            return hash === expectedHash;
        } else {
            return false;
        }
    } catch {
        return false;
    }
}

/**
 * Determines whether the given role is a super user role.
 * @param role The role to check.
 */
export function isSuperUserRole(role: UserRole | null | undefined): boolean {
    return role === 'superUser' || role === 'system';
}

/**
 * Determines wether the given role is suitable for a package reviewer.
 * @param role The role.
 */
export function isPackageReviewerRole(
    role: UserRole | null | undefined
): boolean {
    return role === 'superUser' || role === 'moderator' || role === 'system';
}

/**
 * Determines whether the given time has expired.
 * Can be used to determine wether a session keys, connection keys, etc. has expired.
 *
 * If the given time is null, then the key is considered to never expire.
 *
 * @param expirationMs The time that the key expires in miliseconds at since 1 January 1970 (Unix Epoch).
 * @param nowMs The current time in milliseconds since 1 January 1970 (Unix Epoch).
 */
export function isExpired(
    expirationMs: number | null,
    nowMs: number = Date.now()
): boolean {
    return nowMs >= (expirationMs ?? Infinity);
}

/**
 * Determines wether the given key will expire within the next REFRESH_LIFETIME_MS.
 *
 * Returns true if the key has expired or will expire within the next REFRESH_LIFETIME_MS.
 * Returns false if the key will not expire within the next REFRESH_LIFETIME_MS.
 * @param expirationMs The time that the key expires in miliseconds at since 1 January 1970 (Unix Epoch).
 * @param nowMs The current time in milliseconds since 1 January 1970 (Unix Epoch).
 */
export function willExpire(
    expirationMs: number | null,
    nowMs: number = Date.now()
) {
    return isExpired(expirationMs, nowMs + REFRESH_LIFETIME_MS);
}

/**
 * Determines if a key with the given expiration time can expire.
 * @param expirationMs The time that the key expires at in miliseconds since 1 January 1970 (Unix Epoch).
 */
export function canExpire(expirationMs: number | null) {
    return expirationMs !== null && isFinite(expirationMs) && expirationMs >= 0;
}

/**
 * Gets the amount of time in miliseconds until a token with the given expiration time should be refreshed.
 *
 * Returns 0 or a negative number if the key has expired or will expire within the next week (REFRESH_LIFETIME_MS).
 * Returns a positive number if the key will not expire within the next week (REFRESH_LIFETIME_MS).
 * Returns infinity if the key will never expire.
 *
 * @param expirationMs The time that the token expires in miliseconds since the Unix Epoch (1 January 1970).
 * @param nowMs The current time in miliseconds since the Unix Epoch (1 January 1970).
 */
export function timeUntilRefresh(
    expirationMs: number | null,
    nowMs: number = Date.now()
) {
    return timeUntilExpiration(expirationMs, nowMs + REFRESH_LIFETIME_MS);
}

/**
 * Gets the amount of time until a token with the given expiration time expires.
 *
 * Returns 0 or a negative number if the key has expired.
 * Returns infinity if the key will never expire.
 * Returns some other positive number if the key will expire in the future.
 *
 * @param expirationMs The time that the token expires in miliseconds since the Unix Epoch (1 January 1970).
 * @param nowMs The current time in miliseconds since the Unix Epoch (1 January 1970).
 */
export function timeUntilExpiration(
    expirationMs: number | null,
    nowMs: number = Date.now()
) {
    return (expirationMs ?? Infinity) - nowMs;
}

/**
 * Gets the expiration time of the given session key.
 * @param key The session key.
 * @returns Returns the expiration time in miliseconds since the Unix Epoch (1 January 1970). Returns -1 if the key is invalid.
 */
export function getSessionKeyExpiration(key: string): number {
    const parsed = parseSessionKey(key);

    if (!parsed) {
        return -1;
    }

    const expireTimeMs = parsed[3];
    return expireTimeMs ?? Infinity;
}
