if (!globalThis.Blob) {
    if (typeof process === 'undefined') {
        console.warn(
            '[BlobPolyfill] Loading Blob stub! This should not happen in browser environments!'
        );
    }
    (<any>globalThis).Blob = class {
        type: string;
        parts: any[];

        constructor(parts: any[], options: any) {
            this.parts = parts.slice();
            this.type = options?.type;
        }

        async arrayBuffer(): Promise<ArrayBuffer> {
            let bytes = [] as number[];
            const encoder = new TextEncoder();
            for (const part of this.parts) {
                if (typeof part === 'string') {
                    const encoded = encoder.encode(part);
                    bytes.push(...encoded);
                } else if (part instanceof ArrayBuffer) {
                    bytes.push(...new Uint8Array(part));
                } else if (ArrayBuffer.isView(part)) {
                    bytes.push(...new Uint8Array(part.buffer));
                } else if (part instanceof Blob) {
                    const buffer = await part.arrayBuffer();
                    bytes.push(...new Uint8Array(buffer));
                }
            }

            const view = new Uint8Array(bytes);
            return view.buffer;
        }
    };
}
