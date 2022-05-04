export function wait(ms: number) {
    return new Promise<void>(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export async function waitAsync(num: number = 10) {
    return new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));
}
