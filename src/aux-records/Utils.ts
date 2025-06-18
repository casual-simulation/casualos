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
import { cloneDeep, omitBy, padStart, sortBy } from 'lodash';
import { sha256, hmac } from 'hash.js';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import axios from 'axios';
import type { ArrayOfKASP, ISO4217_Map } from './TypeUtils';

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
function createHmac(key: string | number[], data: string, enc?: 'hex'): string;
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
const _percent = '%'.charCodeAt(0);

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
    let warned = false;
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
            if (ch === _percent && !warned) {
                warned = true;
                console.warn(
                    '[canonicalUriEncode] Percent sign found in string to encode. This may be the result of double encoding, which would cause signatures to fail if it is the case.'
                );
            }
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

export const iSO4217_AlphaArray: (keyof ISO4217_Map)[] = [
    'AED',
    'AFN',
    'ALL',
    'AMD',
    'ANG',
    'AOA',
    'ARS',
    'AUD',
    'AWG',
    'AZN',
    'BAM',
    'BBD',
    'BDT',
    'BGN',
    'BHD',
    'BIF',
    'BMD',
    'BND',
    'BOB',
    'BOV',
    'BRL',
    'BSD',
    'BTN',
    'BWP',
    'BYN',
    'BZD',
    'CAD',
    'CDF',
    'CHE',
    'CHF',
    'CHW',
    'CLF',
    'CLP',
    'CNY',
    'COP',
    'COU',
    'CRC',
    'CUC',
    'CUP',
    'CVE',
    'CZK',
    'DJF',
    'DKK',
    'DOP',
    'DZD',
    'EGP',
    'ERN',
    'ETB',
    'EUR',
    'FJD',
    'FKP',
    'GBP',
    'GEL',
    'GHS',
    'GIP',
    'GMD',
    'GNF',
    'GTQ',
    'GYD',
    'HKD',
    'HNL',
    'HTG',
    'HUF',
    'IDR',
    'ILS',
    'INR',
    'IQD',
    'IRR',
    'ISK',
    'JMD',
    'JOD',
    'JPY',
    'KES',
    'KGS',
    'KHR',
    'KMF',
    'KPW',
    'KRW',
    'KWD',
    'KYD',
    'KZT',
    'LAK',
    'LBP',
    'LKR',
    'LRD',
    'LSL',
    'LYD',
    'MAD',
    'MDL',
    'MGA',
    'MKD',
    'MMK',
    'MNT',
    'MOP',
    'MRU',
    'MUR',
    'MVR',
    'MWK',
    'MXN',
    'MXV',
    'MYR',
    'MZN',
    'NAD',
    'NGN',
    'NIO',
    'NOK',
    'NPR',
    'NZD',
    'OMR',
    'PAB',
    'PEN',
    'PGK',
    'PHP',
    'PKR',
    'PLN',
    'PYG',
    'QAR',
    'RON',
    'RSD',
    'RUB',
    'RWF',
    'SAR',
    'SBD',
    'SCR',
    'SDG',
    'SEK',
    'SGD',
    'SHP',
    'SLE',
    'SOS',
    'SRD',
    'SSP',
    'STN',
    'SVC',
    'SYP',
    'SZL',
    'THB',
    'TJS',
    'TMT',
    'TND',
    'TOP',
    'TRY',
    'TTD',
    'TWD',
    'TZS',
    'UAH',
    'UGX',
    'USD',
    'USN',
    'UYI',
    'UYU',
    'UYW',
    'UZS',
    'VED',
    'VES',
    'VND',
    'VUV',
    'WST',
    'XAF',
    'XAG',
    'XAU',
    'XBA',
    'XBB',
    'XBC',
    'XBD',
    'XCD',
    'XDR',
    'XOF',
    'XPD',
    'XPF',
    'XPT',
    'XSU',
    'XTS',
    'XUA',
    'XXX',
    'YER',
    'ZAR',
    'ZMW',
    'ZWG',
    'ZWL',
];

