export async function waitAsync() {
    return new Promise((resolve) => setImmediate(resolve));
}
