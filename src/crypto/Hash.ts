import { sha256 } from 'sha.js';
import stringify from 'fast-json-stable-stringify';

/**
 * Calculates the SHA-256 hash of the given object.
 * @param obj The object to calculate the hash of.
 */
export function getHash(obj: any): string {
    const json = stringify(obj);
    let sha = new sha256();
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
    let sha = new sha256();
    sha.update(json);
    return sha.digest();
}