const ISO4217_Map: ArrayOfKASP<ISO4217_Map, ['n', 'mU']> = [
    ['AED', 784, 2],
    ['AFN', 971, 2],
    ['ALL', 8, 2],
    ['AMD', 51, 2],
    ['ANG', 532, 2],
    ['AOA', 973, 2],
    ['ARS', 32, 2],
    ['AUD', 36, 2],
    ['AWG', 533, 2],
    ['AZN', 944, 2],
    ['BAM', 977, 2],
    ['BBD', 52, 2],
    ['BDT', 50, 2],
    ['BGN', 975, 2],
    ['BHD', 48, 3],
    ['BIF', 108, 0],
    ['BMD', 60, 2],
    ['BND', 96, 2],
    ['BOB', 68, 2],
    ['BOV', 984, 2],
    ['BRL', 986, 2],
    ['BSD', 44, 2],
    ['BTN', 64, 2],
    ['BWP', 72, 2],
    ['BYN', 933, 2],
    ['BZD', 84, 2],
    ['CAD', 124, 2],
    ['CDF', 976, 2],
    ['CHE', 947, 2],
    ['CHF', 756, 2],
    ['CHW', 948, 2],
    ['CLF', 990, 4],
    ['CLP', 152, 0],
    ['CNY', 156, 2],
    ['COP', 170, 2],
    ['COU', 970, 2],
    ['CRC', 188, 2],
    ['CUC', 931, 2],
    ['CUP', 192, 2],
    ['CVE', 132, 2],
    ['CZK', 203, 2],
    ['DJF', 262, 0],
    ['DKK', 208, 2],
    ['DOP', 214, 2],
    ['DZD', 12, 2],
    ['EGP', 818, 2],
    ['ERN', 232, 2],
    ['ETB', 230, 2],
    ['EUR', 978, 2],
    ['FJD', 242, 2],
    ['FKP', 238, 2],
    ['GBP', 826, 2],
    ['GEL', 981, 2],
    ['GHS', 936, 2],
    ['GIP', 292, 2],
    ['GMD', 270, 2],
    ['GNF', 324, 0],
    ['GTQ', 320, 2],
    ['GYD', 328, 2],
    ['HKD', 344, 2],
    ['HNL', 340, 2],
    ['HTG', 332, 2],
    ['HUF', 348, 2],
    ['IDR', 360, 2],
    ['ILS', 376, 2],
    ['INR', 356, 2],
    ['IQD', 368, 3],
    ['IRR', 364, 2],
    ['ISK', 352, 0],
    ['JMD', 388, 2],
    ['JOD', 400, 3],
    ['JPY', 392, 0],
    ['KES', 404, 2],
    ['KGS', 417, 2],
    ['KHR', 116, 2],
    ['KMF', 174, 0],
    ['KPW', 408, 2],
    ['KRW', 410, 0],
    ['KWD', 414, 3],
    ['KYD', 136, 2],
    ['KZT', 398, 2],
    ['LAK', 418, 2],
    ['LBP', 422, 2],
    ['LKR', 144, 2],
    ['LRD', 430, 2],
    ['LSL', 426, 2],
    ['LYD', 434, 3],
    ['MAD', 504, 2],
    ['MDL', 498, 2],
    ['MGA', 969, 2],
    ['MKD', 807, 2],
    ['MMK', 104, 2],
    ['MNT', 496, 2],
    ['MOP', 446, 2],
    ['MRU', 929, 2],
    ['MUR', 480, 2],
    ['MVR', 462, 2],
    ['MWK', 454, 2],
    ['MXN', 484, 2],
    ['MXV', 979, 2],
    ['MYR', 458, 2],
    ['MZN', 943, 2],
    ['NAD', 516, 2],
    ['NGN', 566, 2],
    ['NIO', 558, 2],
    ['NOK', 578, 2],
    ['NPR', 524, 2],
    ['NZD', 554, 2],
    ['OMR', 512, 3],
    ['PAB', 590, 2],
    ['PEN', 604, 2],
    ['PGK', 598, 2],
    ['PHP', 608, 2],
    ['PKR', 586, 2],
    ['PLN', 985, 2],
    ['PYG', 600, 0],
    ['QAR', 634, 2],
    ['RON', 946, 2],
    ['RSD', 941, 2],
    ['RUB', 643, 2],
    ['RWF', 646, 0],
    ['SAR', 682, 2],
    ['SBD', 90, 2],
    ['SCR', 690, 2],
    ['SDG', 938, 2],
    ['SEK', 752, 2],
    ['SGD', 702, 2],
    ['SHP', 654, 2],
    ['SLE', 925, 2],
    ['SOS', 706, 2],
    ['SRD', 968, 2],
    ['SSP', 728, 2],
    ['STN', 930, 2],
    ['SVC', 222, 2],
    ['SYP', 760, 2],
    ['SZL', 748, 2],
    ['THB', 764, 2],
    ['TJS', 972, 2],
    ['TMT', 934, 2],
    ['TND', 788, 3],
    ['TOP', 776, 2],
    ['TRY', 949, 2],
    ['TTD', 780, 2],
    ['TWD', 901, 2],
    ['TZS', 834, 2],
    ['UAH', 980, 2],
    ['UGX', 800, 0],
    ['USD', 840, 2],
    ['USN', 997, 2],
    ['UYI', 940, 0],
    ['UYU', 858, 2],
    ['UYW', 927, 4],
    ['UZS', 860, 2],
    ['VED', 926, 2],
    ['VES', 928, 2],
    ['VND', 704, 0],
    ['VUV', 548, 0],
    ['WST', 882, 2],
    ['XAF', 950, 0],
    ['XAG', 961, null],
    ['XAU', 959, null],
    ['XBA', 955, null],
    ['XBB', 956, null],
    ['XBC', 957, null],
    ['XBD', 958, null],
    ['XCD', 951, 2],
    ['XDR', 960, null],
    ['XOF', 952, 0],
    ['XPD', 964, null],
    ['XPF', 953, 0],
    ['XPT', 962, null],
    ['XSU', 994, null],
    ['XTS', 963, null],
    ['XUA', 965, null],
    ['XXX', 999, null],
    ['YER', 886, 2],
    ['ZAR', 710, 2],
    ['ZMW', 967, 2],
    ['ZWG', 924, 2],
    ['ZWL', 932, 2],
];

