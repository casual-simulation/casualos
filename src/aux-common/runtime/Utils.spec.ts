import { convertToCopiableValue } from './Utils';

describe('convertToCopiableValue()', () => {
    it('should leave strings alone', () => {
        const result = convertToCopiableValue('test');
        expect(result).toBe('test');
    });

    it('should leave numbers alone', () => {
        const result = convertToCopiableValue(0.23);
        expect(result).toBe(0.23);
    });

    it('should leave booleans alone', () => {
        const result = convertToCopiableValue(true);
        expect(result).toBe(true);
    });

    it('should leave objects alone', () => {
        const obj = {
            test: 'abc',
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual(obj);
    });

    it('should leave arrays alone', () => {
        const arr = ['abc'];
        const result = convertToCopiableValue(arr);
        expect(result).toEqual(arr);
    });

    it('should leave nulls alone', () => {
        const result = convertToCopiableValue(null);
        expect(result).toBe(null);
    });

    it('should leave undefined alone', () => {
        const result = convertToCopiableValue(undefined);
        expect(result).toBeUndefined();
    });

    it('should convert invalid properties in objects recursively', () => {
        const obj = {
            test: 'abc',
            func: function abc() {},
            err: new Error('qwerty'),
            nested: {
                func: function def() {},
                err: new SyntaxError('syntax'),
            },
            arr: [function ghi() {}, new Error('other')],
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual({
            test: 'abc',
            func: '[Function abc]',
            err: 'Error: qwerty',
            nested: {
                func: '[Function def]',
                err: 'SyntaxError: syntax',
            },
            arr: ['[Function ghi]', 'Error: other'],
        });
    });

    it('should convert invalid properties in arrays recursively', () => {
        const arr = [
            'abc',
            function abc() {},
            new Error('qwerty'),
            {
                func: function def() {},
                err: new SyntaxError('syntax'),
            },
            [function ghi() {}, new Error('other')],
        ];
        const result = convertToCopiableValue(arr);
        expect(result).toEqual([
            'abc',
            '[Function abc]',
            'Error: qwerty',
            {
                func: '[Function def]',
                err: 'SyntaxError: syntax',
            },
            ['[Function ghi]', 'Error: other'],
        ]);
    });

    it('should remove the metadata property from bots', () => {
        const obj: any = {
            id: 'test',
            metadata: {
                ref: null,
                tags: null,
            },
            tags: {},
        };
        const result = convertToCopiableValue(obj);
        expect(result).toEqual({
            id: 'test',
            tags: {},
        });
    });

    it('should convert functions to a string', () => {
        function test() {}
        const result = convertToCopiableValue(test);

        expect(result).toBe('[Function test]');
    });

    const errorCases = [
        ['Error', new Error('abcdef'), 'Error: abcdef'],
        ['SyntaxError', new SyntaxError('xyz'), 'SyntaxError: xyz'],
    ];

    it.each(errorCases)(
        'should convert %s to a string',
        (desc, err, expected) => {
            const result = convertToCopiableValue(err);
            expect(result).toBe(expected);
        }
    );
});
