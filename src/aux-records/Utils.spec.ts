import {
    toBase64String,
    fromBase64String,
    createCanonicalRequest,
    encodeHexUtf8,
    canonicalUriEncode,
    createStringToSign,
    createAWS4Signature,
    signRequest,
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

describe('signRequest()', () => {
    it('should return an object containing the information for the request', () => {
        const now = new Date('2021-12-21T00:00:00.000Z');
        const result = signRequest(
            {
                method: 'POST',
                uri: '/this-is-a-test.png',
                headers: {
                    'Content-Type': 'image/png',
                    'Content-Length': '123',
                    ABC: ' def ',
                },
                queryString: {
                    'Hello World': 'jkl',
                    zyx: '123',
                    abc: 'def',
                },
                payloadSha256Hex: 'payload-hash',
            },
            'SECRET_KEY',
            'KEY_ID',
            now,
            'us-east-1',
            's3'
        );

        expect(result).toEqual({
            method: 'POST',
            uri: '/this-is-a-test.png',
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'x-amz-date': '20211221T000000Z',
                'x-amz-content-sha256': 'payload-hash',
                ABC: ' def ',
                Authorization:
                    'AWS4-HMAC-SHA256 Credential=KEY_ID/20211221/us-east-1/s3/aws4_request,SignedHeaders=abc;content-length;content-type;x-amz-content-sha256;x-amz-date,Signature=8a48e720b6f97b8bfaf47e05ab6556769f6d08ff775a8c8b983ed8bcdeeae132',
            },
        });
    });

    it('should lowercase the payload SHA-256 hex', () => {
        const now = new Date('2021-12-21T00:00:00.000Z');
        const result = signRequest(
            {
                method: 'POST',
                uri: '/this-is-a-test.png',
                headers: {
                    'Content-Type': 'image/png',
                    'Content-Length': '123',
                    ABC: ' def ',
                },
                queryString: {
                    'Hello World': 'jkl',
                    zyx: '123',
                    abc: 'def',
                },
                payloadSha256Hex: 'PAYLOAD-HASH',
            },
            'SECRET_KEY',
            'KEY_ID',
            now,
            'us-east-1',
            's3'
        );

        expect(result).toEqual({
            method: 'POST',
            uri: '/this-is-a-test.png',
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'x-amz-date': '20211221T000000Z',
                'x-amz-content-sha256': 'payload-hash',
                ABC: ' def ',
                Authorization:
                    'AWS4-HMAC-SHA256 Credential=KEY_ID/20211221/us-east-1/s3/aws4_request,SignedHeaders=abc;content-length;content-type;x-amz-content-sha256;x-amz-date,Signature=8a48e720b6f97b8bfaf47e05ab6556769f6d08ff775a8c8b983ed8bcdeeae132',
            },
        });
    });
});

describe('createCanonicalRequest()', () => {
    it('should return a string containing the request data', () => {
        const result = createCanonicalRequest({
            method: 'POST',
            uri: '/this-is-a-test.png',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'X-Amz-Date': '20211221T000000Z',
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
            'POST\n/this-is-a-test.png\nHello%20World=jkl&abc=def&zyx=123\nabc:def\ncontent-length:123\ncontent-type:image/png\nx-amz-date:20211221T000000Z\nabc;content-length;content-type;x-amz-date\npayload-hash'
        );
    });

    it('should lowercase the payload SHA-256 hex', () => {
        const result = createCanonicalRequest({
            method: 'POST',
            uri: '/this-is-a-test.png',
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': '123',
                'X-Amz-Date': '20211221T000000Z',
                ABC: ' def ',
            },
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'MY-PAYLOAD-HASH',
        });

        expect(result).toEqual(
            'POST\n/this-is-a-test.png\nHello%20World=jkl&abc=def&zyx=123\nabc:def\ncontent-length:123\ncontent-type:image/png\nx-amz-date:20211221T000000Z\nabc;content-length;content-type;x-amz-date\nmy-payload-hash'
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
                'X-Amz-Date': '20211221T000000Z',
                ABC: ' def ',
            },
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
        });

        const date = new Date('2021-12-21T00:00:00.000Z');
        const result = createStringToSign(
            canonicalRequest,
            date,
            'us-east-1',
            's3'
        );

        expect(result).toEqual(
            'AWS4-HMAC-SHA256\n20211221T000000Z\n20211221/us-east-1/s3/aws4_request\n3b3de9b1f415a8818e4f7aad549513b948a8ba7666598a34c3dc1aa9479b9255'
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
                'X-Amz-Date': '20211221T000000Z',
                ABC: ' def ',
            },
            queryString: {
                'Hello World': 'jkl',
                zyx: '123',
                abc: 'def',
            },
            payloadSha256Hex: 'payload-hash',
        });

        const date = new Date('2021-12-21T00:00:00.000Z');
        const stringToSign = createStringToSign(
            canonicalRequest,
            date,
            'us-east-1',
            's3'
        );

        const result = createAWS4Signature(
            stringToSign,
            'SECRET_KEY',
            date,
            'us-east-1',
            's3'
        );

        expect(result).toBe(
            '35d13ad0ef1763578b927975ee515e7a33ccffccc7a8516f5b26bee0b4038383'
        );
    });
});

describe('canonicalUriEncode()', () => {
    const cases = [
        ['', '', false] as const,
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
