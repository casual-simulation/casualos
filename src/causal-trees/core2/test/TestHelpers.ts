export async function waitAsync() {
    return new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));
}
