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
import {
    merge,
    dotCaseToCamelCase,
    toBase64String,
    fromBase64String,
    tryParseJson,
} from './utils';

describe('utils', () => {
    describe('merge()', () => {
        it('should take keys from both objects and return a new object', () => {
            const first = {
                abc: 'def',
            };
            const second = {
                def: 'abc',
            };

            const final = merge(first, second);

            expect(final).toEqual({
                abc: 'def',
                def: 'abc',
            });
        });

        it('should not change objects that are the same in both', () => {
            const inner = {
                test: 'abc',
            };
            const first = {
                inner: inner,
                abc: 'def',
            };
            const second = {
                inner: inner,
                def: 'abc',
            };

            const final = merge(first, second);

            expect(final.inner).toBe(inner);
            expect(final).toEqual({
                inner: inner,
                abc: 'def',
                def: 'abc',
            });
        });

        it('should take the latest value', () => {
            const first = {
                abc: 'def',
            };
            const second = {
                abc: 'abc',
            };

            const final = merge(first, second);

            expect(final).toEqual({
                abc: 'abc',
            });
        });

        it('should preserve nulls but not undefined', () => {
            const first = {
                isNull: <any>null,
                value: 10,
                other: 'cool',
            };
            const second = {
                isUndefined: <any>undefined,
                value: <number>null,
                other: <number>undefined,
            };

            const final = merge(first, second);

            expect(final).toEqual({
                isNull: null,
                isUndefined: undefined,
                value: null,
                other: 'cool',
            });
        });
    });

    describe('dotCaseToCamelCase()', () => {
        const cases = [
            ['', ''],
            ['noChange', 'noChange'],
            ['1.2.3', '123'],
            ['dot.case', 'dotCase'],
            ['dot1.case2', 'dot1Case2'],
            ['dot1.2case', 'dot12case'],
            ['TITLE.CASE', 'TITLECASE'],
            ['dot._case', '_dotCase'],
            ['_dot._case', '_dotCase'],
        ];

        it.each(cases)('should convert %s to %s', (given, expected) => {
            expect(dotCaseToCamelCase(given)).toBe(expected);
        });
    });

    const cases = [['abc', 'YWJj']];

    it.each(cases)('toBase64String(%s) -> %s', (input, output) => {
        const result = toBase64String(input);

        expect(result).toBe(output);
    });

    it.each(cases)('%s <- fromBase64String(%s)', (input, output) => {
        const result = fromBase64String(output);

        expect(result).toBe(input);
    });

    describe('tryParseJson()', () => {
        it('should be able to parse the given JSON into a value', () => {
            expect(tryParseJson('{ "hello": 123 }')).toEqual({
                success: true,
                value: {
                    hello: 123,
                },
            });
        });

        it('should return an unsucessful result if the string is not JSON', () => {
            expect(tryParseJson('{')).toEqual({
                success: false,
                error: expect.any(Error),
            });
        });
    });
});
