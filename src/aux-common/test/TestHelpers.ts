export function wait(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export async function waitAsync(num: number = 10) {
    return new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
    );
}

export function isPromise(value: unknown): value is Promise<any> {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as any).then === 'function' &&
        typeof (value as any).catch === 'function'
    );
}
