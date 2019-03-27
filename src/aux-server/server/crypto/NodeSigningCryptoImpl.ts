import { SigningCryptoImpl, PrivateCryptoKey, PublicCryptoKey, SigningCryptoKey, SignatureAlgorithmType } from "@yeti-cgi/aux-common/crypto";
import { createSign, createVerify, generateKeyPairSync } from 'crypto';

export class NodeSigningCryptoImpl implements SigningCryptoImpl {

    constructor(algorithm: SignatureAlgorithmType) {
        if (algorithm !== 'ECDSA-SHA256-NISTP256') {
            throw new Error(`[NodeSigningCryptoImpl] Unsupported singing algorithm type: ${algorithm}`);
        }
    }

    async sign(key: PrivateCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
        if (key instanceof NodePrivateCryptoKey) {
            const sign = createSign('SHA256');
            const buffer = Buffer.from(data);
            sign.write(buffer);
            sign.end();
            
            const signature = sign.sign(key.privateKey);
            return signature;
        }
        throw this._unknownKey();
    }

    async verify(key: PublicCryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean> {
        if (key instanceof NodePublicCryptoKey) {
            const verify = createVerify('SHA256');
            const buffer = Buffer.from(data);
            verify.update(buffer);
            verify.end();

            const sig = Buffer.from(signature);
            return verify.verify(key.publicKey, sig);
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
                format: <any>'pem'
            },
            privateKeyEncoding: <any>{
                type: 'pkcs8',
                format: 'pem'
            }
        });

        return [
            new NodePublicCryptoKey(publicKey),
            new NodePrivateCryptoKey(privateKey)
        ];
    }

    private _unknownKey() {
        return new Error('[NodeSigningCryptoImpl] Key not a recognized implementation.');
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