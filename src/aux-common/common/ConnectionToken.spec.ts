import {
    formatV1ConnectionToken,
    parseConnectionToken,
} from './ConnectionToken';
import { toBase64String, fromBase64String } from '../utils';

describe('formatV1ConnectionToken()', () => {
    it('should combine the given user id, session id, and password', () => {
        const result = formatV1ConnectionToken(
            'userId',
            'sessionId',
            'connectionId',
            'record',
            'inst',
            'hmac'
        );

        const [
            version,
            userId,
            sessionId,
            connectionId,
            recordName,
            inst,
            hmac,
        ] = result.split('.');

        expect(version).toBe('vCT1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(connectionId).toBe(toBase64String('connectionId'));
        expect(recordName).toBe(toBase64String('record'));
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
                'recordName',
                'inst',
                'hash'
            );
            const [userId, sessionId, connectionId, recordName, inst, hash] =
                parseConnectionToken(token);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(connectionId).toBe('connectionId');
            expect(recordName).toBe('recordName');
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

        it('should return null if given a string with no record name', () => {
            const result = parseConnectionToken(
                `vCT1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}.${toBase64String('connectionId')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no inst', () => {
            const result = parseConnectionToken(
                `vCT1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}.${toBase64String('connectionId')}.${toBase64String(
                    'recordName'
                )}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with no hash', () => {
            const result = parseConnectionToken(
                `vCT1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}.${toBase64String('connectionId')}.${toBase64String(
                    'recordName'
                )}.${toBase64String('inst')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseConnectionToken(null);

            expect(result).toBe(null);
        });
    });
});
