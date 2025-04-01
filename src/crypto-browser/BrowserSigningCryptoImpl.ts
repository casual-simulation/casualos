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
import type {
    SigningCryptoImpl,
    PrivateCryptoKey,
    PublicCryptoKey,
    SigningCryptoKey,
    SignatureAlgorithmType,
} from '@casual-simulation/crypto';
import {
    formatPublicPEMKey,
    formatPrivatePEMKey,
    parsePublicPEMKey,
    parsePrivatePEMKey,
} from '@casual-simulation/crypto';
import Bowser from 'bowser';

// DEV NOTE:
// It kinda goes without saying, but change this code as little as possible.
// Security is not our strong point, but it also just makes sense to only really change this
// for things like bug/security fixes and not normal maintenence stuff.

// When we get browser tests working then we'll have more leniency.

/**
 * Defines a class that implements a signing crypto protocol for web browsers using the SubtleCrypto API.
 * Currently, the only algorithm supported is ECDSA using SHA256 for hashing.
 */
export class BrowserSigningCryptoImpl implements SigningCryptoImpl {
    /**
     * The EC Curve that is used.
     */
    public static readonly NAMED_CURVE = 'P-256';

    /**
     * Creates a new BrowserSigningCryptoImpl object.
     * @param algorithm The algorithm to use. Currently only ECDSA-SHA256-NISTP256 is supported.
     */
    constructor(algorithm: SignatureAlgorithmType) {
        if (algorithm !== 'ECDSA-SHA256-NISTP256') {
            throw new Error(
                '[BrowserSigningCryptoImpl] Algorithms other than ECDSA-SHA256-NISTP256 are not supported.'
            );
        }
    }

    supported() {
        const bowserResult = Bowser.parse(navigator.userAgent);
        console.log(
            '[BrowserSigningCryptoImpl] Detected browser:',
            bowserResult
        );

        // Browser crypto is not functioning correctly on Firefox browsers despite it being supported.
        if (bowserResult.browser.name === 'Firefox') {
            return false;
        }

        return typeof globalThis.crypto.subtle !== 'undefined';
    }

    async sign(key: PrivateCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
        if (key instanceof BrowserPrivateCryptoKey) {
            return await crypto.subtle.sign(
                {
                    name: 'ECDSA',
                    hash: {
                        name: 'SHA-256',
                    },
                },
                key.privateKey,
                data
            );
        }
        throw this._unknownKey();
    }

    async verify(
        key: PublicCryptoKey,
        signature: ArrayBuffer,
        data: ArrayBuffer
    ): Promise<boolean> {
        if (key instanceof BrowserPublicCryptoKey) {
            return await crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: {
                        name: 'SHA-256',
                    },
                },
                key.publicKey,
                signature,
                data
            );
        }
        throw this._unknownKey();
    }

    verifyBatch(
        key: PublicCryptoKey,
        signatures: ArrayBuffer[],
        datas: ArrayBuffer[]
    ): Promise<boolean[]> {
        if (key instanceof BrowserPublicCryptoKey) {
            let pub = key.publicKey;
            let promises = new Array<PromiseLike<boolean>>(datas.length);
            let options = {
                name: 'ECDSA',
                hash: {
                    name: 'SHA-256',
                },
            };

            for (let i = 0; i < promises.length; i++) {
                promises[i] = crypto.subtle.verify(
                    options,
                    pub,
                    signatures[i],
                    datas[i]
                );
            }

            return Promise.all(promises);
        }
        throw this._unknownKey();
    }

    async exportKey(key: SigningCryptoKey): Promise<string> {
        let buffer: ArrayBuffer;
        if (key instanceof BrowserPublicCryptoKey) {
            buffer = await crypto.subtle.exportKey('spki', key.publicKey);
            return formatPublicPEMKey(buffer);
        } else if (key instanceof BrowserPrivateCryptoKey) {
            buffer = await crypto.subtle.exportKey('pkcs8', key.privateKey);
            return formatPrivatePEMKey(buffer);
        }
        throw this._unknownKey();
    }

    async importPublicKey(key: string): Promise<PublicCryptoKey> {
        const buffer = parsePublicPEMKey(key);
        const cryptoKey = await crypto.subtle.importKey(
            'spki',
            buffer,
            {
                name: 'ECDSA',
                namedCurve: BrowserSigningCryptoImpl.NAMED_CURVE,
            },
            true,
            ['verify']
        );

        return new BrowserPublicCryptoKey(cryptoKey);
    }

    async importPrivateKey(key: string): Promise<PrivateCryptoKey> {
        const buffer = parsePrivatePEMKey(key);
        const cryptoKey = await crypto.subtle.importKey(
            'pkcs8',
            buffer,
            {
                name: 'ECDSA',
                namedCurve: BrowserSigningCryptoImpl.NAMED_CURVE,
            },
            true,
            ['sign']
        );

        return new BrowserPrivateCryptoKey(cryptoKey);
    }

    async generateKeyPair(): Promise<[PublicCryptoKey, PrivateCryptoKey]> {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: BrowserSigningCryptoImpl.NAMED_CURVE,
            },
            true,
            ['sign', 'verify']
        );

        return [
            new BrowserPublicCryptoKey(keyPair.publicKey),
            new BrowserPrivateCryptoKey(keyPair.privateKey),
        ];
    }

    private _unknownKey() {
        return new Error(
            '[BrowserSigningCryptoImpl] Key not a recognized implementation.'
        );
    }
}

/**
 * Defines an implementation of PublicCryptoKey for web browsers.
 */
export class BrowserPublicCryptoKey implements PublicCryptoKey {
    type: 'public';

    /**
     * The public key.
     */
    publicKey: CryptoKey;

    /**
     * Creates a new browser public crypto key.
     * @param publicKey The key to use.
     */
    constructor(publicKey: CryptoKey) {
        this.type = 'public';
        this.publicKey = publicKey;
    }
}

/**
 * Defines an implementation of PublicCryptoKey for web browsers.
 */
export class BrowserPrivateCryptoKey implements PrivateCryptoKey {
    type: 'private';

    /**
     * The private key.
     */
    privateKey: CryptoKey;

    /**
     * Creates a new browser private crypto key.
     * @param privateKey The key to use.
     */
    constructor(privateKey: CryptoKey) {
        this.type = 'private';
        this.privateKey = privateKey;
    }
}
