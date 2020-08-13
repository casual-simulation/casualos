import { hashPassword, verifyPassword } from '.';

describe('HashHelpers', () => {
    describe('hashPassword()', () => {
        it('should return a password hash', () => {
            const hash = hashPassword('password');
            expect(verifyPassword('password', hash)).toBe(true);
        });

        it('should throw if given a null password', () => {
            expect(() => {
                hashPassword(null);
            }).toThrow(
                new Error('Invalid password. Must not be null or undefined.')
            );
        });
    });
});
