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
import { toBase64String } from '../utils';
import {
    DEFAULT_RECORD_KEY_POLICY,
    formatV1RecordKey,
    formatV2RecordKey,
    parseRecordKey,
} from './RecordKeys';

describe('formatV1RecordKey()', () => {
    it('should combine the given record name and password', () => {
        const result = formatV1RecordKey('name', 'password');

        const [version, name, password] = result.split('.');

        expect(version).toBe('vRK1');
        expect(name).toBe(toBase64String('name'));
        expect(password).toBe(toBase64String('password'));
    });
});

describe('formatV2RecordKey()', () => {
    it('should combine the given record name and password and policy', () => {
        const result = formatV2RecordKey('name', 'password', 'subjectless');

        const split = result.split('.');

        expect(split).toEqual([
            'vRK2',
            toBase64String('name'),
            toBase64String('password'),
            'subjectless',
        ]);
    });

    it('should default to subjectfull policies', () => {
        const result = formatV2RecordKey('name', 'password', null);

        const split = result.split('.');

        expect(split).toEqual([
            'vRK2',
            toBase64String('name'),
            toBase64String('password'),
            'subjectfull',
        ]);
    });
});

describe('parseRecordKey()', () => {
    describe('v1', () => {
        it('should parse the given key into the name and password', () => {
            const key = formatV1RecordKey('name', 'password');
            const [name, password, policy] = parseRecordKey(key);

            expect(name).toBe('name');
            expect(password).toBe('password');
            expect(policy).toBe(DEFAULT_RECORD_KEY_POLICY); // Should always be the default policy
        });

        it('should return null if given an empty string', () => {
            const result = parseRecordKey('');

            expect(result).toBe(null);
        });

        it('should return null if given a string with the wrong version', () => {
            const result = parseRecordKey('vK1');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no data', () => {
            const result = parseRecordKey('vRK1.');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no password', () => {
            const result = parseRecordKey(`vRK1.${toBase64String('name')}`);

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseRecordKey(null);

            expect(result).toBe(null);
        });
    });

    describe('v2', () => {
        it('should parse the given key into the name and password', () => {
            const key = formatV2RecordKey('name', 'password', 'subjectless');
            const [name, password, policy] = parseRecordKey(key);

            expect(name).toBe('name');
            expect(password).toBe('password');
            expect(policy).toBe('subjectless');
        });

        it('should return null if given an empty string', () => {
            const result = parseRecordKey('');

            expect(result).toBe(null);
        });

        it('should return null if given a string with the wrong version', () => {
            const result = parseRecordKey('vK2');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no data', () => {
            const result = parseRecordKey('vRK2.');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no password', () => {
            const result = parseRecordKey(`vRK2.${toBase64String('name')}`);

            expect(result).toBe(null);
        });

        it('should return null if given a string with no policy', () => {
            const result = parseRecordKey(
                `vRK2.${toBase64String('name')}.${toBase64String('password')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with an unknown policy', () => {
            const result = parseRecordKey(
                `vRK2.${toBase64String('name')}.${toBase64String(
                    'password'
                )}.wrong`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseRecordKey(null);

            expect(result).toBe(null);
        });
    });
});
