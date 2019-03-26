import { SigningCryptoImpl, PrivateCryptoKey, PublicCryptoKey, SigningCryptoKey } from '../CryptoImpl';
import { SignatureAlgorithmType } from '../SignatureAlgorithm';

export class TestCryptoImpl implements SigningCryptoImpl {
    valid: boolean = false;
    signature: ArrayBuffer = new ArrayBuffer(0);
    algorithm: SignatureAlgorithmType;

    constructor(algorithm: SignatureAlgorithmType) {
        this.algorithm = algorithm;
    }

    async sign(key: PrivateCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
        return this.signature;
    }
    
    async verify(key: PublicCryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean> {
        return this.valid;
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
        return [<PublicCryptoKey>new TestCryptoKey('public'), <PrivateCryptoKey>new TestCryptoKey('private')];
    }
}

export class TestCryptoKey {
    type: string;

    constructor(type: string) {
        this.type = type;
    }
}