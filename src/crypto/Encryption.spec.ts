import {
    encryptV1,
    decryptV1,
    encrypt,
    decrypt,
    asymmetricKeypair,
    asymmetricEncrypt,
    asymmetricDecrypt,
    isAsymmetricKeypair,
    isAsymmetricEncrypted,
    isEncrypted,
} from './Encryption';

describe('Encryption', () => {
    const passwordCases = [[null], [undefined], ['']];

    describe('encrypt()', () => {
        it('should return a v1 encryption', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encrypt('testPassword', dataBytes);
            const [version, salt, nonce, result] = cyphertext.split('.');

            expect(version).toBe('v1');
            expect(salt.length).toBe(32);
            expect(nonce.length).toBe(32);
        });
    });

    describe('decrypt()', () => {
        it('should be able to decrypt data from encrypt()', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encrypt('testPassword', dataBytes);
            const resultBytes = decrypt('testPassword', cyphertext);

            const decoder = new TextDecoder();
            const final = decoder.decode(resultBytes);
            expect(final).toEqual(data);
        });

        it('should be able to decrypt data from encryptV1()', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encryptV1('testPassword', dataBytes);
            const resultBytes = decrypt('testPassword', cyphertext);

            const decoder = new TextDecoder();
            const final = decoder.decode(resultBytes);
            expect(final).toEqual(data);
        });

        it('should return null if given a string that does not start with v1', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encryptV1('testPassword', dataBytes);
            const resultBytes = decrypt('testPassword', 'abc');

            expect(resultBytes).toBe(null);
        });
    });

    describe('encryptV1()', () => {
        it('should encrypt the data with the given password', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encryptV1('testPassword', dataBytes);
            expect(cyphertext).not.toContain(data);
        });

        const differentCases = [
            [
                'should encrypt the same data with the same passwords differently',
                'hello, world!',
                'testPassword',
                'testPassword',
            ],
            [
                'should encrypt the same data with different passwords differently',
                'hello, world!',
                'testPassword',
                'testPassword1',
            ],
            [
                'should encrypt an empty string with the same password differently',
                '',
                'testPassword',
                'testPassword',
            ],
            [
                'should encrypt an empty string with different passwords differently',
                '',
                'testPassword',
                'testPassword1',
            ],
        ];

        it.each(differentCases)('%s', (desc, data, password1, password2) => {
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext1 = encryptV1(password1, dataBytes);
            const cyphertext2 = encryptV1(password2, dataBytes);
            const [version1, salt1, nonce1, data1] = cyphertext1.split('.');
            const [version2, salt2, nonce2, data2] = cyphertext2.split('.');

            expect(data1).not.toEqual(data2);
        });

        it.each(passwordCases)('should reject %s passwords', (password) => {
            const data = 'test';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            expect(() => {
                encryptV1(password, dataBytes);
            }).toThrow(expect.any(Error));
        });
    });

    describe('decryptV1()', () => {
        it('should be able to decrypt the data returned from encryptV1()', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encryptV1('testPassword', dataBytes);
            const plaintext = decryptV1('testPassword', cyphertext);

            const decoder = new TextDecoder();
            const final = decoder.decode(plaintext);
            expect(final).toEqual(data);
        });

        it('should return null when trying to decrypt data that was corrupted', () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            let cyphertext = encryptV1('testPassword', dataBytes);

            // Replace the last character of the data with a 0 (or a 1 if it was already a 0)
            let corrupted = cyphertext.slice(0, cyphertext.length - 1);
            corrupted += cyphertext[cyphertext.length - 1] === '0' ? '1' : '0';

            const decrypted = decryptV1('testPassword', corrupted);
            expect(decrypted).toBe(null);
        });

        it('should return null if given cyphertext without a nonce', () => {
            const decrypted = decryptV1('testPassword', 'v1.abc.');
            expect(decrypted).toBe(null);
        });

        it('should return null if given cyphertext without a salt', () => {
            const decrypted = decryptV1('testPassword', 'v1.');
            expect(decrypted).toBe(null);
        });
        it('should return null if given cyphertext without data', () => {
            const decrypted = decryptV1('testPassword', 'v1.salt.nonce.');
            expect(decrypted).toBe(null);
        });
    });

    describe('isEncrypted()', () => {
        it('should return true for data encrypted with encrypt()', () => {
            const key = 'password';
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = encrypt(key, dataBytes);
            expect(isEncrypted(cyphertext)).toBe(true);
        });

        const cyphertextCases = [
            [true, `v1.YWJj.ZGVm`],
            [true, `v1.YWJj.ZG`],
            [true, `v1.YWJj.`],
            [true, `v1.YWJj`],
            [true, `v1.`],
            [false, `v1`],
            [false, ``],
            [false, `vA1.abc.def`],
            [false, `vK1.abc.def`],
            [false, null as any],
            [false, 0],
            [false, 1],
            [false, true],
            [false, false],
        ] as const;

        it.each(cyphertextCases)(
            'should return %s for %s',
            (expected: boolean, cyphertext: any) => {
                expect(isEncrypted(cyphertext)).toBe(expected);
            }
        );
    });

    describe('asymmetricKeypair()', () => {
        it('should return a v1 keypair encrypted with the given password', () => {
            const key = asymmetricKeypair('password');
            const sections = key.split('.');
            const version = sections[0];

            expect(typeof key).toBe('string');
            expect(sections.length).toBe(3);
            expect(version).toBe('vEK1');
        });

        it.each(passwordCases)('should reject %s passwords', (password) => {
            expect(() => {
                asymmetricKeypair(password);
            }).toThrow(expect.any(Error));
        });
    });

    describe('isAsymmetricKeypair()', () => {
        it('should return true for keypairs generated with asymmetricKeypair()', () => {
            const key = asymmetricKeypair('password');
            expect(isAsymmetricKeypair(key)).toBe(true);
        });

        const keypairCases = [
            [true, `vEK1.YWJj.ZGVm`],
            [false, `vEK1.YWJj.ZG`],
            [false, `vEK1.YWJj.`],
            [false, `vEK1.YWJj`],
            [false, `vEK1.`],
            [false, `vEK1`],
            [false, ``],
            [false, `v1.abc.def`],
            [false, `vK1.abc.def`],
            [false, null as any],
            [false, 0],
            [false, 1],
            [false, true],
            [false, false],
        ] as const;

        it.each(keypairCases)(
            'should return %s for %s',
            (expected: boolean, keypair: any) => {
                expect(isAsymmetricKeypair(keypair)).toBe(expected);
            }
        );
    });

    describe('isAsymmetricEncrypted()', () => {
        it('should return true for data encrypted with asymmetricEncrypt()', () => {
            const key = asymmetricKeypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = asymmetricEncrypt(key, dataBytes);
            expect(isAsymmetricEncrypted(cyphertext)).toBe(true);
        });

        const cyphertextCases = [
            [true, `vA1.YWJj.ZGVm`],
            [true, `vA1.YWJj.ZG`],
            [true, `vA1.YWJj.`],
            [true, `vA1.YWJj`],
            [true, `vA1.`],
            [false, `vA1`],
            [false, ``],
            [false, `v1.abc.def`],
            [false, `vK1.abc.def`],
            [false, null as any],
            [false, 0],
            [false, 1],
            [false, true],
            [false, false],
        ] as const;

        it.each(cyphertextCases)(
            'should return %s for %s',
            (expected: boolean, cyphertext: any) => {
                expect(isAsymmetricEncrypted(cyphertext)).toBe(expected);
            }
        );
    });

    describe('asymmetricEncrypt()', () => {
        it('should encrypt the data with the given keypair', () => {
            const key = asymmetricKeypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = asymmetricEncrypt(key, dataBytes);
            expect(cyphertext).not.toContain(data);
        });

        it('should encrypt the same data with the same key differently', () => {
            const key = asymmetricKeypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext1 = asymmetricEncrypt(key, dataBytes);
            const cyphertext2 = asymmetricEncrypt(key, dataBytes);

            const [version1, publicKey1, nonce1, data1] = cyphertext1.split(
                '.'
            );
            const [version2, publicKey2, nonce2, data2] = cyphertext2.split(
                '.'
            );

            expect(version1).toEqual(version2);
            expect(publicKey1).not.toEqual(publicKey2);
            expect(nonce1).not.toEqual(nonce2);
            expect(data1).not.toEqual(data2);
        });
    });

    describe('asymmetricDecrypt()', () => {
        it('should be able to decrypt the data with the given keypair', () => {
            const key = asymmetricKeypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = asymmetricEncrypt(key, dataBytes);

            const decrypted = asymmetricDecrypt(key, 'password', cyphertext);
            const decoder = new TextDecoder();
            const final = decoder.decode(decrypted);

            expect(final).toEqual(data);
        });

        it('should return null when trying to decrypt data that was corrupted', () => {
            const key = asymmetricKeypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = asymmetricEncrypt(key, dataBytes);

            // Replace the last character of the data with a 0 (or a 1 if it was already a 0)
            let corrupted = cyphertext.slice(0, cyphertext.length - 1);
            corrupted += cyphertext[cyphertext.length - 1] === '0' ? '1' : '0';

            const decrypted = asymmetricDecrypt(key, 'password', corrupted);
            expect(decrypted).toBe(null);
        });

        const invalidCases = [
            [
                'should return null if given cyphertext without a public key',
                asymmetricKeypair('password'),
                'password',
                'vA1.',
            ],
            [
                'should return null if given cyphertext without a nonce',
                asymmetricKeypair('password'),
                'password',
                'vA1.abc.',
            ],
            [
                'should return null if given cyphertext without data',
                asymmetricKeypair('password'),
                'password',
                'vA1.abc.nonce.',
            ],
        ];

        it.each(invalidCases)('%s', (key, password, cyphertext) => {
            const decrypted = asymmetricDecrypt(key, password, cyphertext);
            expect(decrypted).toBe(null);
        });
    });
});
