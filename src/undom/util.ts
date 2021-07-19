export function assign(obj: any, props: any) {
    for (let i in props) obj[i] = props[i]; // eslint-disable-line guard-for-in
}

export function toLower(str: string) {
    return str.toLowerCase();
}

export function createAttributeFilter(ns: string, name: string) {
    return (o: any) => o.ns === ns && toLower(o.name) === toLower(name);
}

export function splice<T>(
    arr: T[],
    item: T,
    add?: T,
    byValueOnly: boolean = false
) {
    let i = (arr ? findWhere(arr, item, true, byValueOnly) : -1) as number;
    if (~i) add ? arr.splice(i, 0, add) : arr.splice(i, 1);
    return i;
}

export function findWhere<T>(
    arr: T[],
    fn: ((val: T) => boolean) | T,
    returnIndex: boolean = false,
    byValueOnly: boolean = false
): T | number {
    let i = arr.length;
    while (i--)
        if (
            typeof fn === 'function' && !byValueOnly
                ? (<any>fn)(arr[i])
                : arr[i] === fn
        )
            break;
    return returnIndex ? i : arr[i];
}

let resolved = typeof Promise !== 'undefined' && Promise.resolve();
export const setImmediate = resolved
    ? (f: any) => {
          resolved.then(f);
      }
    : setTimeout;
