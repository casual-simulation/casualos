import { fromByteArray, toByteArray } from 'base64-js';
import _, { padStart, sortBy, StringChain } from 'lodash';
import { sha256, hmac } from 'hash.js';

/**
 * Converts the given string into a base64 string.
 * @param str The string to convert.
 */
export function toBase64String(str: string): string {
    const encoder = new TextEncoder();
    const array = encoder.encode(str);
    return fromByteArray(array);
}

/**
 * Converts the given string from a base64 string.
 * @param base64
 */
export function fromBase64String(base64: string): string {
    const decoder = new TextDecoder();
    const array = toByteArray(base64);
    return decoder.decode(array);
}

/**
 * Signs the given request and adds the related headers to it.
 * @param request The request to sign.
 * @param secretAccessKey The secret access key to use.
 * @param accessKeyId The ID of the access key that is being used.
 * @param date The date to use for signing.
 * @param region The AWS region.
 * @param service The AWS service.
 */
export function signRequest(
    request: CanonicalRequest,
    secretAccessKey: string,
    accessKeyId: string,
    date: Date,
    region: string,
    service: string
): CanonicalRequest {
    const hash = request.payloadSha256Hex.toLowerCase();
    request = {
        ...request,
        headers: {
            ...request.headers,
            'x-amz-date': getAmzDateString(date),
            'x-amz-content-sha256': hash,
        },
    };

    let canonicalRequest = createCanonicalRequest(request);
    let stringToSign = createStringToSign(
        canonicalRequest,
        date,
        region,
        service
    );
    let signature = createAWS4Signature(
        stringToSign,
        secretAccessKey,
        date,
        region,
        service
    );

    let credential = `${accessKeyId}/${getDateString(
        date
    )}/${region}/${service}/aws4_request`;
    let signedHeaders = Object.keys(request.headers)
        .map((header) => header.toLowerCase())
        .sort()
        .join(';');

    let authorization = `AWS4-HMAC-SHA256 Credential=${credential},SignedHeaders=${signedHeaders},Signature=${signature}`;

    let result: CanonicalRequest = {
        method: request.method,
        path: request.path,
        queryString: { ...request.queryString },
        headers: {
            ...request.headers,
            Authorization: authorization,
        },
        payloadSha256Hex: hash,
    };

    return result;
}

/**
 * Constructs a string that can be signed from the given request, date, AWS region, and AWS Service.
 * @param canonicalRequest The canonical request to include.
 * @param date The date that the signature is happening on.
 * @param region The region that the signature is for.
 * @param service The service that the signature is for.
 */
export function createStringToSign(
    canonicalRequest: string,
    date: Date,
    region: string,
    service: string
): string {
    const isoDate = getDateString(date);
    const isoDateTime = getAmzDateString(date);

    const sha = sha256();
    sha.update(canonicalRequest);
    const canonicalRequestHash = sha.digest('hex');

    return `AWS4-HMAC-SHA256\n${isoDateTime}\n${isoDate}/${region}/${service}/aws4_request\n${canonicalRequestHash}`;
}

/**
 * Creates a signature using the given secret access key and additional info.
 * @param stringToSign The string that should be signed.
 * @param secretAccessKey The secret access key.
 * @param date The date that the signature is happening on.
 * @param region The AWS region.
 * @param service The AWS Service.
 */
export function createAWS4Signature(
    stringToSign: string,
    secretAccessKey: string,
    date: Date,
    region: string,
    service: string
): string {
    const final = createHmac(
        createSigningKey(secretAccessKey, date, region, service),
        stringToSign,
        'hex'
    );
    return final;
}

export function createSigningKey(
    secretAccessKey: string,
    date: Date,
    region: string,
    service: string,
    enc?: 'hex'
) {
    const dateString =
        date.getUTCFullYear() +
        padStart((1 + date.getUTCMonth()).toString(), 2, '0') +
        padStart(date.getUTCDate().toString(), 2, '0');
    const dateKey = createHmac('AWS4' + secretAccessKey, dateString);
    const dateRegionKey = createHmac(dateKey, region);
    const dateRegionServiceKey = createHmac(dateRegionKey, service);
    const signingKey = createHmac(dateRegionServiceKey, 'aws4_request', enc);

    return signingKey;
}

