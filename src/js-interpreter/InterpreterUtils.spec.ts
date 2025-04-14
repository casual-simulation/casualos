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
    isConstructor,
    isGenerator,
    unwind,
    unwindAndCapture,
} from './InterpreterUtils';

describe('unwind()', () => {
    it('should unwrap the given generator', () => {
        let gen = function* () {
            yield 1;
            yield 2;
            yield 3;
            return 4;
        };

        expect(unwind(gen())).toBe(4);
    });
});

describe('unwindAndCapture()', () => {
    it('should unwrap the given generator', () => {
        let gen = function* () {
            yield 1;
            yield 2;
            yield 3;
            return 4;
        };

        let { result, states } = unwindAndCapture(gen());
        expect(result).toBe(4);
        expect(states).toEqual([1, 2, 3]);
    });
});

describe('isGenerator()', () => {
    const falsyCases = [
        [true] as const,
        [false] as const,
        [123] as const,
        ['abc'] as const,
        [BigInt(123)] as const,
        [Symbol('hello')] as const,
        [/abc/] as const,
        [[]] as const,
        [{}] as const,
        [null] as const,
        [undefined] as const,
    ];

    it.each(falsyCases)('should return false if the given %s', (value) => {
        expect(isGenerator(value)).toBe(false);
    });

    it('should return true if the given value was created by a generator function', () => {
        let func = function* () {
            yield 1;
            yield 2;
            yield 3;
            return 4;
        };

        let gen = func();

        expect(isGenerator(gen)).toBe(true);
    });

    it('should return true if the given value has all the required properties', () => {
        let gen = {
            next() {},
            throw() {},
            return() {},

            [Symbol.iterator]: () => {},
        };

        expect(isGenerator(gen)).toBe(true);
    });

    it('should return false if the given value does not have a .next() function', () => {
        let gen = {
            throw() {},
            return() {},

            [Symbol.iterator]: () => {},
        };

        expect(isGenerator(gen)).toBe(false);
    });

    it('should return false if the given value does not have a .throw() function', () => {
        let gen = {
            next() {},
            return() {},

            [Symbol.iterator]: () => {},
        };

        expect(isGenerator(gen)).toBe(false);
    });

    it('should return false if the given value does not have a .return() function', () => {
        let gen = {
            next() {},
            return() {},

            [Symbol.iterator]: () => {},
        };

        expect(isGenerator(gen)).toBe(false);
    });

    it('should return false if the given value does not have a .[Symbol.iterator] function', () => {
        let gen = {
            next() {},
            throw() {},
            return() {},
        };

        expect(isGenerator(gen)).toBe(false);
    });
});

describe('isConstructor()', () => {
    const cases = [
        ['abc', false] as const,
        [123, false] as const,
        [true, false] as const,
        [null, false] as const,
        [undefined, false] as const,
        [() => {}, false] as const,
        [function () {}, true] as const,
        [class MyClass {}, true] as const,
        [Array, true] as const,
    ];

    it.each(cases)('should map %s to %s', (given, expected) => {
        expect(isConstructor(given)).toBe(expected);
    });
});
