import { SigningCryptoImpl, PrivateCryptoKey, PublicCryptoKey, SigningCryptoKey } from '../CryptoImpl';
import { SignatureAlgorithmType } from '../SignatureAlgorithm';

export class TestCryptoImpl implements SigningCryptoImpl {
    valid: boolean = false;
    signature: ArrayBuffer = new ArrayBuffer(0);
    algorithm: SignatureAlgorithmType;

    constructor(algorithm: SignatureAlgorithmType) {
        this.algorithm = algorithm;
    }

    async sign(key: PrivateCryptoKey, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
        return this.signature;
    }
    
    async verify(key: PublicCryptoKey, data: ArrayBuffer | ArrayBufferView): Promise<boolean> {
        return this.valid;
    }

    exportKey(key: SigningCryptoKey): string {
        return key.type;
    }
    
    importPublicKey(key: string): PublicCryptoKey {
        return <PublicCryptoKey>new TestCryptoKey(key);
    }

    importPrivateKey(key: string): PrivateCryptoKey {
        return <PrivateCryptoKey>new TestCryptoKey(key);
    }

    generateKeyPair(): [PublicCryptoKey, PrivateCryptoKey] {
        return [<PublicCryptoKey>new TestCryptoKey('public'), <PrivateCryptoKey>new TestCryptoKey('private')];
    }
}

export class TestCryptoKey {
    type: string;

    constructor(type: string) {
        this.type = type;
    }
}