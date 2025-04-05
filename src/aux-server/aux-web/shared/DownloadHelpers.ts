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
import download from 'downloadjs';
import type { StoredAux } from '@casual-simulation/aux-common';

export function downloadAuxState(state: StoredAux, name: string) {
    return downloadFile(
        new Blob([JSON.stringify(state)], {
            type: 'application/json',
        }),
        `${name}.aux`,
        'application/json'
    );
}

export function downloadFile(data: Blob, filename: string, mimeType: string) {
    return download(data, filename, mimeType);
}

export function readFileText(data: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        try {
            const reader = new FileReader();

            reader.onerror = (e) => {
                reject(reader.error);
            };

            reader.onabort = (e) => {
                reject(new Error('The file read operation was aborted.'));
            };

            reader.onload = (e) => {
                resolve(<string>reader.result);
            };

            reader.readAsText(data);
        } catch (ex) {
            reject(ex);
        }
    });
}

export function readFileArrayBuffer(data: File): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        try {
            const reader = new FileReader();

            reader.onerror = (e) => {
                reject(reader.error);
            };

            reader.onabort = (e) => {
                reject(new Error('The file read operation was aborted.'));
            };

            reader.onload = (e) => {
                resolve(<ArrayBuffer>reader.result);
            };

            reader.readAsArrayBuffer(data);
        } catch (ex) {
            reject(ex);
        }
    });
}

const textFileExtensions = new Set([
    '.aux',
    '.json',
    '.txt',
    '.md',
    '.html',
    '.js',
    '.ts',

    // LDraw file extensions
    '.mpd',
    '.ldr',
]);

export async function getFileData(
    file: File
): Promise<string | ArrayBuffer | object> {
    try {
        let textData: string = null;
        for (let textExt of textFileExtensions) {
            if (file.name.endsWith(textExt)) {
                textData = await readFileText(file);
                break;
            }
        }

        if (textData !== null) {
            return textData;
        }
    } catch {
        return await readFileArrayBuffer(file);
    }

    return await readFileArrayBuffer(file);
}
