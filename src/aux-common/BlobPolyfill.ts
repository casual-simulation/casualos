/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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
