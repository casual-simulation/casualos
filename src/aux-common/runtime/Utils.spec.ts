import {
    convertErrorToCopiableValue,
    convertToCopiableValue,
    embedBase64InPdf,
    formatAuthToken,
    getEmbeddedBase64FromPdf,
    parseAuthToken,
} from './Utils';
import './BlobPolyfill';
import { createDummyRuntimeBot } from './test/TestScriptBotFactory';

describe('convertErrorToCopiableValue()', () => {
    it('should convert error objects into an object with message and name', () => {
        const err1 = new Error('abc');
        const err2 = new SyntaxError('def');

        expect(convertErrorToCopiableValue(err1)).toEqual({
            name: 'Error',
            message: 'abc',
            stack: expect.any(String),
        });
        expect(convertErrorToCopiableValue(err2)).toEqual({
            name: 'SyntaxError',
            message: 'def',
            stack: expect.any(String),
        });
    });

    it('should include a cut-down version of the response object stored in the error', () => {
        const err1 = new Error('abc') as any;
        err1.response = {
            extra: 'wrong',
            data: { abc: 'def' },
            headers: { header1: true },
            status: 500,
            statusText: '',
        };

        expect(convertErrorToCopiableValue(err1)).toEqual({
            name: 'Error',
            message: 'abc',
            stack: expect.any(String),
            response: {
                data: { abc: 'def' },
                headers: { header1: true },
                status: 500,
                statusText: '',
            },
        });
    });
});

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

    it('should leave simple objects alone', () => {
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

    it('should leave dates alone', () => {
        const result = convertToCopiableValue(new Date(2021, 10, 14));
        expect(result).toEqual(new Date(2021, 10, 14));
    });

    it('should leave undefined alone', () => {
        const result = convertToCopiableValue(undefined);
        expect(result).toBeUndefined();
    });

    it('should leave Blobs alone', () => {
        const value = new Blob(['abc']);
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    it('should leave ArrayBuffer objects alone', () => {
        const value = new ArrayBuffer(10);
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
    });

    const viewCases = [
        ['Uint8Array', new Uint8Array(20)] as const,
        ['Uint16Array', new Uint16Array(20)] as const,
        ['Uint32Array', new Uint32Array(20)] as const,
        ['Int8Array', new Int8Array(20)] as const,
        ['Int16Array', new Int16Array(20)] as const,
        ['Int32Array', new Int32Array(20)] as const,
        ['Float32Array', new Float32Array(20)] as const,
        ['Float64Array', new Float64Array(20)] as const,
    ];

    it.each(viewCases)('should leave %s views alone', (desc, value) => {
        const result = convertToCopiableValue(value);
        expect(result).toBe(value);
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

    it('should convert simple bots', () => {
        let bot1 = createDummyRuntimeBot('test1');
        bot1.tags.abc = '123';

        expect(convertToCopiableValue(bot1)).toEqual({
            id: 'test1',
            tags: {
                abc: '123',
            },
        });
    });

    it('should include the space in converted bots', () => {
        let bot1 = createDummyRuntimeBot(
            'test1',
            {
                abc: '123',
            },
            'mySpace' as any
        );

        expect(convertToCopiableValue(bot1)).toEqual({
            id: 'test1',
            space: 'mySpace' as any,
            tags: {
                abc: '123',
            },
        });
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
