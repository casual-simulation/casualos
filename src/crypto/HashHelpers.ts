import { sha256 } from 'hash.js';
import stringify from 'fast-json-stable-stringify';
import scrypt from 'scrypt-async';
import { randomBytes } from 'tweetnacl';
import { deriveKey } from './Encryption';
import { fromByteArray, toByteArray } from 'base64-js';

/**
 * Calculates the SHA-256 hash of the given object.
 * @param obj The object to calculate the hash of.
 */
export function getHash(obj: any): string {
    const json = stringify(obj);
    let sha = sha256();
    sha.update(json);
    return sha.digest('hex');
}

/**
 * Calculates the SHA-256 hash of the given object and
 * returns a byte buffer containing the hash.
 * @param obj The object to hash.
 */
export function getHashBuffer(obj: any): Buffer {
    const json = stringify(obj);
    let sha = sha256();
    sha.update(json);
    return Buffer.from(sha.digest());
}

/**
 * Creates a random password and returns it along with its hash.
 */
export function createRandomPassword() {
    const passwordBytes = randomBytes(16); // 128-bit password

    const passwordBase64 = fromByteArray(passwordBytes); // convert to human-readable string

    const hash = hashPassword(passwordBase64);

    return {
        password: passwordBase64,
        hash,
    };
}

/**
 * Hashes the given password using scrypt and returns the result.
 * @param password The password that should be hashed.
 */
export function hashPassword(password: string): string {
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    const salt = randomBytes(16);
    const textEncoder = new TextEncoder();
    const passwordBytes = textEncoder.encode(password);

    const hashBytes = deriveKey(passwordBytes, salt);

    return `vP1.${fromByteArray(hashBytes.salt)}.${fromByteArray(
        hashBytes.hash
    )}`;
}

/**
 * Verifies that the given password matches the given hash.
 * @param password The password to check.
 * @param hash The hash to check the password against.
 */
export function verifyPassword(password: string, hash: string): boolean {
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!hash) {
        throw new Error('Invalid hash. Must not be null or undefined.');
    }
    if (!hash.startsWith('vP1.')) {
        throw new Error('Invalid hash. Must start with "vP1."');
    }
    const withoutVersion = hash.slice('vP1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return false;
    }
    const saltBase64 = withoutVersion.slice(0, nextPeriod);
    const hashBase64 = withoutVersion.slice(nextPeriod + 1);
    if (hashBase64.length <= 0) {
        return false;
    }

    const textEncoder = new TextEncoder();
    const passwordBytes = textEncoder.encode(password);
    const salt = toByteArray(saltBase64);
    const hashBytes = deriveKey(passwordBytes, salt);
    return fromByteArray(hashBytes.hash) === hashBase64;
}
