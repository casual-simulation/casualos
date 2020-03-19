import download from 'downloadjs';
import { StoredAux } from '@casual-simulation/aux-vm';

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

            reader.onerror = e => {
                reject(reader.error);
            };

            reader.onabort = e => {
                reject(new Error('The file read operation was aborted.'));
            };

            reader.onload = e => {
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

            reader.onerror = e => {
                reject(reader.error);
            };

            reader.onabort = e => {
                reject(new Error('The file read operation was aborted.'));
            };

            reader.onload = e => {
                resolve(<ArrayBuffer>reader.result);
            };

            reader.readAsArrayBuffer(data);
        } catch (ex) {
            reject(ex);
        }
    });
}
