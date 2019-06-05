export function union<T, T2>(target: T, other: T2): T & T2 {
    return <any>new Proxy(<any>target, {
        get(obj, prop) {
            if (obj.hasOwnProperty(prop)) {
                return obj[prop];
            }
            return (<any>other)[prop];
        },
    });
}
