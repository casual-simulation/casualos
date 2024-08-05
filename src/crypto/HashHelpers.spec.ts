import { fromByteArray } from 'base64-js';
import { randomBytes } from 'tweetnacl';
import {
    createRandomPassword,
    hashPassword,
    verifyPassword,
    hashLowEntropyPasswordWithSalt,
    verifyPasswordAgainstHashes,
    hashHighEntropyPasswordWithSalt,
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

    describe('hashLowEntropyPasswordWithSalt()', () => {
        it('should return a password hash', () => {
            const salt = fromByteArray(randomBytes(16));
            const hash = hashLowEntropyPasswordWithSalt('password', salt);
            expect(hash.startsWith('vH1.')).toBe(true);
            expect(verifyPasswordAgainstHashes('password', salt, [hash])).toBe(
                true
            );
        });

        it('should return a consistent hash', () => {
            const salt = 'GsVJeVGNV4+j1sjyfF13sg==';
            const hash = hashLowEntropyPasswordWithSalt('password', salt);
            expect(hash.startsWith('vH1.')).toBe(true);
            expect(verifyPasswordAgainstHashes('password', salt, [hash])).toBe(
                true
            );
            expect(hash).toMatchSnapshot();
        });

        it('should throw if given a null password', () => {
            expect(() => {
                hashLowEntropyPasswordWithSalt(null, '');
            }).toThrow(
                new Error('Invalid password. Must not be null or undefined.')
            );
        });

        it('should throw if given a null salt', () => {
            expect(() => {
                hashLowEntropyPasswordWithSalt('password', null);
            }).toThrow(
                new Error('Invalid salt. Must not be null or undefined.')
            );
        });
    });

    describe('hashHighEntropyPasswordWithSalt()', () => {
        it('should return a password hash', () => {
            const salt = fromByteArray(randomBytes(16));
            const hash = hashHighEntropyPasswordWithSalt('password', salt);
            expect(hash.startsWith('vH2.')).toBe(true);
            expect(verifyPasswordAgainstHashes('password', salt, [hash])).toBe(
                true
            );
        });

        it('should return a consistent hash', () => {
            const salt = 'GsVJeVGNV4+j1sjyfF13sg==';
            const hash = hashHighEntropyPasswordWithSalt('password', salt);
            expect(hash.startsWith('vH2.')).toBe(true);
            expect(verifyPasswordAgainstHashes('password', salt, [hash])).toBe(
                true
            );
            expect(hash).toMatchSnapshot();
        });

        it('should throw if given a null password', () => {
            expect(() => {
                hashHighEntropyPasswordWithSalt(null, '');
            }).toThrow(
                new Error('Invalid password. Must not be null or undefined.')
            );
        });

        it('should throw if given a null salt', () => {
            expect(() => {
                hashHighEntropyPasswordWithSalt('password', null);
            }).toThrow(
                new Error('Invalid salt. Must not be null or undefined.')
            );
        });
    });
});
