import { atom, atomId, AtomOp } from './Atom';
import { AtomValidator } from './AtomValidator';
import { TestCryptoImpl } from '../crypto/test/TestCryptoImpl';
import { toByteArray, fromByteArray } from 'base64-js';
import { PublicCryptoKey } from '../crypto';

describe('AtomValidator', () => {
    class Op implements AtomOp {
        type: number;
    }

    describe('sign()', () => {
        it('should encode the signature returned from the crypto implementation to base 64', async () => {
            const crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            const buffer = Buffer.from('abcdef', 'utf8');
            const spy = jest
                .spyOn(crypto, 'sign')
                .mockResolvedValue(buffer.buffer);
            const [pub, priv] = await crypto.generateKeyPair();
            const validator = new AtomValidator(crypto);

            const a = atom(atomId(1, 1), null, new Op());

            const other = await validator.sign(priv, a);

            expect(other.cause).toEqual(a.cause);
            expect(other.id).toEqual(a.id);
            expect(other.value).toEqual(a.value);
            expect(other.checksum).toBe(a.checksum);
            expect(other.signature).not.toBe(null);
            expect(typeof other.signature).toBe('string');
            spy.mockRestore();
        });
    });

    describe('verify()', () => {
        it('should return true if the crypto implementation returns true', async () => {
            const crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            const spy = jest
                .spyOn(crypto, 'verify')
                .mockImplementation(
                    (
                        key: PublicCryptoKey,
                        sig: ArrayBuffer,
                        data: ArrayBuffer
                    ) => {
                        const sigBuf = new Uint8Array(sig);
                        const sigBase64 = fromByteArray(sigBuf);
                        expect(sigBase64).toBe('YWJjZGVm');

                        const dataBuf = Buffer.from(data);
                        const dataJson = dataBuf.toString('utf8');
                        const dataObj = JSON.parse(dataJson);

                        expect(dataObj).toEqual([atomId(1, 1), null, new Op()]);
                        return Promise.resolve(true);
                    }
                );
            const [pub, priv] = await crypto.generateKeyPair();
            const validator = new AtomValidator(crypto);

            const a = atom(atomId(1, 1), null, new Op());
            a.signature = 'YWJjZGVm';
            const valid = await validator.verify(pub, a);

            expect(valid).toBe(true);
        });

        it('should return false if the crypto implementation returns false', async () => {
            const crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            const spy = jest.spyOn(crypto, 'verify').mockResolvedValue(false);
            const [pub, priv] = await crypto.generateKeyPair();
            const validator = new AtomValidator(crypto);

            const a = atom(atomId(1, 1), null, new Op());
            a.signature = 'YWJjZGVm';
            const valid = await validator.verify(pub, a);

            expect(valid).toBe(false);
        });
    });
});