/**
 * Gets the ISO 4217 currency meta for the given currency name
 * or numeric code
 * @important
 * ! Be sure to validate that the implementing service supports
 * ! the currency as well as the minor unit count (if applicable)
 * @param query The currency name or numeric code
 */
export function getISO4217CurrencyCode(
    query: keyof ISO4217_Map | ISO4217_Map[keyof ISO4217_Map]['n']
): [
    keyof ISO4217_Map,
    ISO4217_Map[keyof ISO4217_Map]['n'],
    ISO4217_Map[keyof ISO4217_Map]['mU']
] {
    return ISO4217_Map.find(
        (v) => v[typeof query == 'string' ? 0 : 1] === query
    );
}

/**
 * Parses the given string of instance names into an array of instance names.
 * @param instances The names of the instances.
 */
export function parseInstancesList(instances: string): string[] | undefined {
    if (!instances) {
        return undefined;
    }
    return instances
        .split(',')
        .map((instance) => instance.trim())
        .filter((i) => !!i);
}

/**
 * Clones the given object into a new object that only has non-null and not-undefined properties.
 * @param obj The object to cleanup.
 */
export function cleanupObject<T extends object>(obj: T): Partial<T> {
    return omitBy(
        obj,
        (o) => typeof o === 'undefined' || o === null
    ) as Partial<T>;
}

// /**
//  * Deep clones and concurrently freezes within the same iteration the provided object (record/array).
//  * @param obj The object to clone and freeze recursively.
//  */
// export function deepCloneFreeze<T extends Record<string, any> | Array<any>>(
//     obj: T
// ): Readonly<T> {
//     const returnObj = (Array.isArray(obj) ? [] : {}) as T;
//     for (const key in obj) {
//         if (obj.hasOwnProperty(key)) {
//             const value = obj[key];
//             if (
//                 typeof value === 'object' &&
//                 value !== null &&
//                 !(value instanceof Date)
//             ) {
//                 returnObj[key] = deepCloneFreeze(value) as T[Extract<
//                     keyof T,
//                     string
//                 >];
//             } else {
//                 returnObj[key] = value;
//             }
//         }
//     }
//     return Object.freeze(returnObj);
// }

