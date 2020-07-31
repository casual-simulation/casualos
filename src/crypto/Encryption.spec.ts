import { encryptV1, decryptV1, encrypt, decrypt } from './Encryption';

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

        it.each(passwordCases)('should reject %s passwords', password => {
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
});
