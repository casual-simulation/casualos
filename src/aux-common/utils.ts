import { union, keys, every, some } from "lodash";
import uuid from 'uuid/v4';

/**
 * Merges the two objects and returns a new object that contains the combination of the two.
 * This is a sane merge. That means arrays are copied and if nothing needs merging then nothing changes.
 * @param obj 
 * @param next 
 */
export function merge<T1, T2>(first: T1, second: T2): T1 & T2;
export function merge<T1, T2, T3>(first: T1, second: T2, third: T3): T1 & T2 & T3;
export function merge(...objs: any[]): any {
    let result:any = {};
    const objKeys = objs.map(o => keys(o));
    const allKeys = union(...objKeys);
    
    allKeys.forEach(k => {
        result[k] = decide(...objs.map(o => o[k]));
    });

    return result;
}

function decide(...vals: any[]) {
    const undefed = vals.filter(v => typeof v !== 'undefined');
    if (undefed.length === 1) {
        return undefed[0];
    } else {
        if (every(undefed, v => typeof v === 'object' && !Array.isArray(v) && v !== null) && some(undefed, v => v !== undefed[0])) {
            return (<any>merge)(...undefed);
        } else {
            return undefed[undefed.length - 1];
        }
    }
}

/**
 * Splices the given string and returns the final result.
 * @param str The string to splice.
 * @param index The index that the splice should be started at.
 * @param deleteCount The number of characters to delete.
 * @param text The text to insert.
 */
export function splice(str: string, index: number, deleteCount: number, text: string) {
    return str.slice(0, index) + text + str.slice(index + deleteCount);
}

export function lerp(start: number, end: number, t: number): number {
    return (1.0 - t) * start + t * end;
}

export function clamp(value: number, min: number, max:number): number {
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