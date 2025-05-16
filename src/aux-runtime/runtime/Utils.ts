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
import { RealtimeEditMode } from './RuntimeBot';
import type { AuxPartitionRealtimeStrategy } from '@casual-simulation/aux-common/partitions/AuxPartition';

import '@casual-simulation/aux-common/BlobPolyfill';

export function realtimeStrategyToRealtimeEditMode(
    strategy: AuxPartitionRealtimeStrategy
): RealtimeEditMode {
    return strategy === 'immediate'
        ? RealtimeEditMode.Immediate
        : RealtimeEditMode.Delayed;
}

/**
 * Embeds the given base64 string into a PDF document that references CasualOS.
 * @param str The base64 string to embed.
 */
export function embedBase64InPdf(str: string): string {
    return `%PDF-1.3
%����

1 0 obj
<<
/Type /Catalog
/Outlines 2 0 R
/Pages 3 0 R
>>
endobj

2 0 obj
<<
/Type /Outlines
/Count 0
>>
endobj

3 0 obj
<<
/Type /Pages
/Count 1
/Kids [ 4 0 R ] 
>>
endobj

4 0 obj
<<
/Type /Page
/Parent 3 0 R
/Resources <<
/Font <<
/F1 9 0 R 
>>
/ProcSet 8 0 R
>>
/MediaBox [0 0 512 512]
/Annots [ 25 0 R ]
/Contents 5 0 R
>>
endobj

5 0 obj
<< /Length 1074 >>
stream
BT
/F1 28 Tf
183 412 Td
( CasualOS ) Tj
ET
BT
/F1 16 Tf
150 256 Td
( Open) Tj
ET
BT
0 0 1 rg
0 0 1 RG
/F1 16 Tf
193.25 256 Td
( https://casualos.com ) Tj
ET
endstream
endobj

8 0 obj
[/PDF /Text]
endobj

9 0 obj
<<
/Type /Font
/Subtype /Type1
/Name /F1
/BaseFont /Helvetica
/Encoding /WinAnsiEncoding
>>
endobj

10 0 obj
<<
/Creator (Casual Simulation)
/Producer (CasualOS)
/CreationDate (D:20210720000000)
>>
endobj

25 0 obj                                                % object ID 26 which is referenced by the OBJR in Object 11
<<
/Type /Annot
/Subtype /Link
/Border [0 0 0]                                       %a colorless border
/Rect [193.25 245 350 276]                              %the boundaries defining target area where link annotation is active
/A <</S /URI /URI (https://casualos.com)>>              % The action that the link should perform (Go to casualos.com)
>>
endobj

9999909 0 obj
 (${str})
endobj

xref
0 11
0000000000 65535 f
0000000019 00000 n
0000000093 00000 n
0000000147 00000 n
0000000222 00000 n
0000000390 00000 n
0000001522 00000 n
0000001690 00000 n
0000002423 00000 n
0000002456 00000 n
0000002574 00000 n

trailer
<<
/Size 11
/Root 1 0 R
/Info 10 0 R
>>

startxref
2714
%%EOF
`;
}

/**
 * Gets the Base64 data that was embedded in the given PDF document by embedBase64InPdf().
 */
export function getEmbeddedBase64FromPdf(pdf: string): string {
    const objStart = pdf.lastIndexOf('9999909 0 obj');

    if (objStart < 0) {
        return null;
    }

    const pdfFromObj = pdf.slice(objStart);
    const objEnd = pdfFromObj.indexOf('endobj');

    if (objEnd < 0) {
        return null;
    }

    const obj = pdfFromObj.slice(0, objEnd);
    const openParenthesis = obj.indexOf('(');
    const closeParenthesis = obj.indexOf(')');

    if (openParenthesis < 0 || closeParenthesis < 0) {
        return null;
    }

    const base64 = obj.slice(openParenthesis + 1, closeParenthesis);

    return base64;
}

/**
 * Formats the given token and service (bundle ID) into a string that can be used as an auth token for records requests.
 */
export function formatAuthToken(token: string, service: string): string {
    return `${token}.${service}`;
}

/**
 * Parses the given auth token into a token and service (bundle ID) pair.
 * The returned token is the token that was returned from the auth API and the service is the bundle ID of the app that requested it.
 */
export function parseAuthToken(token: string): [string, string] {
    const dotIndex = token.indexOf('.');
    if (dotIndex < 0) {
        return null;
    }
    const tokenWithoutService = token.slice(0, dotIndex);
    const service = token.slice(dotIndex + 1);
    return [tokenWithoutService, service];
}

/**
 * Constructs a Uint8Array from the given hexadecimal formatted string.
 * @param hex The hexadecimal string.
 */
export function fromHexString(hex: string) {
    const numBytes = hex.length / 2;
    const a = new Uint8Array(numBytes);

    hex = hex.toLowerCase();

    for (let i = 0; i < a.length; i++) {
        let char = i * 2;
        let char1 = hex.charCodeAt(char);
        let char2 = hex.charCodeAt(char + 1);

        let val = fromHexCode(char1) * 16 + fromHexCode(char2);
        a[i] = val;
    }

    return a;
}

/**
 * Constructs a hexidecimal formatted string from the given array of bytes.
 * @param bytes The bytes that should be hex formatted.
 */
export function toHexString(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
        let byte = bytes[i];
        let temp = byte.toString(16);
        if (temp.length < 2) {
            str += '0' + temp;
        } else {
            str += temp;
        }
    }

    return str;
}

const _0CharCode = '0'.charCodeAt(0);
const _9CharCode = '9'.charCodeAt(0);
const aCharCode = 'a'.charCodeAt(0);
const fCharCode = 'f'.charCodeAt(0);

function fromHexCode(code: number) {
    if (code >= _0CharCode && code <= _9CharCode) {
        return code - _0CharCode;
    } else if (code >= aCharCode && code <= fCharCode) {
        return code - aCharCode + 10;
    }

    throw new Error('Invalid hex code: ' + code);
}

/**
 * Determines if the given value represents a promise.
 * @param value The value to check.
 */
export function isPromise<T>(value: unknown): value is Promise<T> {
    return (
        typeof value === 'object' &&
        value !== null &&
        value instanceof Promise &&
        typeof (value as any).then === 'function' &&
        typeof (value as any).catch === 'function'
    );
}

export const RUNTIME_PROMISE = Symbol('RUNTIME_PROMISE');

export interface RuntimePromise<T> extends Promise<T> {
    [RUNTIME_PROMISE]: true;
}

export function isRuntimePromise<T>(
    value: unknown
): value is RuntimePromise<T> {
    return isPromise(value) && RUNTIME_PROMISE in value;
}

export function markAsRuntimePromise<T>(
    promise: Promise<T>
): RuntimePromise<T> {
    Object.defineProperty(promise, RUNTIME_PROMISE, {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });

    return promise as RuntimePromise<T>;
}

/**
 * Determines if the given string represents a URL.
 * @param value The value to check.
 */
export function isUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch (err) {
        return false;
    }
}
