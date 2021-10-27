import stringify from './index';

describe('fast-json-stable-stringify', () => {
    it('should support nested objects', () => {
        var obj = { c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 };
        expect(stringify(obj)).toBe(
            '{"a":3,"b":[{"x":4,"y":5,"z":6},7],"c":8}'
        );
    });

    it('should error on cyclic objects', () => {
        expect(() => {
            let one: any = { a: 1 };
            let two: any = { a: 2, one: one };
            one.two = two;
            stringify(one);
        }).toThrowError(new TypeError('Converting circular structure to JSON'));
    });

    it('should support cyclic objects when specified', () => {
        let one: any = { a: 1 };
        let two: any = { a: 2, one: one };
        one.two = two;
        expect(stringify(one, { cycles: true })).toBe(
            '{"a":1,"two":{"a":2,"one":"__cycle__"}}'
        );
    });

    it('should support repeated non-cyclic values', () => {
        let one = { x: 1 };
        let two = { a: one, b: one };
        expect(stringify(two)).toBe('{"a":{"x":1},"b":{"x":1}}');
    });

    it('should support non-cyclic objects with reused obj-property pointers', () => {
        let x = { a: 1 };
        let y = { b: x, c: x };
        expect(stringify(y)).toBe('{"b":{"a":1},"c":{"a":1}}');
    });

    it('should support custom comparision functions', () => {
        var obj = { c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 };
        var s = stringify(obj, function (a, b) {
            return a.key < b.key ? 1 : -1;
        });
        expect(s).toBe('{"c":8,"b":[{"z":6,"y":5,"x":4},7],"a":3}');
    });

    const cases = [
        [
            'simple object',
            { c: 6, b: [4, 5], a: 3, z: null },
            '{"a":3,"b":[4,5],"c":6,"z":null}',
        ],
        ['object with undefined', { a: 3, z: undefined }, '{"a":3}'],
        ['object with null', { a: 3, z: null }, '{"a":3,"z":null}'],
        [
            'object with NaN and Infinity',
            { a: 3, b: NaN, c: Infinity },
            '{"a":3,"b":null,"c":null}',
        ],
        ['array with undefined', [4, undefined, 6], '[4,null,6]'],
        ['object with empty string', { a: 3, z: '' }, '{"a":3,"z":""}'],
        ['array with empty string', [4, '', 6], '[4,"",6]'],
    ] as [string, any, string][];

    it.each(cases)('should stringify %s', (name, obj, expected) => {
        expect(stringify(obj)).toBe(expected);
    });

    it('should support toJSON that returns object', () => {
        var obj = {
            one: 1,
            two: 2,
            toJSON: function () {
                return { one: 1 };
            },
        };
        expect(stringify(obj)).toBe('{"one":1}');
    });

    it('should support toJSON that returns string', () => {
        var obj = {
            one: 1,
            two: 2,
            toJSON: function () {
                return { one: 1 };
            },
        };
        expect(stringify(obj)).toBe('{"one":1}');
    });

    it('should support toJSON that returns array', () => {
        var obj = {
            one: 1,
            two: 2,
            toJSON: function () {
                return ['one'];
            },
        };
        expect(stringify(obj)).toBe('["one"]');
    });

    it('should pretty format objects when specified', () => {
        expect(stringify({ a: 1, b: 2 }, { space: 2 })).toBe(
            '{\n  "a": 1,\n  "b": 2\n}'
        );
    });
});
