import { fromByteArray, toByteArray } from 'base64-js';

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
