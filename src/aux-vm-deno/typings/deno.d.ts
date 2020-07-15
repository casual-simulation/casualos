declare var Deno: {
    stdin: Reader;
    stdout: Writer;

    iter(
        r: Reader,
        options?: { bufSize: number }
    ): AsyncIterableIterator<Uint8Array>;

    connect(options: { port: number; hostname?: string }): Promise<Connection>;

    Buffer: typeof DenoBuffer;

    args: string[];
};

interface Reader {
    read(p: Uint8Array): Promise<number | null>;
}

interface Writer {
    write(p: Uint8Array): Promise<number>;
}

interface Connection extends Reader, Writer {}

declare class DenoBuffer {
    readonly length: number;
    readonly capacity: number;
    bytes(options?: { copy: boolean }): Uint8Array;
    truncate(num: number): void;
    grow(num: number): void;
    empty(): boolean;
    readSync(p: Uint8Array): number | null;
}
