import { randomBytes, secretbox } from 'tweetnacl';
import scrypt, { Options } from 'scrypt-async';
import { fromByteArray, toByteArray } from 'base64-js';

function scryptAsync(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    options: Options
): Promise<string | Uint8Array | Array<number>> {
    return new Promise((resolve, reject) => {
        scrypt(<any>password, <any>salt, options, (result: any) =>
            resolve(result)
        );
    });
}

interface DerivedKey {
    salt: Uint8Array;
    hash: Uint8Array;
}

const ITERATIONS = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = secretbox.keyLength;

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
 * Encrypts the given data with the given password and returns the resulting cyphertext.
 *
 * The returned cyphertext contains a version number at the beginning which determines the format of the following data.
 *
 * v1 encryptions use XSalsa20 as the cipher and Poly1305 for authentication in addition to scrypt for password-based key derivation.
 * The output string is formatted as following with periods between the components:
 * 1. The version number (v1)
 * 2. The base64 of the salt used to derive the key from the password. (pseudorandom)
 * 3. The base64 of the nonce used by the cipher. (pseudorandom)
 * 4. The base64 of the encrypted data.
 *
 * @param password The password to use to encrypt.
 * @param data The data to encrypt.
 */
export function encrypt(password: string, data: Uint8Array): Promise<string> {
    return encryptV1(password, data);
}

/**
 * Decrypts the given cyphertext with the given password and returns the original plaintext.
 * Returns null if the data was unable to be decrypted.
 * @param password The password to use to decrypt.
 * @param cyphertext The data to decrypt.
 */
export function decrypt(
    password: string,
    cyphertext: string
): Promise<Uint8Array> {
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!cyphertext) {
        throw new Error('Invalid cyphertext. Must not be null or undefined.');
    }
    if (cyphertext.startsWith('v1.')) {
        return decryptV1(password, cyphertext);
    }
    return null;
}

/**
 * Encrypts the given data with the given password using version 1 of the encryption mechanisms in this file and returns the resulting
 * cyphertext.
 *
 * version 1 encryptions use XSalsa20 as the cipher and Poly1305 for authentication in addition to scrypt for password-based key derivation.
 * The output string is formatted as following with periods between the components:
 * 1. The version number (v1)
 * 2. The base64 of the salt used to derive the key from the password. (pseudorandom)
 * 3. The base64 of the nonce used by the cipher. (pseudorandom)
 * 4. The base64 of the encrypted data.
 *
 * @param password The password to use to encrypt the data.
 * @param data The data to encrypt.
 */
export async function encryptV1(
    password: string,
    data: Uint8Array
): Promise<string> {
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!data) {
        throw new Error('Invalid data. Must not be null or undefined.');
    }
    const nonce = randomBytes(secretbox.nonceLength);
    const salt = randomBytes(secretbox.nonceLength);

    const key = await deriveKey(password, salt);
    const cypherBytes = secretbox(data, nonce, key.hash);
    const cyphertext = `v1.${fromByteArray(salt)}.${fromByteArray(
        nonce
    )}.${fromByteArray(cypherBytes)}`;

    return cyphertext;
}

/**
 * Decrypts the given data with the given password using version 1 of the encryption mechanisms in this file and returns the resulting
 * plaintext.
 *
 * version 1 encryptions use XSalsa20 as the cipher and Poly1305 for authentication in addition to scrypt for password-based key derivation.
 * The output string is formatted as following with periods between the components:
 * 1. The version number (v1)
 * 2. The base64 of the salt used to derive the key from the password. (pseudorandom)
 * 3. The base64 of the nonce used by the cipher. (pseudorandom)
 * 4. The base64 of the encrypted data.
 *
 * @param password The password to use to decrypt the data.
 * @param cyphertext The cyphertext produced from encryptV1().
 */
export async function decryptV1(
    password: string,
    cyphertext: string
): Promise<Uint8Array> {
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!cyphertext) {
        throw new Error('Invalid cyphertext. Must not be null or undefined.');
    }
    if (!cyphertext.startsWith('v1.')) {
        throw new Error('Invalid cyphertext. Must start with "v1."');
    }

    const withoutVersion = cyphertext.slice('v1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }
    const saltBase64 = withoutVersion.slice(0, nextPeriod);
    const withoutSalt = withoutVersion.slice(nextPeriod + 1);
    nextPeriod = withoutSalt.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }
    const nonceBase64 = withoutSalt.slice(0, nextPeriod);
    const dataBase64 = withoutSalt.slice(nextPeriod + 1);
    if (dataBase64.length <= 0) {
        return null;
    }

    const salt = toByteArray(saltBase64);
    const nonce = toByteArray(nonceBase64);
    const data = toByteArray(dataBase64);

    const key = await deriveKey(password, salt);

    return secretbox.open(data, nonce, key.hash);
}
