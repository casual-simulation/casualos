import {
    SigningCryptoImpl,
    PrivateCryptoKey,
    PublicCryptoKey,
    SigningCryptoKey,
    SignatureAlgorithmType,
} from '@casual-simulation/causal-trees/crypto';
import {
    nodeSignatureToWebSignature,
    webSignatureToNodeSignature,
} from './SubtleCryptoCompat';
import { createSign, createVerify, generateKeyPairSync, Verify } from 'crypto';

export class NodeSigningCryptoImpl implements SigningCryptoImpl {
    constructor(algorithm: SignatureAlgorithmType) {
        if (algorithm !== 'ECDSA-SHA256-NISTP256') {
            throw new Error(
                `[NodeSigningCryptoImpl] Unsupported singing algorithm type: ${algorithm}`
            );
        }
    }

    supported() {
        return true;
    }

    async sign(key: PrivateCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
        if (key instanceof NodePrivateCryptoKey) {
            const sign = createSign('SHA256');
            const buffer = Buffer.from(data);
            sign.write(buffer);
            sign.end();

            const signature = sign.sign(key.privateKey);
            return nodeSignatureToWebSignature(signature);
        }
        throw this._unknownKey();
    }

    async verify(
        key: PublicCryptoKey,
        signature: ArrayBuffer,
        data: ArrayBuffer
    ): Promise<boolean> {
        if (key instanceof NodePublicCryptoKey) {
            const verify = createVerify('SHA256');
            const buffer = Buffer.from(data);
            verify.update(buffer);
            verify.end();

            const sig = webSignatureToNodeSignature(Buffer.from(signature));
            return verify.verify(key.publicKey, sig);
        }
        throw this._unknownKey();
    }

    async verifyBatch(
        key: PublicCryptoKey,
        signatures: ArrayBuffer[],
        datas: ArrayBuffer[]
    ): Promise<boolean[]> {
        if (key instanceof NodePublicCryptoKey) {
            let nodeSignatures: Buffer[] = new Array<Buffer>(signatures.length);
            for (let i = 0; i < nodeSignatures.length; i++) {
                nodeSignatures[i] = webSignatureToNodeSignature(
                    Buffer.from(signatures[i])
                );
            }

            let verifies = new Array<Verify>(nodeSignatures.length);
            for (let i = 0; i < verifies.length; i++) {
                const verify = createVerify('SHA256');
                const buffer = Buffer.from(datas[i]);
                verify.update(buffer);
                verify.end();
                verifies[i] = verify;
            }

            let results = new Array<boolean>(datas.length);
            let pub = key.publicKey;
            for (let i = 0; i < results.length; i++) {
                results[i] = verifies[i].verify(pub, nodeSignatures[i]);
            }
            return results;
        }
        throw this._unknownKey();
    }

    async exportKey(key: SigningCryptoKey): Promise<string> {
        if (key instanceof NodePublicCryptoKey) {
            return key.publicKey;
        } else if (key instanceof NodePrivateCryptoKey) {
            return key.privateKey;
        }
        throw this._unknownKey();
    }

    async importPublicKey(key: string): Promise<PublicCryptoKey> {
        return new NodePublicCryptoKey(key);
    }

    async importPrivateKey(key: string): Promise<PrivateCryptoKey> {
        return new NodePrivateCryptoKey(key);
    }

    async generateKeyPair(): Promise<[PublicCryptoKey, PrivateCryptoKey]> {
        const { publicKey, privateKey } = generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            publicKeyEncoding: {
                type: 'spki',
                format: <any>'pem',
            },
            privateKeyEncoding: <any>{
                type: 'pkcs8',
                format: 'pem',
            },
        });

        return [
            new NodePublicCryptoKey(publicKey),
            new NodePrivateCryptoKey(privateKey),
        ];
    }

    private _unknownKey() {
        return new Error(
            '[NodeSigningCryptoImpl] Key not a recognized implementation.'
        );
    }
}

export class NodePublicCryptoKey implements PublicCryptoKey {
    type: 'public';
    publicKey: string;

    constructor(publicKey: string) {
        this.publicKey = publicKey;
    }
}

export class NodePrivateCryptoKey implements PrivateCryptoKey {
    type: 'private';
    privateKey: string;

    constructor(privateKey: string) {
        this.privateKey = privateKey;
    }
}
