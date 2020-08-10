import { sign as signImpl } from 'tweetnacl';
import { encrypt, decrypt } from './Encryption';
import { fromByteArray, toByteArray } from 'base64-js';

/**
 * Creates a keypair that can be used for digitally signing data.
 *
 * The returned keypair contains a version number at the beginning which determines the format of the following data.
 *
 * v1 keypairs use ed25519.
 * The output string is formatting as following with periods between the components:
 * 1. The version number (vK1) - the K is for keypair
 * 2. The base64 of the public key.
 * 3. The base64 of the encrypted private key.
 *
 * @param password The password that should be used to encrypt the private key of the keypair.
 */
export function keypair(password: string): string {
    return keypairV1(password);
}

/**
 * Creates a version 1 keypair that can be used for digitally signing data.
 *
 * The returned keypair contains a version number at the beginning which determines the format of the following data.
 *
 * v1 keypairs use ed25519.
 * The output string is formatting as following with periods between the components:
 * 1. The version number (vK1) - The K is for keypair
 * 2. The base64 of the public key.
 * 3. The base64 of the encrypted private key.
 *
 * @param password The password that should be used to encrypt the private key of the keypair.
 */
export function keypairV1(password: string): string {
    const pair = signImpl.keyPair();
    const encryptedPrivateKey = encrypt(password, pair.secretKey);
    const encoder = new TextEncoder();
    const privateKeyBytes = encoder.encode(encryptedPrivateKey);
    return `vK1.${fromByteArray(pair.publicKey)}.${fromByteArray(
        privateKeyBytes
    )}`;
}

/**
 * Creates a version 1 signature from the given keypair and returns the result.
 *
 * v1 signatures use ed25519.
 * The output string is formatted as following with periods between the components:
 * 1. The version number (vS1) - THe S is for signature.
 * 2. The base64 of the signature.
 *
 * @param keypair The keypair to use.
 * @param password The password that is used to decrypt the private key.
 * @param data The data to sign.
 */
export function sign(
    keypair: string,
    password: string,
    data: Uint8Array
): string {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }

    if (keypair.startsWith('vK1.')) {
        return signV1(keypair, password, data);
    }
    return null;
}

/**
 * Creates a version 1 signature from the given keypair and returns the result.
 *
 * v1 signatures use ed25519.
 * The output string is formatted as following with periods between the components:
 * 1. The version number (vS1) - THe S is for signature.
 * 2. The base64 of the signature.
 *
 * @param keypair The keypair to use.
 * @param password The password that is used to decrypt the private key.
 * @param data The data to sign.
 */
export function signV1(
    keypair: string,
    password: string,
    data: Uint8Array
): string {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!password) {
        throw new Error('Invalid password. Must not be null or undefined.');
    }
    if (!keypair.startsWith('vK1.')) {
        throw new Error('Invalid keypair. Must start with "vK1."');
    }

    const [publicKey, privateKey] = decodeKeyV1(keypair);
    if (!publicKey || !privateKey) {
        throw new Error('Invalid keypair. Unable to be decoded.');
    }
    const decrypted = decrypt(password, privateKey);
    if (!decrypted) {
        throw new Error('Invalid keypair. Unable to decrypt the private key.');
    }

    const signature = signImpl.detached(data, decrypted);

    return `vS1.${fromByteArray(signature)}`;
}

/**
 * Validates that the given signature was created by the given keypair for the given data.
 * @param keypair The keypair.
 * @param signature The signature to validate.
 * @param data The data that was signed.
 */
export function verify(
    keypair: string,
    signature: string,
    data: Uint8Array
): boolean {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!signature) {
        throw new Error('Invalid signature. Must not be null or undefined.');
    }
    const isV1Keypair = keypair.startsWith('vK1.');
    const isV1Signature = signature.startsWith('vS1.');
    if (isV1Keypair && isV1Signature) {
        return verifyV1(keypair, signature, data);
    } else if (isV1Keypair || isV1Signature) {
        throw new Error(
            'Mismatched keypair and signature. They must have matching versions.'
        );
    }

    return false;
}

/**
 * Validates a signature that was created by signV1().
 * @param keypair The keypair that created the signature.
 * @param signature The signature.
 * @param data The data.
 */
export function verifyV1(
    keypair: string,
    signature: string,
    data: Uint8Array
): boolean {
    if (!keypair) {
        throw new Error('Invalid keypair. Must not be null or undefined.');
    }
    if (!signature) {
        throw new Error('Invalid signature. Must not be null or undefined.');
    }
    if (!keypair.startsWith('vK1')) {
        throw new Error('Invalid keypair. Must start with "vK1."');
    }
    if (!signature.startsWith('vS1')) {
        throw new Error('Invalid signature. Must start with "vS1."');
    }

    const [publicKey, privateKey] = decodeKeyV1(keypair);
    if (!publicKey || !privateKey) {
        throw new Error('Invalid keypair. Unable to be decoded.');
    }

    const signatureBytes = decodeSigV1(signature);

    return signImpl.detached.verify(data, signatureBytes, publicKey);
}

function decodeKeyV1(keypair: string): [Uint8Array, string] {
    const withoutVersion = keypair.slice('vK1.'.length);
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

function decodeSigV1(signature: string): Uint8Array {
    const signatureBase64 = signature.slice('vK1.'.length);
    return toByteArray(signatureBase64);
}
