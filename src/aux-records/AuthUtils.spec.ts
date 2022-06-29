import {
    formatV1SessionKey,
    parseSessionKey,
    randomCode,
    RANDOM_CODE_LENGTH,
} from './AuthUtils';
import { toBase64String } from './Utils';

describe('randomCode()', () => {
    it('should generate a random number code with 5 characters', () => {
        const numbers = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const code = randomCode();
            expect(code).toHaveLength(RANDOM_CODE_LENGTH);
            expect(code).not.toBe('00000');
            expect(numbers.has(code)).toBe(false);
            numbers.add(code);
        }
    });
});

describe('formatV1SessionKey()', () => {
    it('should combine the given user id, session id, and password', () => {
        const result = formatV1SessionKey(
            'userId',
            'sessionId',
            'password',
            123
        );

        const [version, userId, sessionId, password, expireTime] =
            result.split('.');

        expect(version).toBe('vSK1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(password).toBe(toBase64String('password'));
        expect(expireTime).toBe(toBase64String('123'));
    });
});

describe('parseSessionKey()', () => {
    describe('v1', () => {
        it('should parse the given key into the userId, sessionId, password, and expire time', () => {
            const key = formatV1SessionKey(
                'userId',
                'sessionId',
                'password',
                123
            );
            const [userId, sessionId, password, expireTime] =
                parseSessionKey(key);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(password).toBe('password');
            expect(expireTime).toBe(123);
        });

        it('should return null if given an empty string', () => {
            const result = parseSessionKey('');

            expect(result).toBe(null);
        });

        it('should return null if given a string with the wrong version', () => {
            const result = parseSessionKey('vK1');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no data', () => {
            const result = parseSessionKey('vSK1.');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session ID', () => {
            const result = parseSessionKey(`vSK1.${toBase64String('userId')}`);

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session password', () => {
            const result = parseSessionKey(
                `vSK1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no expire time', () => {
            const result = parseSessionKey(
                `vSK1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}.${toBase64String('password')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseSessionKey(null);

            expect(result).toBe(null);
        });
    });
});
