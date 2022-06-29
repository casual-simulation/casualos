import { padStart } from 'lodash';
import { randomBytes } from 'tweetnacl';
import { fromBase64String, toBase64String } from './Utils';

export const RANDOM_CODE_LENGTH = 5;

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
 * Parses the given session token into a user ID and session ID, and session secret array.
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
