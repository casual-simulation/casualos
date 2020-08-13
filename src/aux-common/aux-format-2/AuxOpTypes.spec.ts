import {
    bot,
    signedCert,
    validateCertSignature,
    cert,
    selfSignedCert,
    CertificateOp,
    ValueOp,
    value,
    signedValue,
    validateSignedValue,
    signedRevocation,
    validateRevocation,
} from './AuxOpTypes';
import { keypair, verify, keypairV1 } from '@casual-simulation/crypto';
import { atomId, atom, Atom } from '@casual-simulation/causal-trees';

describe('AuxOpTypes', () => {
    describe('bot()', () => {
        it('should return a bot operation with the given ID', () => {
            expect(bot('test')).toMatchInlineSnapshot(`
                Object {
                  "id": "test",
                  "type": 1,
                }
            `);
        });
    });

    describe('signedCert()', () => {
        let selfSigned: CertificateOp;
        let keys: string;
        beforeAll(() => {
            selfSigned = selfSignedCert('password');
            keys = keypair('password2');
        });

        it('should produce a self-signed signature if given a null signing cert', () => {
            const cert = signedCert(null, 'password', selfSigned.keypair);
            const a1 = atom(atomId('a', 0), null, cert);

            expect(validateCertSignature(null, a1)).toBe(true);
        });

        it('should produce a normal signature when given a certificate', () => {
            const a1 = atom(atomId('a', 0), null, selfSigned);
            const cert = signedCert(a1, 'password', keys);
            const a2 = atom(atomId('a', 1), a1, cert);

            expect(validateCertSignature(a1, a2)).toBe(true);
        });

        it('should throw if given an invalid cert', () => {
            let selfSignedCopy = {
                ...selfSigned,
            };
            selfSignedCopy.keypair = 'invalid';
            const a1 = atom(atomId('a', 0), null, selfSignedCopy);

            expect(() => {
                signedCert(a1, 'password', keys);
            }).toThrow();
        });

        describe('validateCertSignature()', () => {
            it('should return false if given an invalid signature', () => {
                const a1 = atom(atomId('a', 0), null, selfSigned);
                const cert = signedCert(a1, 'password', keys);

                // corrupt the signature
                cert.signature = 'invalid';
                const a2 = atom(atomId('a', 1), a1, cert);

                expect(validateCertSignature(a1, a2)).toBe(false);
            });
        });
    });

    describe('signedValue()', () => {
        let selfSigned: Atom<CertificateOp>;
        let a1: Atom<ValueOp>;
        beforeAll(() => {
            const cert = selfSignedCert('password');
            selfSigned = atom(atomId('b', 0), null, cert);
            a1 = atom(
                atomId('a', 0),
                null,
                value({
                    abc: 'def',
                })
            );
        });

        it('should produce a signature for the given value', () => {
            const signature = signedValue(selfSigned, 'password', a1);
            const a2 = atom(atomId('a', 1), a1, signature);

            expect(validateSignedValue(selfSigned, a2, a1)).toBe(true);
        });

        it('should throw if given an invalid cert', () => {
            let selfSignedCopy = {
                ...selfSigned,
                value: {
                    ...selfSigned.value,
                },
            };
            selfSignedCopy.value.keypair = 'invalid';

            expect(() => {
                signedValue(selfSignedCopy, 'password', a1);
            }).toThrow();
        });

        describe('validateSignedValue()', () => {
            it('should return false if given an invalid signature', () => {
                const signature = signedValue(selfSigned, 'password', a1);
                signature.signature = 'invalid';
                const a2 = atom(atomId('a', 1), a1, signature);

                expect(validateSignedValue(selfSigned, a2, a1)).toBe(false);
            });
        });
    });

    describe('signedRevocation()', () => {
        let selfSigned: Atom<CertificateOp>;
        beforeAll(() => {
            const cert = selfSignedCert('password');
            selfSigned = atom(atomId('b', 0), null, cert);
        });

        it('should produce a revocation for the given value', () => {
            const revocation = signedRevocation(
                selfSigned,
                'password',
                selfSigned
            );
            const a2 = atom(atomId('a', 1), selfSigned, revocation);

            expect(validateRevocation(selfSigned, a2, selfSigned)).toBe(true);
        });

        it('should throw if given an invalid cert', () => {
            let selfSignedCopy = {
                ...selfSigned,
                value: {
                    ...selfSigned.value,
                },
            };
            selfSignedCopy.value.keypair = 'invalid';

            expect(() => {
                signedRevocation(selfSignedCopy, 'password', selfSigned);
            }).toThrow();
        });

        describe('validateRevocation()', () => {
            it('should return false if given an invalid signature', () => {
                const signature = signedRevocation(
                    selfSigned,
                    'password',
                    selfSigned
                );
                signature.signature = 'invalid';
                const a2 = atom(atomId('a', 1), selfSigned, signature);

                expect(validateRevocation(selfSigned, a2, selfSigned)).toBe(
                    false
                );
            });
        });
    });
});
