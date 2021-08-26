import {
    convertToCopiableValue,
    embedBase64InPdf,
    formatAuthToken,
    getEmbeddedBase64FromPdf,
    parseAuthToken,
} from './Utils';

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

    it('should convert simple recursive objects', () => {
        let test1 = {
            test2: null as any,
        };
        let test3 = {
            test1: test1,
        };
        let test2 = {
            test3: test3,
        };

        test1.test2 = test2;
        const result = convertToCopiableValue(test1);

        expect(result).toEqual(test1);
    });

    it('should convert deep objects to a string', () => {
        let obj = {} as any;
        let current = obj;
        for (let i = 0; i < 10000; i++) {
            current = current['deep'] = {};
        }

        const result = convertToCopiableValue(obj);

        expect(result).toBe('[Nested object]');
    });
});

describe('embedBase64InPdf()', () => {
    it('should reference the given data in the PDF', () => {
        const data = 'abcdefghiabcdefghi';
        const result = embedBase64InPdf(data);

        expect(result).toContain(data);
        expect(result).toMatchSnapshot();
    });
});

describe('getEmbeddedBase64FromPdf()', () => {
    it('should return the data that was embedded in the PDF', () => {
        const data = 'abcdefghiabcdefghi';
        const pdf = embedBase64InPdf(data);
        const result = getEmbeddedBase64FromPdf(pdf);

        expect(result).toEqual(data);
    });
});

describe('formatAuthToken()', () => {
    const cases = [['myToken', 'myService', 'myToken.myService']];

    it.each(cases)('should format %s and %s', (token, service, expected) => {
        const result = formatAuthToken(token, service);

        expect(result).toBe(expected);
    });
});

describe('parseAuthToken()', () => {
    const cases = [
        ['myToken.myService', ['myToken', 'myService']] as const,
        ['myToken.mySer.vice', ['myToken', 'mySer.vice']] as const,
        ['myToken', null as any] as const,
    ] as const;

    it.each(cases)('should format %s and %s', (token, expected) => {
        const result = parseAuthToken(token);

        expect(result).toEqual(expected);
    });
});
