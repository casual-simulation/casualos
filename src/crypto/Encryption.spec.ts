import { encryptV1, decryptV1 } from './Encryption';

describe('Encryption', () => {
    const passwordCases = [[null], [undefined], ['']];

    describe('encryptV1()', () => {
        it('should encrypt the data with the given password', async () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = await encryptV1('testPassword', dataBytes);
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

        it.each(differentCases)(
            '%s',
            async (desc, data, password1, password2) => {
                const encoder = new TextEncoder();
                const dataBytes = encoder.encode(data);
                const cyphertext1 = await encryptV1(password1, dataBytes);
                const cyphertext2 = await encryptV1(password2, dataBytes);
                const [version1, salt1, nonce1, data1] = cyphertext1.split('.');
                const [version2, salt2, nonce2, data2] = cyphertext2.split('.');

                expect(data1).not.toEqual(data2);
            }
        );

        it.each(passwordCases)('should reject %s passwords', async password => {
            const data = 'test';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            await expect(encryptV1(password, dataBytes)).rejects.toEqual(
                expect.any(Error)
            );
        });
    });

    describe('decryptV1()', () => {
        it('should be able to decrypt the data returned from encryptV1()', async () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const cyphertext = await encryptV1('testPassword', dataBytes);
            const plaintext = await decryptV1('testPassword', cyphertext);

            const decoder = new TextDecoder();
            const final = decoder.decode(plaintext);
            expect(final).toEqual(data);
        });

        it('should return null when trying to decrypt data that was corrupted', async () => {
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            let cyphertext = await encryptV1('testPassword', dataBytes);

            // Replace the last character of the data with a 0 (or a 1 if it was already a 0)
            let corrupted = cyphertext.slice(0, cyphertext.length - 1);
            corrupted += cyphertext[cyphertext.length - 1] === '0' ? '1' : '0';

            const decrypted = await decryptV1('testPassword', corrupted);
            expect(decrypted).toBe(null);
        });
    });
});
