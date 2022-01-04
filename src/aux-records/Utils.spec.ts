import {
    toBase64String,
    fromBase64String,
    createCanonicalRequest,
    encodeHexUtf8,
    canonicalUriEncode,
    createStringToSign,
    createAWS4Signature,
    signRequest,
    createSigningKey,
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
                    'AWS4-HMAC-SHA256 Credential=KEY_ID/20211221/us-east-1/s3/aws4_request,SignedHeaders=abc;content-length;content-type;x-amz-content-sha256;x-amz-date,Signature=3b5a6dd6af44de292c989ca7a9c09db24fecfb107c27dc63f063588bf6a53568',
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
                    'AWS4-HMAC-SHA256 Credential=KEY_ID/20211221/us-east-1/s3/aws4_request,SignedHeaders=abc;content-length;content-type;x-amz-content-sha256;x-amz-date,Signature=3b5a6dd6af44de292c989ca7a9c09db24fecfb107c27dc63f063588bf6a53568',
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
            'POST\n/this-is-a-test.png\nHello%20World=jkl&abc=def&zyx=123\nabc:def\ncontent-length:123\ncontent-type:image/png\nx-amz-date:20211221T000000Z\n\nabc;content-length;content-type;x-amz-date\npayload-hash'
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
            'POST\n/this-is-a-test.png\nHello%20World=jkl&abc=def&zyx=123\nabc:def\ncontent-length:123\ncontent-type:image/png\nx-amz-date:20211221T000000Z\n\nabc;content-length;content-type;x-amz-date\nmy-payload-hash'
        );
    });

    // See https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
    it('should match the AWS example', () => {
        const canonicalRequest = createCanonicalRequest({
            method: 'GET',
            uri: '/',
            headers: {
                host: 'iam.amazonaws.com',
                'content-type':
                    'application/x-www-form-urlencoded; charset=utf-8',
                'x-amz-date': '20150830T123600Z',
            },
            queryString: {
                Action: 'ListUsers',
                Version: '2010-05-08',
            },
            payloadSha256Hex:
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        });

        expect(canonicalRequest).toEqual(
            'GET\n/\nAction=ListUsers&Version=2010-05-08\ncontent-type:application/x-www-form-urlencoded; charset=utf-8\nhost:iam.amazonaws.com\nx-amz-date:20150830T123600Z\n\ncontent-type;host;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
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
            'AWS4-HMAC-SHA256\n20211221T000000Z\n20211221/us-east-1/s3/aws4_request\n6a59bd032580904de4368be2e4ce0d129ffacee38a3a5439638967d943face10'
        );
    });

    // See https://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html
    it('should match the AWS example', () => {
        const canonicalRequest = createCanonicalRequest({
            method: 'GET',
            uri: '/',
            headers: {
                host: 'iam.amazonaws.com',
                'content-type':
                    'application/x-www-form-urlencoded; charset=utf-8',
                'x-amz-date': '20150830T123600Z',
            },
            queryString: {
                Action: 'ListUsers',
                Version: '2010-05-08',
            },
            payloadSha256Hex:
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        });

        const date = new Date('2015-08-30T12:36:00.000Z');
        const result = createStringToSign(
            canonicalRequest,
            date,
            'us-east-1',
            'iam'
        );

        expect(result).toEqual(
            'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/iam/aws4_request\nf536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59'
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
            '2a1d38ddff74996fca49509c2376efc4e13d0fe4cf3575d3e743c3313e9a8e6d'
        );
    });

    // See https://docs.aws.amazon.com/general/latest/gr/sigv4-calculate-signature.html
    it('should match the AWS example', () => {
        const stringToSign =
            'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/iam/aws4_request\nf536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59';
        const date = new Date(2015, 7, 30, 12, 6, 0);
        expect(
            createAWS4Signature(
                stringToSign,
                'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
                date,
                'us-east-1',
                'iam'
            )
        ).toEqual(
            '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7'
        );
    });
});

describe('createSigningKey()', () => {
    // See https://docs.aws.amazon.com/general/latest/gr/sigv4-calculate-signature.html
    it('should match the AWS example', () => {
        const date = new Date(2015, 7, 30);
        expect(
            createSigningKey(
                'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
                date,
                'us-east-1',
                'iam',
                'hex'
            )
        ).toEqual(
            'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9'
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