function createHmac(key: string | number[], data: string): number[];
function createHmac(key: string | number[], data: string, enc: 'hex'): string;
function createHmac(key: string | number[], data: string, enc?: 'hex') {
    const hmacSha256 = hmac(<any>sha256, key);
    hmacSha256.update(data);

    if (enc) {
        return hmacSha256.digest(enc);
    } else {
        return hmacSha256.digest();
    }
}

/**
 * Creates a canonical request string that can be used to create a AWS Signature for the given request.
 *
 * See https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 * @param request The request to create the canonical request for.
 */
export function createCanonicalRequest(request: CanonicalRequest): string {
    let str = '';

    str += request.method + '\n';
    str += canonicalUriEncode(request.path, false) + '\n';

    let queryStringParams = Object.keys(request.queryString).map((name) => [
        name,
        canonicalUriEncode(name, true),
    ]);
    queryStringParams = sortBy(
        queryStringParams,
        ([name, encodedName]) => encodedName
    );
    let i = 0;
    for (let [name, encodedName] of queryStringParams) {
        let value = request.queryString[name];
        str += encodedName + '=' + canonicalUriEncode(value, true);
        if (i < queryStringParams.length - 1) {
            str += '&';
        }
        i++;
    }
    str += '\n';

    let headerNames = Object.keys(request.headers).map((name) => [
        name,
        name.toLowerCase(),
    ]);
    headerNames = sortBy(headerNames, ([name, encodedName]) => encodedName);
    i = 0;
    for (let [name, encodedName] of headerNames) {
        let value = request.headers[name];
        str += encodedName + ':' + value.trim() + '\n';
        i++;
    }
    str += '\n';
    str +=
        headerNames.map(([name, encodedName]) => encodedName).join(';') + '\n';
    str += request.payloadSha256Hex.toLowerCase();

    return str;
}

export interface CanonicalRequest {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    headers: {
        [name: string]: string;
    };
    queryString: {
        [name: string]: string;
    };
    payloadSha256Hex: string;
}

const A = 'A'.charCodeAt(0);
const Z = 'Z'.charCodeAt(0);
const a = 'a'.charCodeAt(0);
const z = 'z'.charCodeAt(0);
const _0 = '0'.charCodeAt(0);
const _9 = '9'.charCodeAt(0);
const __ = '_'.charCodeAt(0);
const _dash = '-'.charCodeAt(0);
const _squiggle = '~'.charCodeAt(0);
const _dot = '.'.charCodeAt(0);
const _slash = '/'.charCodeAt(0);

/**
 * URI Encodes the given string according to AWS Signature Version 4.
 * See https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 * @param input The string to URI encode.
 * @param encodeSlash Whether to encode slashes as %2F.
 */
export function canonicalUriEncode(
    input: string,
    encodeSlash: boolean
): string {
    const textEncoder = new TextEncoder();
    const bytes = textEncoder.encode(input);
    const textDecoder = new TextDecoder();
    let result: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
        let ch = bytes[i];
        if (
            (ch >= A && ch <= Z) ||
            (ch >= a && ch <= z) ||
            (ch >= _0 && ch <= _9) ||
            ch == __ ||
            ch == _dash ||
            ch == _squiggle ||
            ch == _dot
        ) {
            result.push(ch);
        } else if (ch === _slash) {
            if (encodeSlash) {
                result.push(...textEncoder.encode('%2F'));
            } else {
                result.push(ch);
            }
        } else {
            result.push(...textEncoder.encode(encodeHexUtf8(ch)));
        }
    }
    const buffer = new Uint8Array(result);
    return textDecoder.decode(buffer);
}

/**
 * Encodes the given character code as a URI hex string.
 * @param char The character to encode.
 */
export function encodeHexUtf8(char: number): string {
    const hex = char.toString(16).toUpperCase();
    return '%' + (hex.length === 1 ? '0' + hex : hex);
}

function getDateString(date: Date): string {
    return (
        date.getUTCFullYear() +
        padStart((1 + date.getUTCMonth()).toString(), 2, '0') +
        padStart(date.getUTCDate().toString(), 2, '0')
    );
}

function getAmzDateString(date: Date): string {
    return (
        getDateString(date) +
        'T' +
        padStart(date.getUTCHours().toString(), 2, '0') +
        padStart(date.getUTCMinutes().toString(), 2, '0') +
        padStart(date.getUTCSeconds().toString(), 2, '0') +
        'Z'
    );
}
