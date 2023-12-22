import { fromByteArray, toByteArray } from 'base64-js';
import _, { omitBy, padStart, sortBy, StringChain } from 'lodash';
import { sha256, hmac } from 'hash.js';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import axios from 'axios';

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

/**
 * Parses the given string of instance names into an array of instance names.
 * @param instances The names of the instances.
 */
export function parseInstancesList(instances: string): string[] {
    if (!instances) {
        return undefined;
    }
    return instances
        .split(',')
        .map((instance) => instance.trim())
        .filter((i) => !!i);
}

export type KnownErrorCodes =
    | 'not_logged_in'
    | 'not_supported'
    | 'data_not_found'
    | 'data_too_large'
    | 'record_not_found'
    | 'file_not_found'
    | 'session_not_found'
    | 'operation_not_found'
    | 'studio_not_found'
    | 'user_not_found'
    | 'inst_not_found'
    | 'session_already_revoked'
    | 'invalid_code'
    | 'invalid_key'
    | 'invalid_request'
    | 'invalid_origin'
    | 'invalid_record_key'
    | 'session_expired'
    | 'unacceptable_address'
    | 'unacceptable_user_id'
    | 'unacceptable_code'
    | 'unacceptable_session_key'
    | 'unacceptable_session_id'
    | 'unacceptable_request_id'
    | 'unacceptable_ip_address'
    | 'unacceptable_address_type'
    | 'unacceptable_expire_time'
    | 'unacceptable_request'
    | 'unacceptable_update'
    | 'address_type_not_supported'
    | 'server_error'
    | 'unauthorized_to_create_record_key'
    | 'price_does_not_match'
    | 'user_is_banned'
    | 'rate_limit_exceeded'
    | 'not_authorized'
    | 'not_subscribed'
    | 'invalid_subscription_tier'
    | 'subscription_limit_reached'
    | 'record_already_exists'
    | 'action_not_supported'
    | 'no_session_key'
    | 'unacceptable_studio_id'
    | 'email_already_exists'
    | 'parent_email_already_exists'
    | 'parent_email_required'
    | 'invalid_room_name'
    | 'invalid_username'
    | 'invalid_update_policy'
    | 'invalid_delete_policy'
    | 'unacceptable_url'
    | 'file_already_exists'
    | 'invalid_file_data'
    | 'invalid_model'
    | 'roles_too_large'
    | 'policy_not_found'
    | 'policy_too_large'
    | 'invalid_policy'
    | 'not_completed'
    | 'invalid_display_name';

/**
 * Gets the status code that should be used for the given response.
 * @param response The response.
 */
export function getStatusCode(
    response: { success: false; errorCode: KnownErrorCodes } | { success: true }
) {
    if (response.success === false) {
        if (response.errorCode === 'not_logged_in') {
            return 401;
        } else if (response.errorCode === 'not_supported') {
            return 501;
        } else if (response.errorCode === 'data_not_found') {
            return 404;
        } else if (response.errorCode === 'data_too_large') {
            return 400;
        } else if (response.errorCode === 'record_not_found') {
            return 404;
        } else if (response.errorCode === 'file_not_found') {
            return 404;
        } else if (response.errorCode === 'session_not_found') {
            return 404;
        } else if (response.errorCode === 'operation_not_found') {
            return 404;
        } else if (response.errorCode === 'studio_not_found') {
            return 404;
        } else if (response.errorCode === 'user_not_found') {
            return 404;
        } else if (response.errorCode === 'session_already_revoked') {
            return 200;
        } else if (response.errorCode === 'invalid_code') {
            return 403;
        } else if (response.errorCode === 'invalid_key') {
            return 403;
        } else if (response.errorCode === 'invalid_record_key') {
            return 403;
        } else if (response.errorCode === 'invalid_request') {
            return 403;
        } else if (response.errorCode === 'invalid_origin') {
            return 403;
        } else if (response.errorCode === 'session_expired') {
            return 401;
        } else if (response.errorCode === 'unacceptable_address') {
            return 400;
        } else if (response.errorCode === 'unacceptable_user_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_code') {
            return 400;
        } else if (response.errorCode === 'unacceptable_session_key') {
            return 400;
        } else if (response.errorCode === 'unacceptable_session_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_request_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_ip_address') {
            return 500;
        } else if (response.errorCode === 'unacceptable_address_type') {
            return 400;
        } else if (response.errorCode === 'unacceptable_expire_time') {
            return 400;
        } else if (response.errorCode === 'unacceptable_request') {
            return 400;
        } else if (response.errorCode === 'address_type_not_supported') {
            return 501;
        } else if (response.errorCode === 'server_error') {
            return 500;
        } else if (response.errorCode === 'unauthorized_to_create_record_key') {
            return 403;
        } else if (response.errorCode === 'price_does_not_match') {
            return 412;
        } else if (response.errorCode === 'user_is_banned') {
            return 403;
        } else if (response.errorCode === 'rate_limit_exceeded') {
            return 429;
        } else if (response.errorCode === 'not_authorized') {
            return 403;
        } else if (response.errorCode === 'not_subscribed') {
            return 403;
        } else if (response.errorCode === 'invalid_subscription_tier') {
            return 403;
        } else if (response.errorCode === 'record_already_exists') {
            return 403;
        } else if (response.errorCode === 'subscription_limit_reached') {
            return 403;
        } else if (response.errorCode === 'inst_not_found') {
            return 404;
        } else if (response.errorCode === 'action_not_supported') {
            return 500;
        } else if (response.errorCode === 'policy_not_found') {
            return 404;
        } else {
            return 400;
        }
    }

    return 200;
}

/**
 * Clones the given object into a new object that only has non-null and not-undefined properties.
 * @param obj The object to cleanup.
 */
export function cleanupObject<T extends Object>(obj: T): Partial<T> {
    return omitBy(
        obj,
        (o) => typeof o === 'undefined' || o === null
    ) as Partial<T>;
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
 */
export function isActiveSubscription(status: string): boolean {
    return status === 'active' || status === 'trialing';
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
 * Handles axios errors and ensures they get logged properly.
 * @param err The error.
 */
export function handleAxiosErrors(err: any) {
    if (axios.isAxiosError(err)) {
        console.error(
            'An axios error occcurred:',
            '\nStatus:',
            err.response.status,
            '\nHeaders:',
            err.response.headers,
            '\nData:',
            err.response.data,
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
