export function wait(ms: number) {
    return new Promise<void>(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export async function waitAsync(num: number = 10) {
    // Wait for the async operations to finish
    for (let i = 0; i < num; i++) {
        await Promise.resolve();
    }
}
