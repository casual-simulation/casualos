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
} from '../CryptoImpl';
import type { SignatureAlgorithmType } from '../SignatureAlgorithm';

export class TestCryptoImpl implements SigningCryptoImpl {
    valid: boolean = false;
    signature: ArrayBuffer = null;
    algorithm: SignatureAlgorithmType;

    constructor(algorithm: SignatureAlgorithmType) {
        this.algorithm = algorithm;
    }

    supported() {
        return true;
    }

    async sign(key: PrivateCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
        return this.signature || data.slice(0, 32);
    }

    async verify(
        key: PublicCryptoKey,
        signature: ArrayBuffer,
        data: ArrayBuffer
    ): Promise<boolean> {
        return this.valid;
    }

    async verifyBatch(
        key: PublicCryptoKey,
        signatures: ArrayBuffer[],
        datas: ArrayBuffer[]
    ): Promise<boolean[]> {
        return signatures.map((s) => this.valid);
    }

    exportKey(key: SigningCryptoKey): Promise<string> {
        return Promise.resolve(key.type);
    }

    importPublicKey(key: string): Promise<PublicCryptoKey> {
        return Promise.resolve(<PublicCryptoKey>new TestCryptoKey(key));
    }

    importPrivateKey(key: string): Promise<PrivateCryptoKey> {
        return Promise.resolve(<PrivateCryptoKey>new TestCryptoKey(key));
    }

    async generateKeyPair(): Promise<[PublicCryptoKey, PrivateCryptoKey]> {
        return [
            <PublicCryptoKey>new TestCryptoKey('public'),
            <PrivateCryptoKey>new TestCryptoKey('private'),
        ];
    }
}

export class TestCryptoKey {
    type: string;

    constructor(type: string) {
        this.type = type;
    }
}
