import { SignatureAlgorithmType } from "causal-trees";

/**
 * Defines an interface for objects that can sign and verify
 * messages.
 */
export interface SigningCryptoImpl {
    /**
     * Creates a new implementation that uses the given algorithm
     * to sign and verify messages.
     */
    new (algorithm: SignatureAlgorithmType): SigningCryptoImpl;

    /**
     * Signs the given data using the given private key and returns a promise
     * that contains the signed data.
     * @param key The key to use to sign the data.
     * @param data The data to sign.
     */
    sign(key: PrivateCryptoKey, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;

    /**
     * Verifies that the given data was signed by the private key
     * corresponding to the given public key.
     * Returns a promise that resolves with true if the data is valid, and resolves false otherwise.
     * @param key The key to use to verify the data.
     * @param data The data to verify.
     */
    verify(key: PublicCryptoKey, data: ArrayBuffer | ArrayBufferView): Promise<boolean>;

    /**
     * Exports the private key in PKCS format encoded as PEM. 
     * @param key The key to export.
     */
    exportKey(key: PrivateCryptoKey): string;

    /**
     * Exports the public key in SPKI format encoded as PEM.
     * @param key 
     */
    exportKey(key: PublicCryptoKey): string;

    /**
     * Imports the given public key.
     * @param key The key to import.
     */
    importPublicKey(key: string): PublicCryptoKey;

    /**
     * Imports the given private key.
     * @param key The key to import.
     */
    importPrivateKey(key: string): PrivateCryptoKey;
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