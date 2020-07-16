import { randomBytes, secretbox } from 'tweetnacl';
import scrypt, { ScryptOptions } from 'scrypt-async';
import { fromByteArray, toByteArray } from 'base64-js';

function scryptAsync(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    options: ScryptOptions
): Promise<string | Uint8Array | Array<number>> {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, options, result => resolve(result));
    });
}

interface DerivedKey {
    salt: Uint8Array;
    hash: Uint8Array;
}

const ITERATIONS = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 16;

async function deriveKey(
    password: string,
    salt: Uint8Array
): Promise<DerivedKey> {
    const result = (await scryptAsync(password, salt, {
        N: ITERATIONS,
        r: BLOCK_SIZE,
        p: PARALLELISM,
        dkLen: KEY_LENGTH,
        encoding: 'binary',
    })) as Uint8Array;

    return {
        salt: salt,
        hash: result,
    };
}

/**
 * Encrypts the given data with the given password and returns the resulting cyphertext as a base64 string.
 *
 * Based on https://github.com/dchest/tweetnacl-js
 * Uses XSalsa20 and Poly1305 for authenticated encryption.
 *
 * Always uses a new initialization vector.
 * @param password The password to use to encrypt.
 * @param data The data to encrypt.
 */
export async function encrypt(password: string, data: string): Promise<string> {
    const nonce = randomBytes(secretbox.nonceLength);

    // Use the nonce as the salt of the derived key.
    // This should be fine since both salts and nonces are
    // supposed to be random unguessable values.
    const key = await deriveKey(password, nonce);

    const decoder = new TextEncoder();
    const dataBytes = decoder.encode(data);
    const cypherBytes = secretbox(dataBytes, nonce, key.hash);

    // const cypher
}

export async function decrypt(
    password: string,
    cyphertext: string
): Promise<string> {}
