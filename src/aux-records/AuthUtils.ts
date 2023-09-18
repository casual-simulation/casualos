import { padStart } from 'lodash';
import { randomBytes } from 'tweetnacl';
import {
    fromBase64String,
    toBase64String,
    parseV1ConnectionToken,
    formatV1ConnectionToken,
} from '@casual-simulation/aux-common';
import { sha256, hmac } from 'hash.js';
import { fromByteArray, toByteArray } from 'base64-js';

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
    recordName: string,
    inst: string
): string {
    const parsed = parseConnectionKey(key);

    if (!parsed) {
        return null;
    }

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
