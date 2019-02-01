import { FilesState } from "common/Files";
import download from 'downloadjs';

export function downloadAuxState(state: FilesState, name: string) {
    return downloadFile(new Blob([JSON.stringify(state)], {
        type: 'application/json'
    }), `${name}.aux`, 'application/json');
}

export function downloadFile(data: Blob, filename: string, mimeType: string) {
    return download(data, filename, mimeType);
}

export function readFileJson(data: File): Promise<string> {
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
            }
            
            reader.readAsText(data);
        } catch(ex) {
            reject(ex);
        }
    });
}