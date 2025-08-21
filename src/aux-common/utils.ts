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
import { fromByteArray, toByteArray } from 'base64-js';
import {
    union,
    keys,
    every,
    some,
    isObject,
    mapValues,
} from 'es-toolkit/compat';
import { v4 as uuid } from 'uuid';

/**
 * Merges the two objects and returns a new object that contains the combination of the two.
 * This is a sane merge. That means arrays are copied and if nothing needs merging then nothing changes.
 * @param obj
 * @param next
 */
export function merge<T1, T2>(first: T1, second: T2): T1 & T2;
export function merge<T1, T2, T3>(
    first: T1,
    second: T2,
    third: T3
): T1 & T2 & T3;
export function merge<T1, T2, T3, T4>(
    first: T1,
    second: T2,
    third: T3,
    fourth: T4
): T1 & T2 & T3 & T4;
export function merge(...objs: any[]): any {
    let result: any = {};
    const objKeys = objs.map((o) => keys(o));
    const allKeys = union(...objKeys);

    allKeys.forEach((k) => {
        result[k] = decide(...objs.map((o) => o[k]));
    });

    return result;
}

function decide(...vals: any[]) {
    const undefed = vals.filter((v) => typeof v !== 'undefined');
    if (undefed.length === 1) {
        return undefed[0];
    } else {
        if (
            every(
                undefed,
                (v) => typeof v === 'object' && !Array.isArray(v) && v !== null
            ) &&
            some(undefed, (v) => v !== undefed[0])
        ) {
            return (<any>merge)(...undefed);
        } else {
            return undefed[undefed.length - 1];
        }
    }
}

/**
 * Maps all the values of the given object.
 * @param value The object to map.
 * @param callback The callback that transforms one value into another.
 */
export function mapValuesDeep(value: any, callback: (v: any) => any): any {
    return isObject(value)
        ? mapValues(value, (v) => mapValuesDeep(v, callback))
        : callback(value);
}

/**
 * Splices the given string and returns the final result.
 * @param str The string to splice.
 * @param index The index that the splice should be started at.
 * @param deleteCount The number of characters to delete.
 * @param text The text to insert.
 */
export function splice(
    str: string,
    index: number,
    deleteCount: number,
    text: string
) {
    return str.slice(0, index) + text + str.slice(index + deleteCount);
}

export function lerp(start: number, end: number, t: number): number {
    return (1.0 - t) * start + t * end;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function normalize(value: number, min: number, max: number): number {
    value = clamp(value, min, max);
    return (value - min) / (max - min);
}

export function unnormalize(normal: number, min: number, max: number): number {
    normal = clamp(normal, 0.0, 1.0);
    return normal * (max - min) + min;
}

/**
 * Creates and returns a short 8 character UUID (no dashes).
 */
export function shortUuid() {
    return uuid().substr(0, 8);
}

/**
 * Converts the given string from dot case (dot.case) to camel case (camelCase).
 * @param dotCase The string to convert.
 */
export function dotCaseToCamelCase(dotCase: string): string {
    const split = dotCase.split('.');
    if (split.length <= 0) {
        return '';
    } else if (split.length === 1) {
        return split[0];
    } else {
        let [isTagHidden, first] = isHidden(split[0]);
        let others = split.slice(1);
        let uppercased = [] as string[];
        for (let str of others) {
            let [hidden, updated] = isHidden(str);
            str = updated;
            if (hidden) {
                isTagHidden = true;
            }

            uppercased.push(capitalizeFirstLetter(str));
        }
        let joined = uppercased.join('');

        if (isTagHidden) {
            return '_' + first + joined;
        } else {
            return first + joined;
        }
    }
}

function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function isHidden(str: string): [boolean, string] {
    const hidden = str.indexOf('_') === 0;
    if (hidden) {
        return [hidden, str.slice(1)];
    } else {
        return [hidden, str];
    }
}

/**
 * Determines if the given value might represent an email address.
 * @param value The value to check.
 */
export function mightBeEmailAddress(value: string): boolean {
    // Test that the value ends with an @ symbol and some characters and a dot (.) and some more characters.
    const emailTest = /@.+\.\w{2,}$/;
    return emailTest.test(value);
}

/**
 * Trims the given value and removes characters that are not valid in a phone number.
 * Returns null if the value is definitely not a phone number.
 * @param value The value that should be cleaned.
 */
export function cleanPhoneNumber(value: string): string {
    let sms = value.trim().replace(/[^\d+]/g, '');

    if (!sms) {
        return null;
    }

    if (!sms.startsWith('+')) {
        if (sms.length > 10) {
            // for US phone numbers, 10 characters make up a country-code less phone number
            // 3 for area code,
            sms = '+' + sms;
        } else if (sms.length > 7) {
            sms = '+1' + sms;
        } else {
            sms = '+1616' + sms;
        }
    }

    return sms;
}

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
    error: unknown;
}