// /**
//  * Provides a function that can be used to build a paginate/effect function for the given array.
//  * @param arr The array to paginate.
//  * @param effectEach A function used within map to effect each element.
//  * @returns
//  */
// export function paginationProviderOf<T, E>(
//     arr: T[],
//     effectEach?: (item: T) => PromiseOrValue<E>
// ) {
//     return async (limit: number, offset: number) => {
//         const content = arr.slice(offset, offset + limit);
//         if (!effectEach || content.length < 1) return [];
//         return await Promise.all(content.map((X) => effectEach(X)));
//     };
// }

// ! Implementation is WIP
// /**
//  * Generates a custom asymmetric matcher used by jest.
//  * * (Similar to expect.any)
//  * @param asymmetricMatcher The function to run on the value to indicate whether or not its as expected
//  * @param toString The string provider of the expected values state/type
//  * @param getExpectedType The string provider of the expected values type(s)
//  */
// export function jestCustomAsymmetricMatcher(
//     asymmetricMatcher: (value: any) => boolean,
//     toAsymmetricMatcher: () => string,
//     toString?: () => string,
//     getExpectedType?: () => string
// ) {
//     return {
//         $$typeof: Symbol.for('jest.asymmetricMatcher'),
//         asymmetricMatcher,
//         toAsymmetricMatcher,
//         toString,
//         getExpectedType,
//     };
// }

/**
 * A function which returns true if param val is found to be type / instance of any specified in param constructorArray
 * @param val The value whose type / instance to check the presence of in constructorArray
 * @param constructorArray The array which contains the allowed types / instances for parameter val
 */
export function isOfXType<T>(
    val: T,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    constructorArray: Array<Function | undefined | null>
): boolean {
    return constructorArray.some((constructor) => {
        return constructor === String ||
            constructor === Number ||
            constructor === Boolean ||
            constructor === Symbol ||
            constructor === BigInt ||
            constructor === undefined
            ? typeof val === (constructor?.name?.toLowerCase() ?? 'undefined')
            : constructor === null
            ? val === null
            : val instanceof constructor;
    });
}

/**
 * Clones the given record or returns null if the record is undefined.
 * @param record The record to clone.
 */
export function cloneDeepNull<T extends Record<keyof any, any>>(
    record: T | undefined
) {
    return record ? cloneDeep(record) : null;
}

/**
 * Tries to parse the given JSON string into a JavaScript Value.
 * @param json The JSON to parse.
 */
export function tryParseJson(json: string): JsonParseResult {
    try {
        return {
            success: true,
            value: JSON.parse(json),
        };
    } catch (err) {
        return {
            success: false,
            error: err,
        };
    }
}

interface ScopedErrorConfig {
    /** The scope of the function. E.g. [ClassName, FunctionName] */
    scope: Array<string> | string;
    /** The message to log if an error occurs. */
    errMsg: string;
}

export function scopedError(errConfig: ScopedErrorConfig, err: string) {
    console.error(
        Array.isArray(errConfig.scope)
            ? errConfig.scope.map((s) => `[${s}]`).join(' ')
            : `[${errConfig.scope}]`,
        errConfig.errMsg,
        err
    );
}

interface ScopedTryConfig<E> extends ScopedErrorConfig {
    /** The value to return if an error occurs. */
    returnOnError?: E;
}

/**
 * Attempts to run the given function and logs an error if it fails with a standard error format which includes the scope and message.
 * @param fn The function to run.
 * @param errConfig The configuration for proper logging and return value if an error occurs.
 */
export async function tryScope<T, E>(
    fn: () => T,
    errConfig: ScopedTryConfig<E>
): Promise<T | E> {
    try {
        return await fn();
    } catch (err) {
        scopedError(errConfig, err);
        return errConfig.returnOnError;
    }
}

export type JsonParseResult = JsonParseSuccess | JsonParseFailure;

export interface JsonParseSuccess {
    success: true;
    value: any;
}

export interface JsonParseFailure {
    success: false;
    error: Error;
}

export interface RegexRule {
    type: 'allow' | 'deny';
    pattern: string;
}

/**
 * Determines if the given value matches the given list of rules.
 * @param value The value to test.
 * @param rules The rules that the value should be tested against.
 */
