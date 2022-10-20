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
