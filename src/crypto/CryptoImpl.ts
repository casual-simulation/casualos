/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Defines an interface for objects that can sign and verify
 * messages.
 *
 * Note that signing and verifying the integrity of messages has nothing to do with
 * confidentiality. That is, anyone can read the data even after signing.
 */
export interface SigningCryptoImpl {
    /**
     * Gets whether this crypto implementation is supported on this platform.
     */
    supported(): boolean;

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
    verify(
        key: PublicCryptoKey,
        signature: ArrayBuffer,
        data: ArrayBuffer
    ): Promise<boolean>;

    /**
     * Verifies that the given signatures were created by the private key corresponding to the given public key
     * and that it was used for the given datas.
     * @param key The key to use to verify the data.
     * @param signatures The signatures to verify.
     * @param datas The data to verify.
     */
    verifyBatch(
        key: PublicCryptoKey,
        signatures: ArrayBuffer[],
        datas: ArrayBuffer[]
    ): Promise<boolean[]>;

    /**
     * Exports the private key in PKCS #8 format encoded as PEM.
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
