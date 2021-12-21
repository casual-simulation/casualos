import {
    toBase64String,
    fromBase64String,
    createCanonicalRequest,
    encodeHexUtf8,
    canonicalUriEncode,
    createStringToSign,
    createAWS4Signature,
} from './Utils';

const cases = [['abc', 'YWJj']];

it.each(cases)('toBase64String(%s) -> %s', (input, output) => {
    const result = toBase64String(input);

    expect(result).toBe(output);
});

it.each(cases)('%s <- fromBase64String(%s)', (input, output) => {
    const result = fromBase64String(output);

    expect(result).toBe(input);
});

describe('createCanonicalRequest()', () => {
    it('should return a string containing the request data', () => {
        const result = createCanonicalRequest({
            method: 'POST',
            uri: '/this-is-a-test.png',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'X-Amz-Date': '20150830T123600Z',
                ABC: ' def ',
            },
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
        });

        expect(result).toEqual(
            'POST\n/this-is-a-test.png\nHello%20World=jkl&abc=def&zyx=123\nabc:def\ncontent-length:123\ncontent-type:image/png\nx-amz-date:20150830T123600Z\nabc;content-length;content-type;x-amz-date\npayload-hash'
        );
    });
});

describe('createStringToSign()', () => {
    it('should return a string containing the SHA-256 hash of the given payload', () => {
        const canonicalRequest = createCanonicalRequest({
            method: 'POST',
            uri: '/this-is-a-test.png',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'X-Amz-Date': '20150830T123600Z',
                ABC: ' def ',
            },
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
        });

        const date = new Date('2015-08-30T12:36:00.000Z');
        const result = createStringToSign(
            canonicalRequest,
            date,
            'us-east-1',
            's3'
        );

        expect(result).toEqual(
            'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/s3/aws4_request\n763a37dfaee69344ad2e521ce1301a01b2fc6466ce9fb4c9401982788b16304d'
        );
    });
});

describe('createAWS4Signature()', () => {
    it('should return a string that is the HMAC-SHA256 of the given string to sign', () => {
        const canonicalRequest = createCanonicalRequest({
            method: 'POST',
            uri: '/this-is-a-test.png',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'X-Amz-Date': '20150830T123600Z',
                ABC: ' def ',
            },
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
        });

        const date = new Date('2015-08-30T12:36:00.000Z');
        const stringToSign = createStringToSign(
            canonicalRequest,
            date,
            'us-east-1',
            's3'
        );

        const now = new Date('2021-12-21T00:00:00.000Z');
        const result = createAWS4Signature(
            stringToSign,
            'SECRET_KEY',
            now,
            'us-east-1',
            's3'
        );

        expect(result).toBe(
            '453a779369c091f6599ebc2b65c723c346f99c1764a56149066ee4fa0618b3b6'
        );
    });
});

describe('canonicalUriEncode()', () => {
    const cases = [
        ['abc', 'abc', false] as const,
        ['a b c', 'a%20b%20c', false] as const,
        ['a/b/c', 'a%2Fb%2Fc', true] as const,
        ['a/b/c', 'a/b/c', false] as const,
        ['a~b', 'a~b', false] as const,
        ['a.b', 'a.b', false] as const,
        ['a_b', 'a_b', false] as const,
        ['a-b', 'a-b', false] as const,
        ['a&b', 'a%26b', false] as const,
        ['a=b', 'a%3Db', false] as const,
    ];

    it.each(cases)(
        'should encode %s to %s (encode slashes=%s)',
        (given, expected, encodeSlashes) => {
            const result = canonicalUriEncode(given, encodeSlashes);
            expect(result).toBe(expected);
        }
    );
});

describe('encodeHexUtf8()', () => {
    const cases = [
        ['a', '%61'],
        ['A', '%41'],
        ['0', '%30'],
        ['9', '%39'],
        ['_', '%5F'],
        ['~', '%7E'],
        ['.', '%2E'],
        ['/', '%2F'],
        [' ', '%20'],
        ['%', '%25'],
        ['\t', '%09'],
        ['\n', '%0A'],
        ['\r', '%0D'],
    ];
    it.each(cases)(
        'should convert %s to %s',
        (given: string, expected: string) => {
            const result = encodeHexUtf8(given.charCodeAt(0));
            expect(result).toBe(expected);
        }
    );
});
