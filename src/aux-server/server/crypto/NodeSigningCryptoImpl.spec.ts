import { NodeSigningCryptoImpl, NodePublicCryptoKey, NodePrivateCryptoKey } from './NodeSigningCryptoImpl';

describe('NodeSigningCryptoImpl', () => {
    describe('constructor', () => {
        it('should throw if given an unsupported algorithm', () => {
            expect(() => {
                new NodeSigningCryptoImpl('RSA');
            }).toThrow();
        });
    });

    describe('generateKeyPair()', () => {
        it('should return a new key pair', async () => {
            const impl = new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256');
            const [publicKey, privateKey] = await impl.generateKeyPair();

            expect(publicKey).toBeTruthy();
            expect(privateKey).toBeTruthy();
            expect(publicKey).toBeInstanceOf(NodePublicCryptoKey);
            expect(privateKey).toBeInstanceOf(NodePrivateCryptoKey);
        });
    });

    describe('exportKey()', () => {
        it('should export the keys in the expected PEM format', async () => {
            const impl = new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256');
            const [publicKey, privateKey] = await impl.generateKeyPair();

            const exportedPrivate = (await impl.exportKey(privateKey)).trim();
            const exportedPublic = (await impl.exportKey(publicKey)).trim();

            expect(exportedPrivate).toMatch(/^-----BEGIN PRIVATE KEY-----/);
            expect(exportedPrivate).toMatch(/-----END PRIVATE KEY-----$/);
            expect(exportedPublic).toMatch(/^-----BEGIN PUBLIC KEY-----/);
            expect(exportedPublic).toMatch(/-----END PUBLIC KEY-----$/);
        });
    });

    describe('sign() and verify()', () => {
        it('should be able to sign the given data and verify it', async () => {
            const impl = new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256');
            const [publicKey, privateKey] = await impl.generateKeyPair();

            const data = 'hello';
            const buffer = Buffer.from(data, 'utf8');

            const signature = await impl.sign(privateKey, buffer);

            expect(signature.byteLength).toBeGreaterThan(0);

            const valid = await impl.verify(publicKey, signature, buffer);

            expect(valid).toBe(true);
        });

        it('should be invalid if the data changed', async () => {
            const impl = new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256');
            const [publicKey, privateKey] = await impl.generateKeyPair();

            const data = 'hello';
            const buffer = Buffer.from(data, 'utf8');

            const signature = await impl.sign(privateKey, buffer);

            expect(signature.byteLength).toBeGreaterThan(0);

            const otherData = 'helli';
            const otherBuffer = Buffer.from(otherData, 'utf8');
            const valid = await impl.verify(publicKey, signature, otherBuffer);

            expect(valid).toBe(false);
        });

        it('should be invalid if using a different public key', async () => {
            const impl = new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256');
            const [publicKey, privateKey] = await impl.generateKeyPair();
            const [wrongPublicKey] = await impl.generateKeyPair();

            const data = 'hello';
            const buffer = Buffer.from(data, 'utf8');

            const signature = await impl.sign(privateKey, buffer);

            expect(signature.byteLength).toBeGreaterThan(0);

            const valid = await impl.verify(wrongPublicKey, signature, buffer);

            expect(valid).toBe(false);
        });
    });
});