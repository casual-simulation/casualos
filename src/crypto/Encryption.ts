import { randomBytes, secretbox, box } from 'tweetnacl';
import { syncScrypt } from 'scrypt-js';
import { fromByteArray, toByteArray } from 'base64-js';

interface DerivedKey {
    salt: Uint8Array;
    hash: Uint8Array;
}

const ITERATIONS = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = secretbox.keyLength;

export function deriveKey(password: Uint8Array, salt: Uint8Array): DerivedKey {
    const result = syncScrypt(
        password,
        salt,
        ITERATIONS,
        BLOCK_SIZE,
        PARALLELISM,
        KEY_LENGTH
    );

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
export function encrypt(password: string, data: Uint8Array): string {
    return encryptV1(password, data);
}

/**
 * Decrypts the given cyphertext with the given password and returns the original plaintext.
 * Returns null if the data was unable to be decrypted.
 * @param password The password to use to decrypt.
 * @param cyphertext The data to decrypt.
 */
export function decrypt(password: string, cyphertext: string): Uint8Array {
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
export function encryptV1(password: string, data: Uint8Array): string {
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!data) {
        throw new Error('Invalid data. Must not be null or undefined.');
    }
    const nonce = randomBytes(secretbox.nonceLength);
    const salt = randomBytes(secretbox.nonceLength);

    const textEncoder = new TextEncoder();
    const passwordBytes = textEncoder.encode(password);
    const key = deriveKey(passwordBytes, salt);
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
 *
 * @param password The password to use to decrypt the data.
 * @param cyphertext The cyphertext produced from encryptV1().
 */
export function decryptV1(password: string, cyphertext: string): Uint8Array {
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

    const textEncoder = new TextEncoder();
    const passwordBytes = textEncoder.encode(password);
    const key = deriveKey(passwordBytes, salt);

    return secretbox.open(data, nonce, key.hash);
}

/**
 * Determines whether the given keypair is a valid asymmetric keypair.
 * Note that this function only determines if the keypair could have been generated by asymmetricKeypair(),
 * not that it was or that it can be used to decrypt something.
 * @param keypair The keypair to test.
 */
export function isAsymmetricKeypair(keypair: string): boolean {
    try {
        const [publicKey, privateKey] = decodeAsymmetricKeypairV1(keypair);
        return !!publicKey && !!privateKey;
    } catch (ex) {
        return false;
    }
}

/**
 * Creates a keypair that can be used for public key authenticated encryption.
 *
 * The returned keypair contains a version number at the beginning which determines the format of the following data.
 *
 * vEK1 keypairs use x25519 with XSalsa20 and Poly1305.
 * The output string is formatting as following with periods between the components:
 * 1. The version number (vEK1) - the EK is for "encryption keypair".
 * 2. The base64 of the public key.
 * 3. The base64 of the encrypted private key.
 *
 * @param password The password that should be used to encrypt the private key of the keypair.
 */
export function asymmetricKeypair(password: string): string {
    return asymmetricKeypairV1(password);
}

/**
 * Creates a version 1 keypair that can be used for public key authenticated encryption.
 *
 * The returned keypair contains a version number at the beginning which determines the format of the following data.
 *
 * vEK1 keypairs use x25519 with XSalsa20 and Poly1305.
 * The output string is formatting as following with periods between the components:
 * 1. The version number (vEK1) - the EK is for "encryption keypair".
 * 2. The base64 of the public key.
 * 3. The base64 of the encrypted private key.
 *
 * @param password The password that should be used to encrypt the private key of the keypair.
 */
export function asymmetricKeypairV1(password: string): string {
    const pair = box.keyPair();
    const encryptedPrivateKey = encrypt(password, pair.secretKey);
    const encoder = new TextEncoder();
    const privateKeyBytes = encoder.encode(encryptedPrivateKey);
    return `vEK1.${fromByteArray(pair.publicKey)}.${fromByteArray(
        privateKeyBytes
    )}`;
}

function decodeAsymmetricKeypairV1(keypair: string): [Uint8Array, string] {
    const withoutVersion = keypair.slice('vEK1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return [null, null];
    }
    const publicKeyBase64 = withoutVersion.slice(0, nextPeriod);
    const withoutPublicKey = withoutVersion.slice(nextPeriod + 1);
    const privateKeyBase64 = withoutPublicKey;
    const publicKey = toByteArray(publicKeyBase64);
    const privateKeyBytes = toByteArray(privateKeyBase64);
    const decoder = new TextDecoder();
    const privateKey = decoder.decode(privateKeyBytes);

    return [publicKey, privateKey];
}

/**
 * Encrypts the given data with the given keypair and returns the resulting cyphertext.
 *
 * The returned cyphertext contains a version number at the beginning which determines the format of the following data.
 *
 * vA1 encryptions use x25519 for key exchange, XSalsa20 as the cipher and Poly1305 for authentication.
 *
 * vA1 encryptions technically use two keypairs for encryption/decryption. One for the local party and one for the remote party.
 * These two parties are used to calculate a shared key that is then used to encrypt and authenticate the data.
 * When encrypting, a new keypair is generated and used for the "local" party while the given keypair is used for the remote party.
 * The secret key is then discarded while the public key is included in the output to make it possible for the other party to decrypt the data.
 *
 * The output string is formatted as following with periods between the components:
 * 1. The version number (vA1). The "A" means "asymmetric".
 * 2. The base64 of the public key of the keypair used to encrypt the data.
 * 3. The base64 of the nonce used by the cipher. (pseudorandom)
 * 4. The base64 of the encrypted data.
 *
 * @param keypair The keypair to use to encrypt.
 * @param data The data to encrypt.
 */
export function asymmetricEncrypt(keypair: string, data: Uint8Array): string {
    return asymmetricEncryptV1(keypair, data);
}

/**
 * Encrypts the given data with the given keypair and returns the resulting cyphertext.
 *
 * The returned cyphertext contains a version number at the beginning which determines the format of the following data.
 *
 * vA1 encryptions use x25519 for key exchange, XSalsa20 as the cipher and Poly1305 for authentication.
 *
 * vA1 encryptions technically use two keypairs for encryption/decryption. One for the local party and one for the remote party.
 * These two parties are used to calculate a shared key that is then used to encrypt and authenticate the data.
 * When encrypting, a new keypair is generated and used for the "local" party while the given keypair is used for the remote party.
 * The secret key is then discarded while the public key is included in the output to make it possible for the other party to decrypt the data.
 *
 * The output string is formatted as following with periods between the components:
 * 1. The version number (vA1). The "A" means "asymmetric".
 * 2. The base64 of the public key of the keypair used to encrypt the data.
 * 3. The base64 of the nonce used by the cipher. (pseudorandom)
 * 4. The base64 of the encrypted data.
 *
 * @param keypair The keypair to use to encrypt.
 * @param data The data to encrypt.
 */
export function asymmetricEncryptV1(keypair: string, data: Uint8Array): string {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!data) {
        throw new Error('Invalid data. Must not be null or undefined.');
    }
    if (!keypair.startsWith('vEK1.')) {
        throw new Error('Invalid keypair. Must start with "vEK1."');
    }
    const [theirPublicKey, theirPrivateKey] = decodeAsymmetricKeypairV1(
        keypair
    );
    if (!theirPublicKey || !theirPrivateKey) {
        throw new Error('Invalid keypair. Unable to be decoded.');
    }
    const localKeypair = box.keyPair();
    const myPublicKey = localKeypair.publicKey;
    const myPrivateKey = localKeypair.secretKey;
    const nonce = randomBytes(box.nonceLength);

    const cypherBytes = box(data, nonce, theirPublicKey, myPrivateKey);

    const cyphertext = `vA1.${fromByteArray(myPublicKey)}.${fromByteArray(
        nonce
    )}.${fromByteArray(cypherBytes)}`;

    return cyphertext;
}

/**
 * Decrypts the given data with the given keypair and returns the resulting plaintext.
 * Returns null if the data was unable to be decrypted.
 *
 * vA1 encryptions use x25519 for key exchange, XSalsa20 as the cipher and Poly1305 for authentication.
 *
 * @param keypair The keypair to use to decrypt the data.
 * @param password The password that should be used to decrypt the keypair's private key.
 * @param cyphertext The data to decrypt.
 */
export function asymmetricDecrypt(
    keypair: string,
    password: string,
    cyphertext: string
): Uint8Array {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (cyphertext.startsWith('vA1.')) {
        return asymmetricDecryptV1(keypair, password, cyphertext);
    }
    return null;
}

/**
 * Decrypts the given data with the given keypair using version 1 of the asymmetric encryption mechanisms in this file and returns the resulting
 * plaintext. Returns null if the data was unable to be decrypted.
 *
 * vA1 encryptions use x25519 for key exchange, XSalsa20 as the cipher and Poly1305 for authentication.
 *
 * @param keypair The keypair to use to decrypt the data.
 * @param password The password that should be used to decrypt the keypair's private key.
 * @param cyphertext The data to decrypt.
 */
export function asymmetricDecryptV1(
    keypair: string,
    password: string,
    cyphertext: string
): Uint8Array {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!keypair.startsWith('vEK1.')) {
        throw new Error('Invalid keypair. Must start with "vEK1."');
    }
    if (!cyphertext.startsWith('vA1.')) {
        throw new Error('Invalid cyphertext. Must start with "vA1."');
    }
    const [myPublicKey, myEncryptedPrivateKey] = decodeAsymmetricKeypairV1(
        keypair
    );
    if (!myPublicKey || !myEncryptedPrivateKey) {
        throw new Error('Invalid keypair. Unable to be decoded.');
    }
    const myPrivateKey = decrypt(password, myEncryptedPrivateKey);
    if (!myPrivateKey) {
        throw new Error('Invalid keypair. Unable to decrypt the private key.');
    }

    const withoutVersion = cyphertext.slice('vA1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }
    const theirPublicKeyBase64 = withoutVersion.slice(0, nextPeriod);
    const withoutPublicKey = withoutVersion.slice(nextPeriod + 1);
    nextPeriod = withoutPublicKey.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }
    const nonceBase64 = withoutPublicKey.slice(0, nextPeriod);
    const dataBase64 = withoutPublicKey.slice(nextPeriod + 1);
    if (dataBase64.length <= 0) {
        return null;
    }

    const theirPublicKey = toByteArray(theirPublicKeyBase64);
    const nonce = toByteArray(nonceBase64);
    const data = toByteArray(dataBase64);

    return box.open(data, nonce, theirPublicKey, myPrivateKey);
}

/**
 * Determines whether the given data appears to be encrypted using asymmetric encryption.
 * @param cyphertext The cyphertext to test.
 */
export function isAsymmetricEncrypted(cyphertext: string): boolean {
    try {
        return typeof cyphertext === 'string' && cyphertext.startsWith('vA1.');
    } catch {
        return false;
    }
}

/**
 * Determines whether the given data appears to be encrypted using symmetric encryption.
 * @param cyphertext The cyphertext to test.
 */
export function isEncrypted(cyphertext: string): boolean {
    try {
        return typeof cyphertext === 'string' && cyphertext.startsWith('v1.');
    } catch {
        return false;
    }
}
