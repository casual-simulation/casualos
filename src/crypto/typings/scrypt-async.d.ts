declare module 'scrypt-async' {
    export interface ScryptOptions {
        /**
         * CPU Cost parameter.
         */
        N: number;

        /**
         * Block Size.
         */
        r: number;

        /**
         * Parallelization parameter.
         */
        p: number;

        /**
         * derived key length.
         */
        dkLen: number;

        /**
         * The number of loop cycles to execute before the next setTimeout.
         */
        interruptStep?: number;

        /**
         * The encoding to use.
         */
        encoding?: 'hex' | 'base64' | 'binary';
    }

    export default function scrypt(
        password: string | Uint8Array,
        salt: string | Uint8Array,
        options: ScryptOptions,
        callback: (data: string | Uint8Array | Array<number>) => void
    ): void;
}
