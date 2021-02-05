if (!globalThis.Blob) {
    if (typeof process === 'undefined') {
        console.warn(
            '[BlobPolyfill] Loading Blob stub! This should not happen in browser environments!'
        );
    }
    (<any>globalThis).Blob = class {
        type: string;

        constructor(parts: any[], options: any) {
            this.type = options?.type;
        }
    };
}
