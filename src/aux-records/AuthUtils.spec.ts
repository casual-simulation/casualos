import {
    formatV1OpenAiKey,
    formatV1SessionKey,
    isOpenAiKey,
    parseOpenAiKey,
    parseSessionKey,
    formatV1ConnectionKey,
    parseConnectionKey,
    generateV1ConnectionToken,
    verifyConnectionToken,
    isSuperUserRole,
} from './AuthUtils';
import {
    toBase64String,
    formatV1ConnectionToken,
    parseConnectionToken,
} from '@casual-simulation/aux-common';


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

    it('should support sessions that dont expire', () => {
        const result = formatV1SessionKey(
            'userId',
            'sessionId',
            'password',
            null
        );

        const [version, userId, sessionId, password, expireTime] =
            result.split('.');

        expect(version).toBe('vSK1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(password).toBe(toBase64String('password'));
        expect(expireTime).toBe(toBase64String('Infinity'));
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

        it('should parse the sessions that dont expire', () => {
            const key = formatV1SessionKey(
                'userId',
                'sessionId',
                'password',
                null
            );
            const [userId, sessionId, password, expireTime] =
                parseSessionKey(key);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(password).toBe('password');
            expect(expireTime).toBe(null);
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

    it('should support sessions that dont expire', () => {
        const result = formatV1ConnectionKey(
            'userId',
            'sessionId',
            'password',
            null
        );

        const [version, userId, sessionId, password, expireTime] =
            result.split('.');

        expect(version).toBe('vCK1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(password).toBe(toBase64String('password'));
        expect(expireTime).toBe(toBase64String('Infinity'));
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

        it('should parse keys that dont expire', () => {
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                'password',
                null
            );
            const [userId, sessionId, password, expireTime] =
                parseConnectionKey(key);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(password).toBe('password');
            expect(expireTime).toBe(null);
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

        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );

        const [
            version,
            userId,
            sessionId,
            connectionId,
            recordName,
            inst,
            password,
        ] = result.split('.');

        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(connectionId).toBe(toBase64String('connectionId'));
        expect(recordName).toBe(toBase64String('recordName'));
        expect(inst).toBe(toBase64String('inst'));
        expect(password).toMatchSnapshot();
    });

    it('should generate a connection token with a null recordName', () => {
        const key = formatV1ConnectionKey(
            'userId',
            'sessionId',
            'password',
            123
        );

        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            null,
            'inst'
        );

        const [
            version,
            userId,
            sessionId,
            connectionId,
            recordName,
            inst,
            password,
        ] = result.split('.');

        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(connectionId).toBe(toBase64String('connectionId'));
        expect(recordName).toBe('');
        expect(inst).toBe(toBase64String('inst'));
        expect(password).toMatchSnapshot();
    });
});

describe('verifyConnectionToken()', () => {
    const password = toBase64String('password');
    const wrongPassword = toBase64String('wrong password');
    const key = formatV1ConnectionKey('userId', 'sessionId', password, 123);

    it('should return true when the given token is valid', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        expect(verifyConnectionToken(result, password)).toBe(true);
    });

    it('should be able to verify a token with a null recordName', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            null,
            'inst'
        );
        expect(verifyConnectionToken(result, password)).toBe(true);
    });

    it('should return false when the given given a null token', () => {
        expect(verifyConnectionToken(null, password)).toBe(false);
    });

    it('should return false when given a null secret', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        expect(verifyConnectionToken(result, null)).toBe(false);
    });

    it('should return false when the given token is invalid', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        expect(verifyConnectionToken(result, wrongPassword)).toBe(false);
    });

    it('should return false when the given token hash doesnt match the connection ID', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'wrong connection id',
            'recordName',
            inst,
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the given token hash doesnt match the inst', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            connectionId,
            'recordName',
            'wrong inst',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the record name contains the entire inst', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'connectionId',
            'recordNameinst',
            '',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the record name contains the connection ID', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            '',
            'connectionIdrecordName',
            'inst',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false when the record name and connection ID are shifted', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'connectionIdrecord',
            'name',
            'inst',
            password
        );

        expect(verifyConnectionToken(token, password)).toBe(false);
    });

    it('should return false if given invalid base 64', () => {
        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            'recordName',
            'inst'
        );
        const [userId, sessionId, connectionId, inst, password] =
            parseConnectionToken(result);
        const token = formatV1ConnectionToken(
            userId,
            sessionId,
            'connectionId',
            'recordName',
            'inst',
            password
        );

        expect(verifyConnectionToken(token, 'wrong')).toBe(false);
    });
});

describe('parseConnectionToken()', () => {
    const password = toBase64String('password');

    describe('v1', () => {
        const key = formatV1ConnectionKey('userId', 'sessionId', password, 123);

        it('should be able to parse a connection token', () => {
            const result = generateV1ConnectionToken(
                key,
                'connectionId',
                'recordName',
                'inst'
            );

            const parsed = parseConnectionToken(result);
            expect(parsed).toEqual([
                'userId',
                'sessionId',
                'connectionId',
                'recordName',
                'inst',
                expect.any(String),
            ]);
        });

        it('should be able to parse a connection token with a null recordName', () => {
            const result = generateV1ConnectionToken(
                key,
                'connectionId',
                null,
                'inst'
            );

            const parsed = parseConnectionToken(result);
            expect(parsed).toEqual([
                'userId',
                'sessionId',
                'connectionId',
                null,
                'inst',
                expect.any(String),
            ]);
        });

        it('should treat empty record names as null', () => {
            const result = generateV1ConnectionToken(
                key,
                'connectionId',
                '',
                'inst'
            );

            const parsed = parseConnectionToken(result);
            expect(parsed).toEqual([
                'userId',
                'sessionId',
                'connectionId',
                null,
                'inst',
                expect.any(String),
            ]);
        });
    });
});

describe('isSuperUserRole()', () => {
    it('should return true if the given user has the super user role', () => {
        expect(isSuperUserRole('superUser')).toBe(true);
    });

    it('should return false if the given user does not have the super user role', () => {
        expect(isSuperUserRole('none')).toBe(false);
        expect(isSuperUserRole(null)).toBe(false);
        expect(isSuperUserRole(undefined)).toBe(false);
    });
});
