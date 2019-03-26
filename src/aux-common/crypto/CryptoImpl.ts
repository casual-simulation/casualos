import { SignatureAlgorithmType } from './SignatureAlgorithm';

/**
 * Defines an interface for objects that can sign and verify
 * messages.
 * 
 * Note that signing and verifying the integrity of messages has nothing to do with
 * confidentiality. That is, anyone can read the data even after signing.
 */
export interface SigningCryptoImpl {

    /**
     * Signs the given data using the given private key and returns a promise
     * that contains the signed data.
     * 
     * Returns a promise that resolves with a buffer that contains the signature needed to verify that the given
     * data was signed with the given key.
     * 
     * @param key The key to use to sign the data.
     * @param data The data to sign.
     */
    sign(key: PrivateCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>;

    /**
     * Verifies that the given signature was created by the private key
     * corresponding to the given public key and that it was used for the given data.
     * 
     * Returns a promise that resolves with true if the data is valid, and resolves false otherwise.
     * 
     * When the result is true, then we know that the party that posseses the private key created the signature
     * for the data. Additionally, we know that the data has not been tampered with. We do not, however, know that the
     * data was kept confidential.
     * 
     * When the result is false, then we know that either another party is attempting to impersonate the valid one or that 
     * the data got changed/corrupted/tampered with while in transit.
     * 
     * @param key The key to use to verify the data.
     * @param signature The signature to verify.
     * @param data The data to verify.
     */
    verify(key: PublicCryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean>;

    /**
     * Exports the private key in PKCS format encoded as PEM. 
     * @param key The key to export.
     */
    exportKey(key: PrivateCryptoKey): Promise<string>;

    /**
     * Exports the public key in SPKI format encoded as PEM.
     * @param key 
     */
    exportKey(key: PublicCryptoKey): Promise<string>;

    /**
     * Imports the given public key.
     * @param key The key to import.
     */
    importPublicKey(key: string): Promise<PublicCryptoKey>;

    /**
     * Imports the given private key.
     * @param key The key to import.
     */
    importPrivateKey(key: string): Promise<PrivateCryptoKey>;

    /**
     * Generates a new public/private key pair.
     */
    generateKeyPair(): Promise<[PublicCryptoKey, PrivateCryptoKey]>;
}

/**
 * Defines an interface for a private key.
 */
export interface PrivateCryptoKey {
    type: 'private';
}

/**
 * Defines an interface for a public key.
 */
export interface PublicCryptoKey {
    type: 'public';
}

/**
 * Defines a crypto key that is used for signing and verification.
 */
export type SigningCryptoKey = PrivateCryptoKey | PublicCryptoKey;