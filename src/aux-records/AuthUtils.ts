import { padStart } from 'lodash';
import { randomBytes } from 'tweetnacl';
import { fromBase64String, toBase64String } from './Utils';
import { sha256, hmac } from 'hash.js';
import { fromByteArray } from 'base64-js';

/**
 * The number of characters that random codes should contain.
 */
export const RANDOM_CODE_LENGTH = 6;

/**
 * Creates a new random numerical code.
 */
export function randomCode(): string {
    const bytes = randomBytes(4);
    const int32 = new Uint32Array(bytes.buffer);
    const str = padStart(
        int32[0].toString().substring(0, RANDOM_CODE_LENGTH),
        RANDOM_CODE_LENGTH,
        '0'
    );
    return str;
}

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
    expireTimeMs: number
): string {
    return `vSK1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(sessionSecret)}.${toBase64String(
        expireTimeMs.toString()
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
        const expireTime = parseInt(fromBase64String(expireTimeBase64));

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
    expireTimeMs: number
): string {
    return `vCK1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(connectionSecret)}.${toBase64String(
        expireTimeMs.toString()
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
        const expireTime = parseInt(fromBase64String(expireTimeBase64));

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
 * Formats the given user ID, session ID, hash, connection ID, and device ID into a token.
 * @param userId The ID of the user.
 * @param sessionId The ID of the session.
 * @param hash The hash that was generated.
 * @param connectionId The ID of the connection.
 * @param deviceId The ID of the device.
 */
export function formatV1ConnectionToken(
    userId: string,
    sessionId: string,
    hash: string,
    connectionId: string,
    deviceId: string
): string {
    return `vCT1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(hash)}.${toBase64String(connectionId)}.${toBase64String(
        deviceId
    )}`;
}

/**
 * Parses the given connection token into a user ID, session ID, hash, connection ID, and device ID array.
 * Returns null if the key cannot be parsed.
 * @param token The token to parse.
 */
export function parseConnectionToken(
    token: string | null
): [
    userId: string,
    sessionId: string,
    hash: string,
    connectionId: string,
    deviceId: string
] {
    return parseV1ConnectionToken(token);
}

/**
 * Parses the given connection token into a user ID, session ID, hash, connection ID, and device ID array.
 * Returns null if the key cannot be parsed or if it is not a V1 token.
 * @param token The token to parse.
 */
export function parseV1ConnectionToken(
    token: string
): [
    userId: string,
    sessionId: string,
    hash: string,
    connectionId: string,
    deviceId: string
] {
    if (!token) {
        return null;
    }

    if (!token.startsWith('vCT1.')) {
        return null;
    }

    const withoutVersion = token.slice('vCT1.'.length);
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
    const hashPlusExtra = sessionIdPlusPassword.slice(periodAfterSessionId + 1);

    if (sessionIdBase64.length <= 0 || hashPlusExtra.length <= 0) {
        return null;
    }

    const periodAfterHash = hashPlusExtra.indexOf('.');
    if (periodAfterHash < 0) {
        return null;
    }

    const hashBase64 = hashPlusExtra.slice(0, periodAfterHash);
    const connectionIdPlusExtra = hashPlusExtra.slice(periodAfterHash + 1);

    if (hashBase64.length <= 0 || connectionIdPlusExtra.length <= 0) {
        return null;
    }

    const periodAfterConnectionId = connectionIdPlusExtra.indexOf('.');
    if (periodAfterConnectionId < 0) {
        return null;
    }

    const connectionIdBase64 = connectionIdPlusExtra.slice(
        0,
        periodAfterConnectionId
    );
    const deviceIdBase64 = connectionIdPlusExtra.slice(
        periodAfterConnectionId + 1
    );

    if (connectionIdBase64.length <= 0 || deviceIdBase64.length <= 0) {
        return null;
    }

    try {
        const userId = fromBase64String(userIdBase64);
        const sessionId = fromBase64String(sessionIdBase64);
        const hash = fromBase64String(hashBase64);
        const connectionId = fromBase64String(connectionIdBase64);
        const deviceId = fromBase64String(deviceIdBase64);

        return [userId, sessionId, hash, connectionId, deviceId];
    } catch (err) {
        return null;
    }
}

/**
 * Generates a new connection token from the given key, connection ID, and device ID.
 *
 * Returns null if the key cannot be parsed.
 * @param key The connection key that should be used to generate the token.
 * @param connectionId The connection ID.
 * @param deviceId The device ID.
 */
export function generateV1ConnectionToken(
    key: string,
    connectionId: string,
    deviceId: string
): string {
    const parsed = parseConnectionKey(key);

    if (!parsed) {
        return null;
    }

    const [userId, sessionId, connectionSecret, expireTimeMs] = parsed;

    const hash = hmac(sha256(), connectionSecret, 'hex');
    hash.update(connectionId);
    hash.update(deviceId);
    const hashHex = hash.digest('hex');

    return formatV1ConnectionToken(
        userId,
        sessionId,
        hashHex,
        connectionId,
        deviceId
    );
}
