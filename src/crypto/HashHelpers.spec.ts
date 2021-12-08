import {
    createRandomPassword,
    hashPassword,
    verifyPassword,
} from './HashHelpers';

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

    describe('createRandomPassword()', () => {
        it('should return a password and hash', () => {
            const result = createRandomPassword();
            expect(verifyPassword(result.password, result.hash)).toBe(true);
        });
    });
});
