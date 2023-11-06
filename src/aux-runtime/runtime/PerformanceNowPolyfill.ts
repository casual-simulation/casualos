if (!globalThis.performance) {
    globalThis.performance = {
        now() {
            return Date.now();
        },
    } as any;
}
