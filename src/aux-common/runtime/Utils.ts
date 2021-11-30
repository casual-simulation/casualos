import { RealtimeEditMode } from './RuntimeBot';
import { hasValue, isBot, isRuntimeBot } from '../bots/BotCalculations';
import { AuxPartitionRealtimeStrategy } from '../partitions/AuxPartition';
import { forOwn } from 'lodash';
import { Easing, EaseMode, EaseType } from '../bots';
import TWEEN, { Easing as TweenEasing } from '@tweenjs/tween.js';

/**
 * Converts the given error to a copiable value.
 * Returns a new value that can be sent over to web workers.
 * @param err The error to convert.
 */
export function convertErrorToCopiableValue(err: unknown): any {
    if (err instanceof Error) {
        let obj: any = {
            message: err.message,
            name: err.name,
            stack: err.stack,
        };

        if ((<any>err).response) {
            let response = (<any>err).response;
            obj.response = {
                data: response.data,
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
            };
        }

        return obj;
    } else {
        return err;
    }
}

/**
 * Converts the given value to a copiable value.
 * Copiable values are strings, numbers, booleans, arrays, and objects made of any of those types.
 * Non-copiable values are functions and errors.
 * @param value
 */
export function convertToCopiableValue(value: any): any {
    try {
        return _convertToCopiableValue(value, 0, new Map());
    } catch (err) {
        if (err instanceof DeepObjectError) {
            return '[Nested object]';
        }
        throw err;
    }
}

function _convertToCopiableValue(
    value: any,
    depth: number,
    map: Map<any, any>
): any {
    if (depth > 1000) {
        throw new DeepObjectError();
    }
    if (typeof value === 'function') {
        return `[Function ${value.name}]`;
    } else if (value instanceof Error) {
        return `${value.name}: ${value.message}`;
    } else if (typeof value === 'object') {
        if (map.has(value)) {
            return map.get(value);
        }
        if (isRuntimeBot(value)) {
            const result = {
                id: value.id,
                tags: value.tags.toJSON(),
            };
            map.set(value, result);
            return result;
        } else if (isBot(value)) {
            const result = {
                id: value.id,
                tags: value.tags,
            };
            map.set(value, result);
            return result;
        } else if (Array.isArray(value)) {
            const result = [] as any[];
            map.set(value, result);
            result.push(
                ...value.map((val) =>
                    _convertToCopiableValue(val, depth + 1, map)
                )
            );
            return result;
        } else if (value === null || value === undefined) {
            return value;
        } else if (value instanceof Date) {
            return value;
        } else {
            let result = {} as any;
            map.set(value, result);
            forOwn(value, (val, key, object) => {
                result[key] = _convertToCopiableValue(val, depth + 1, map);
            });
            return result;
        }
    }
    return value;
}

export function realtimeStrategyToRealtimeEditMode(
    strategy: AuxPartitionRealtimeStrategy
): RealtimeEditMode {
    return strategy === 'immediate'
        ? RealtimeEditMode.Immediate
        : RealtimeEditMode.Delayed;
}

export class DeepObjectError extends Error {
    constructor() {
        super('Object too deeply nested.');
    }
}

export function getDefaultEasing(easing: Easing | EaseType): Easing {
    return hasValue(easing)
        ? typeof easing === 'string'
            ? {
                  mode: 'inout',
                  type: easing,
              }
            : easing
        : {
              mode: 'inout',
              type: 'linear',
          };
}

export function getEasing(easing: Easing | EaseType) {
    const value = getDefaultEasing(easing);
    return getTweenEasing(value as Easing);
}

export function getTweenEasing(easing: Easing): any {
    switch (easing.type) {
        case 'linear':
        default:
            return TWEEN.Easing.Linear.None;
        case 'circular':
            return resolveEaseType(easing.mode, TWEEN.Easing.Circular);
        case 'cubic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Cubic);
        case 'exponential':
            return resolveEaseType(easing.mode, TWEEN.Easing.Exponential);
        case 'elastic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Elastic);
        case 'quadratic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quadratic);
        case 'quartic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quartic);
        case 'quintic':
            return resolveEaseType(easing.mode, TWEEN.Easing.Quintic);
        case 'sinusoidal':
            return resolveEaseType(easing.mode, TWEEN.Easing.Sinusoidal);
    }
}

function resolveEaseType(
    mode: EaseMode,
    val: typeof TweenEasing.Circular | typeof TweenEasing.Linear
): any {
    if ('None' in val) {
        return val.None;
    } else {
        switch (mode) {
            case 'in':
                return val.In;
            case 'out':
                return val.Out;
            case 'inout':
            default:
                return val.InOut;
        }
    }
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
