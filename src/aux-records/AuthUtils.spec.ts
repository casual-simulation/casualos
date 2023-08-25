import { connect } from 'http2';
import {
    formatV1OpenAiKey,
    formatV1SessionKey,
    isOpenAiKey,
    parseOpenAiKey,
    parseSessionKey,
    randomCode,
    RANDOM_CODE_LENGTH,
    formatV1ConnectionKey,
    parseConnectionKey,
    formatV1ConnectionToken,
    parseConnectionToken,
    generateV1ConnectionToken,
    parseV1ConnectionToken,
    verifyConnectionToken,
} from './AuthUtils';
import { toBase64String } from './Utils';

describe('randomCode()', () => {
    it('should generate a random number code with 6 characters', () => {
        const numbers = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const code = randomCode();
            expect(code).toHaveLength(RANDOM_CODE_LENGTH);
            expect(code).not.toBe('000000');
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

describe('formatV1OpenAiKey()', () => {
    it('should format the OpenAI Key', () => {
        const result = formatV1OpenAiKey('api key');

        const [version, apiKey] = result.split('.');

        expect(version).toBe('vAI1');
        expect(apiKey).toBe(toBase64String('api key'));
    });
});

describe('isOpenAiKey()', () => {
    it('should determine if the given value is an OpenAI Key', () => {
        expect(isOpenAiKey('api key')).toBe(false);
        expect(isOpenAiKey(123 as any)).toBe(false);
        expect(isOpenAiKey('vAI1.hello')).toBe(true);
    });
});

describe('parseOpenAIKey()', () => {
    it('should parse the given key', () => {
        expect(parseOpenAiKey(`vAI1.${toBase64String('hello')}`)).toEqual([
            'hello',
        ]);
        expect(parseOpenAiKey(123 as any)).toEqual(null);
        expect(parseOpenAiKey('vAI2.hello')).toEqual(null);
        expect(parseOpenAiKey('')).toEqual(null);
    });
});

describe('formatV1ConnectionKey()', () => {
    it('should combine the given user id, session id, and password', () => {
        const result = formatV1ConnectionKey(
            'userId',
            'sessionId',
            'password',
            123
        );

        const [version, userId, sessionId, password, expireTime] =
            result.split('.');

        expect(version).toBe('vCK1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(password).toBe(toBase64String('password'));
        expect(expireTime).toBe(toBase64String('123'));
    });
});

describe('parseConnectionKey()', () => {
    describe('v1', () => {
        it('should parse the given key into the userId, sessionId, password, and expire time', () => {
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                'password',
                123
            );
            const [userId, sessionId, password, expireTime] =
                parseConnectionKey(key);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(password).toBe('password');
            expect(expireTime).toBe(123);
        });

        it('should return null if given an empty string', () => {
            const result = parseConnectionKey('');

            expect(result).toBe(null);
        });

        it('should return null if given a string with the wrong version', () => {
            const result = parseConnectionKey('vK1');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no data', () => {
            const result = parseConnectionKey('vCK1.');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session ID', () => {
            const result = parseConnectionKey(
                `vCK1.${toBase64String('userId')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session password', () => {
            const result = parseConnectionKey(
                `vCK1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no expire time', () => {
            const result = parseConnectionKey(
                `vCK1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}.${toBase64String('password')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseConnectionKey(null);

            expect(result).toBe(null);
        });
    });
});

describe('formatV1ConnectionToken()', () => {
    it('should combine the given user id, session id, and password', () => {
        const result = formatV1ConnectionToken(
            'userId',
            'sessionId',
            'connectionId',
            'inst',
            'hmac'
        );

        const [version, userId, sessionId, connectionId, inst, hmac] =
            result.split('.');

        expect(version).toBe('vCT1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(connectionId).toBe(toBase64String('connectionId'));
        expect(inst).toBe(toBase64String('inst'));
        expect(hmac).toBe(toBase64String('hmac'));
    });
});

describe('parseConnectionToken()', () => {
    describe('v1', () => {
        it('should parse the given token into the userId, sessionId, hash, connectionId, inst, and deviceId', () => {
            const token = formatV1ConnectionToken(
                'userId',
                'sessionId',
                'connectionId',
                'inst',
                'hash'
            );
            const [userId, sessionId, connectionId, inst, hash] =
                parseConnectionToken(token);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(connectionId).toBe('connectionId');
            expect(inst).toBe('inst');
            expect(hash).toBe('hash');
        });

        it('should return null if given an empty string', () => {
            const result = parseConnectionToken('');

            expect(result).toBe(null);
        });

        it('should return null if given a string with the wrong version', () => {
            const result = parseConnectionToken('vT1');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no data', () => {
            const result = parseConnectionToken('vCT1.');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session ID', () => {
            const result = parseConnectionToken(
                `vCT1.${toBase64String('userId')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no connection ID', () => {
            const result = parseConnectionToken(
                `vCT1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no password', () => {
            const result = parseConnectionToken(
                `vCT1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}.${toBase64String('connectionId')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseConnectionToken(null);

            expect(result).toBe(null);
        });
    });
});

describe('generateV1ConnectionToken()', () => {
    it('should generate a connection token from the given connection key', () => {
        const key = formatV1ConnectionKey(
            'userId',
            'sessionId',
            'password',
            123
        );

        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');

        const [version, userId, sessionId, connectionId, inst, password] =
            result.split('.');

        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(connectionId).toBe(toBase64String('connectionId'));
        expect(inst).toBe(toBase64String('inst'));
        expect(password).toMatchSnapshot();
    });
});

describe('verifyConnectionToken()', () => {
    const password = toBase64String('password');
    const wrongPassword = toBase64String('wrong password');
    const key = formatV1ConnectionKey('userId', 'sessionId', password, 123);

    it('should return true when the given token is valid', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        expect(verifyConnectionToken(result, password)).toBe(true);
    });

    it('should return false when the given given a null token', () => {
        expect(verifyConnectionToken(null, password)).toBe(false);
    });

    it('should return false when given a null secret', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        expect(verifyConnectionToken(result, null)).toBe(false);
    });

    it('should return false when the given token is invalid', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        expect(verifyConnectionToken(result, wrongPassword)).toBe(false);
    });

    it('should return false when the given token hash doesnt match the connection ID', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'wrong connection id',
            inst,
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the given token hash doesnt match the inst', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            connectionId,
            'wrong inst',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the connection ID contains the entire inst', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'connectionIdinst',
            '',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the inst contains the connection ID', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            '',
            'connectionIdinst',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the inst and connection ID are shifted', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'connectionIdin',
            'st',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false if given invalid base 64', () => {
        const result = generateV1ConnectionToken(key, 'connectionId', 'inst');
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'connectionIdin',
            'st',
            password
        );

        expect(verifyConnectionToken(token, 'wrong')).toBe(false);
    });
});
