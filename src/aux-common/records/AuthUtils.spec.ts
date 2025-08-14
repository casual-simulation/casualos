/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// import type { UserRole } from '../../aux-records/AuthStore';
import type { UserRole } from './AuthUtils';
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
    isExpired,
    willExpire,
    getSessionKeyExpiration,
    canExpire,
    timeUntilExpiration,
    timeUntilRefresh,
    isPackageReviewerRole,
} from './AuthUtils';
import { toBase64String } from '../utils';
import { formatV1ConnectionToken, parseConnectionToken } from '../common';
import { formatV2RecordKey } from './RecordKeys';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

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

describe('isExpired()', () => {
    it('should return true when the time is equal to now', () => {
        expect(isExpired(123, 123)).toBe(true);
    });

    it('should return true when the time is 0', () => {
        expect(isExpired(0)).toBe(true);
    });

    it('should return false when the time is greater than now', () => {
        expect(isExpired(123, 122)).toBe(false);
    });

    it('should return false when the time is null', () => {
        expect(isExpired(null, 122)).toBe(false);
    });

    it('should return false when the time is Infinity', () => {
        expect(isExpired(Infinity, 122)).toBe(false);
    });
});

describe('willExpire()', () => {
    it('should return true when the key is expired', () => {
        expect(willExpire(123, 123)).toBe(true);
    });

    it('should return true when the key will expire 1 week from now', () => {
        expect(willExpire(3 * DAY + WEEK, 3 * DAY)).toBe(true);
    });

    it('should return false when the key will expire 1 week + 1ms from now', () => {
        expect(isExpired(3 * DAY + WEEK + 1, 3 * DAY)).toBe(false);
    });

    it('should return false when the time is null', () => {
        expect(isExpired(null, 122)).toBe(false);
    });

    it('should return false when the time is Infinity', () => {
        expect(isExpired(Infinity, 122)).toBe(false);
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

describe('canExpire()', () => {
    it('should return true if the given time is finite', () => {
        expect(canExpire(123)).toBe(true);
    });

    it('should return false if the time is null', () => {
        expect(canExpire(null)).toBe(false);
    });

    it('should return false if the time is Infinite', () => {
        expect(canExpire(Infinity)).toBe(false);
    });

    it('should return false if the time is less than 0', () => {
        expect(canExpire(-1)).toBe(false);
    });
});

describe('timeUntilExpiration()', () => {
    it('should return 0 if the key just expired', () => {
        expect(timeUntilExpiration(123, 123)).toBe(0);
    });

    it('should return the amount of time since the key expired', () => {
        expect(timeUntilExpiration(123, 124)).toBe(-1);
    });

    it('should return the amount of time until the key expires', () => {
        expect(timeUntilExpiration(500, 100)).toBe(400);
    });

    it('should return Infinity if the expiration time is null', () => {
        expect(timeUntilExpiration(null, 500)).toBe(Infinity);
    });

    it('should return Infinity if the expiration time is Infinity', () => {
        expect(timeUntilExpiration(Infinity, 500)).toBe(Infinity);
    });
});

describe('timeUntilRefresh()', () => {
    it('should return -WEEK if the key just expired', () => {
        expect(timeUntilRefresh(123, 123)).toBe(-WEEK);
    });

    it('should return the amount of time since the ideal refresh time', () => {
        expect(timeUntilRefresh(123, 124)).toBe(-1 - WEEK);
    });

    it('should return the amount of time until the ideal refresh time', () => {
        expect(timeUntilRefresh(3 * DAY + WEEK, DAY)).toBe(2 * DAY);
    });

    it('should return Infinity if the expiration time is null', () => {
        expect(timeUntilRefresh(null, 500)).toBe(Infinity);
    });

    it('should return Infinity if the expiration time is Infinity', () => {
        expect(timeUntilRefresh(Infinity, 500)).toBe(Infinity);
    });
});

describe('getSessionKeyExpiration()', () => {
    it('should return the expiration time of the given session key', () => {
        const key = formatV1SessionKey('userId', 'sessionId', 'password', 123);
        const result = getSessionKeyExpiration(key);
        expect(result).toBe(123);
    });

    it('should return infinity if the session key has no expiration', () => {
        const key = formatV1SessionKey('userId', 'sessionId', 'password', null);
        const result = getSessionKeyExpiration(key);
        expect(result).toBe(Infinity);
    });

    it('should return -1 if the key is invalid', () => {
        const result = getSessionKeyExpiration('invalid');
        expect(result).toBe(-1);
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

    it('should parse record keys before using the record name', () => {
        const recordKey = formatV2RecordKey(
            'recordName',
            'password',
            'subjectfull'
        );

        const key = formatV1ConnectionKey(
            'userId',
            'sessionId',
            'password',
            123
        );

        const result = generateV1ConnectionToken(
            key,
            'connectionId',
            recordKey,
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
    it('should return true if the given user has the super user or system role', () => {
        expect(isSuperUserRole('superUser')).toBe(true);
        expect(isSuperUserRole('system')).toBe(true);
    });

    it('should return false if the given user does not have the super user role', () => {
        expect(isSuperUserRole('none')).toBe(false);
        expect(isSuperUserRole(null)).toBe(false);
        expect(isSuperUserRole(undefined)).toBe(false);
    });
});

describe('isPackageReviewerRole()', () => {
    const cases: [UserRole | null | undefined, boolean][] = [
        ['superUser', true],
        ['moderator', true],
        ['system', true],
        ['none', false],
        [null, false],
        [undefined, false],
    ];

    it.each(cases)('should return %s for %s', (role, expected) => {
        expect(isPackageReviewerRole(role)).toBe(expected);
    });
});
