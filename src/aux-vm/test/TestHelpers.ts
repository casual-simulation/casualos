export function wait(ms: number) {
    return new Promise<void>(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export async function waitAsync() {
    // Wait for the async operations to finish
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}