export function isStringValid(value: string, rules: RegexRule[]) {
    if (rules.length <= 0) {
        return true;
    }

    const regexRules = rules.map((r) => ({
        type: r.type,
        pattern: new RegExp(r.pattern, 'i'),
    }));

    let good = false;
    for (let rule of regexRules) {
        if (rule.type === 'allow') {
            if (rule.pattern.test(value)) {
                good = true;
                break;
            }
        } else if (rule.type === 'deny') {
            if (rule.pattern.test(value)) {
                good = false;
                break;
            }
        }
    }

    return good;
}

/**
 * Attempts to decode the given URI component. Returns null if unable to be decoded.
 * @param component The component to decode.
 * @returns
 */
export function tryDecodeUriComponent(component: string): string | null {
    try {
        return decodeURIComponent(component);
    } catch (err) {
        return null;
    }
}

/**
 * Determines whether the given subscription status should be treated as an active subscription.
 * @param status The status.
 * @param periodStartMs The start of the subscription period in unix time in miliseconds. If omitted, then the period won't be checked.
 * @param periodEndMs The end of the subscription period in unix time in miliseconds. If omitted, then the period won't be checked.
 * @param nowMs The current time in unix time in miliseconds.
 */
export function isActiveSubscription(
    status: string,
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
): boolean {
    const active = status === 'active' || status === 'trialing';
    if (active && periodStartMs && periodEndMs) {
        return nowMs >= periodStartMs && nowMs <= periodEndMs;
    }
    return active;
}

/**
 * Gets the list of root markers that should be used, or the default list if none are provided.
 * @param markers
 */
export function getRootMarkersOrDefault(markers: string[] | null): string[] {
    if (markers === null || markers === undefined || markers.length <= 0) {
        return [PUBLIC_READ_MARKER];
    }

    return markers.map(getRootMarker);
}

/**
 * Gets the list of markers that should be used, or the default list if none are provided.
 * @param markers
 */
export function getMarkersOrDefault(markers: string[] | null): string[] {
    if (markers === null || markers === undefined || markers.length <= 0) {
        return [PUBLIC_READ_MARKER];
    }

    return markers;
}

/**
 * Gets the root marker from the given marker.
 * Markers have two parts, the root and the path: "root:path".
 * The root is the first part of the marker, and contains the security name of the marker. That is, the name of the marker that is used to retrieve permissions for the marker.
 * The path is the second part of the marker, and contains the path that the marker is for. That is, extra information that can be used to organize marker data.
 * @param marker The marker that should be parsed.
 */
export function getRootMarker(marker: string): string {
    if (!marker) {
        return marker;
    }

    const indexOfColon = marker.indexOf(':');
    if (indexOfColon < 0) {
        return marker;
    }
    return marker.substring(0, indexOfColon);
}

/**
 * Gets the path marker from the given marker.
 * Markers have two parts, the root and the path: "root:path".
 * The root is the first part of the marker, and contains the security name of the marker. That is, the name of the marker that is used to retrieve permissions for the marker.
 * The path is the second part of the marker, and contains the path that the marker is for. That is, extra information that can be used to organize marker data.
 *
 * Returns an empty string if the marker does not contain a path.
 * @param marker The marker that should be parsed.
 */
export function getPathMarker(marker: string): string {
    if (!marker) {
        return '';
    }

    const indexOfColon = marker.indexOf(':');
    if (indexOfColon < 0) {
        return '';
    }
    return marker.substring(indexOfColon + 1);
}

/**
 * Handles axios errors and ensures they get logged properly.
 * @param err The error.
 */
export function handleAxiosErrors(err: any) {
    if (axios.isAxiosError(err)) {
        console.error(
            'An axios error occcurred:',
            '\nStatus:',
            err.response?.status,
            '\nHeaders:',
            err.response?.headers,
            '\nData:',
            err.response?.data,
            '\nRequest:',
            err.request
        );
        throw new Error('An axios error occurred: ' + err.message);
    } else {
        throw err;
    }
}

/**
 * Calculates the number of bytes contained in the given string encoded to utf-8.
 * @param str The string.
 */
export function byteLengthOfString(str: string): number {
    if (typeof Buffer !== 'undefined') {
        return Buffer.byteLength(str, 'utf8');
    }
    return new Blob([str], { type: 'text/plain' }).size;
}
