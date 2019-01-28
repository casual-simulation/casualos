import { union, keys, every } from "lodash";

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
        if (every(undefed, v => typeof v === 'object' && !Array.isArray(v) && v !== null)) {
            return (<any>merge)(...undefed);
        } else {
            return undefed[undefed.length - 1];
        }
    }
}