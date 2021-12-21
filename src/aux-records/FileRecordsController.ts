import { ServerError } from './Errors';
import { RecordsController } from './RecordsController';

/**
 * Defines a class that can manage file records.
 */
export class FileRecordsController {
    private _controller: RecordsController;
    private _tableName: string;

    constructor(controller: RecordsController, tableName: string) {
        this._controller = controller;
        this._tableName = tableName;
    }

    async recordFile(): Promise<RecordFileResult> {
        return null;
    }
}

export type RecordFileResult = RecordFileSuccess | RecordFileFailure;

export interface RecordFileSuccess {
    success: true;

    /**
     * The algorithm that is used for the signature.
     */
    signatureAlgorithm: 'AWS4-HMAC-SHA256';

    /**
     * The signature that should be included in the upload request.
     */
    signature: string;

    /**
     * The headers that should be included in the upload request.
     */
    headers: {
        [name: string]: string;
    };
}

export interface RecordFileFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}
