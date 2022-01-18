import {
    BotAction,
    hasValue,
    asyncResult,
    asyncError,
    RecordDataAction,
    GetRecordDataAction,
    RecordFileAction,
    FileRecordedResult,
    EraseRecordDataAction,
} from '@casual-simulation/aux-common';
import { AuxConfigParameters } from '../vm/AuxConfig';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { AuthHelperInterface } from './AuthHelperInterface';
import { BotHelper } from './BotHelper';
import {
    GetDataResult,
    RecordDataResult,
    RecordFileResult,
} from '@casual-simulation/aux-records';
import { sha256 } from 'hash.js';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import '@casual-simulation/aux-common/runtime/BlobPolyfill';

/**
 * The list of headers that JavaScript applications are not allowed to set by themselves.
 */
export const UNSAFE_HEADERS = new Set([
    'accept-encoding',
    'referer',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'origin',
    'sec-ch-ua-platform',
    'user-agent',
    'sec-ch-ua-mobile',
    'sec-ch-ua',
    'content-length',
    'connection',
    'host',
]);

/**
 * Defines a class that provides capabilities for storing and retrieving records.
 */
export class RecordsManager {
    private _config: AuxConfigParameters;
    private _helper: BotHelper;
    private _auth: AuthHelperInterface;

    constructor(
        config: AuxConfigParameters,
        helper: BotHelper,
        auth: AuthHelperInterface
    ) {
        this._config = config;
        this._helper = helper;
        this._auth = auth;
    }

    handleEvents(events: BotAction[]): void {
        for (let event of events) {
            if (event.type === 'record_data') {
                this._recordData(event);
            } else if (event.type === 'get_record_data') {
                this._getRecordData(event);
            } else if (event.type === 'erase_record_data') {
                this._eraseRecordData(event);
            } else if (event.type === 'record_file') {
                this._recordFile(event);
            }
        }
    }

    private async _recordData(event: RecordDataAction) {
        try {
            if (!hasValue(this._config.recordsOrigin)) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        } as RecordDataResult)
                    );
                }
                return;
            }

            console.log('[RecordsManager] Recording data...', event);
            const token = await this._getAuthToken();

            if (!token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        } as RecordDataResult)
                    );
                }
                return;
            }

            const result: AxiosResponse<RecordDataResult> = await axios.post(
                this._publishUrl('/api/v2/records/data'),
                {
                    recordKey: event.recordKey,
                    address: event.address,
                    data: event.data,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Data recorded!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error publishing record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getRecordData(event: GetRecordDataAction) {
        try {
            if (!hasValue(this._config.recordsOrigin)) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        } as GetDataResult)
                    );
                }
                return;
            }

            if (hasValue(event.taskId)) {
                const result: AxiosResponse<GetDataResult> = await axios.get(
                    this._publishUrl('/api/v2/records/data', {
                        recordName: event.recordName,
                        address: event.address,
                    })
                );

                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error getting record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _eraseRecordData(event: EraseRecordDataAction) {
        try {
            if (!hasValue(this._config.recordsOrigin)) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        } as RecordDataResult)
                    );
                }
                return;
            }

            console.log('[RecordsManager] Deleting data...', event);
            const token = await this._getAuthToken();

            if (!token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        } as RecordDataResult)
                    );
                }
                return;
            }

            const result: AxiosResponse<RecordDataResult> = await axios.request(
                {
                    method: 'DELETE',
                    url: this._publishUrl('/api/v2/records/data'),
                    data: {
                        recordKey: event.recordKey,
                        address: event.address,
                    },
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Data deleted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error deleting record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _recordFile(event: RecordFileAction) {
        try {
            if (!hasValue(this._config.recordsOrigin)) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        } as RecordFileResult)
                    );
                }
                return;
            }

            console.log('[RecordsManager] Recording file...', event);
            const token = await this._getAuthToken();

            if (!token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        } as RecordFileResult)
                    );
                }
                return;
            }

            let byteLength: number;
            let hash: string;
            let mimeType: string;
            let data: any;

            if (typeof event.data === 'function') {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'invalid_file_data',
                            errorMessage:
                                'Function instances cannot be stored in files.',
                        } as RecordFileResult)
                    );
                }
                return;
            } else if (
                typeof event.data === 'undefined' ||
                event.data === null
            ) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'invalid_file_data',
                            errorMessage:
                                'Null or undefined values cannot be stored in files.',
                        } as RecordFileResult)
                    );
                }
                return;
            } else if (
                typeof event.data === 'string' ||
                typeof event.data === 'number' ||
                typeof event.data === 'boolean'
            ) {
                const encoder = new TextEncoder();
                data = encoder.encode(event.data.toString());
                byteLength = data.byteLength;
                mimeType = event.mimeType || 'text/plain';
                hash = getHash(data);
            } else if (typeof event.data === 'object') {
                if (event.data instanceof Blob) {
                    const buffer = await event.data.arrayBuffer();
                    data = new Uint8Array(buffer);
                    byteLength = data.byteLength;
                    mimeType = event.mimeType || event.data.type;
                    hash = getHash(data);
                } else if (event.data instanceof ArrayBuffer) {
                    data = new Uint8Array(event.data);
                    byteLength = data.byteLength;
                    mimeType = event.mimeType || 'application/octet-stream';
                    hash = getHash(data);
                } else if (ArrayBuffer.isView(event.data)) {
                    data = new Uint8Array(event.data.buffer);
                    byteLength = data.byteLength;
                    mimeType = event.mimeType || 'application/octet-stream';
                    hash = getHash(data);
                } else {
                    const obj = event.data;
                    if (
                        'data' in obj &&
                        'mimeType' in obj &&
                        (obj.data instanceof ArrayBuffer ||
                            typeof obj.data === 'string') &&
                        typeof obj.mimeType === 'string'
                    ) {
                        if (typeof obj.data === 'string') {
                            data = new TextEncoder().encode(obj.data);
                        } else {
                            data = new Uint8Array(obj.data);
                        }
                        byteLength = data.byteLength;
                        mimeType = event.mimeType || obj.mimeType;
                        hash = getHash(data);
                    } else {
                        let json = stringify(event.data);
                        data = new TextEncoder().encode(json);
                        byteLength = data.byteLength;
                        mimeType = event.mimeType || 'application/json';
                        hash = getHash(data);
                    }
                }
            }

            const result: AxiosResponse<RecordFileResult> = await axios.post(
                this._publishUrl('/api/v2/records/file'),
                {
                    recordKey: event.recordKey,
                    fileSha256Hex: hash,
                    fileMimeType: mimeType,
                    fileByteLength: byteLength,
                    fileDescription: event.description,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (result.data.success === true) {
                const method = result.data.uploadMethod;
                const url = result.data.uploadUrl;
                const headers = { ...result.data.uploadHeaders };

                for (let name of UNSAFE_HEADERS) {
                    delete headers[name];
                }

                const uploadResult = await axios.request({
                    method: method.toLowerCase() as any,
                    url: url,
                    headers: headers,
                    data: data,
                });

                if (uploadResult.status >= 200 && uploadResult.status < 300) {
                    console.log('[RecordsManager] File recorded!');

                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                                url: url,
                                sha256Hash: hash,
                            } as FileRecordedResult)
                        );
                    }
                } else {
                    console.error(
                        '[RecordsManager] File upload failed!',
                        uploadResult
                    );
                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: false,
                                errorCode: 'upload_failed',
                                errorMessage: 'The file upload failed.',
                            } as FileRecordedResult)
                        );
                    }
                }
            } else {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, result.data)
                    );
                }
            }
        } catch (e) {
            console.error('[RecordsManager] Error recording file:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getAuthToken(): Promise<string> {
        if (!(await this._auth.isAuthenticated())) {
            await this._auth.authenticate();
        }
        return this._auth.getAuthToken();
    }

    private _publishUrl(path: string, queryParams: any = {}): string {
        let url = new URL(path, this._config.recordsOrigin);

        for (let key in queryParams) {
            url.searchParams.set(key, queryParams[key]);
        }

        return url.href;
    }
}

function getHash(buffer: Uint8Array): string {
    return sha256().update(buffer).digest('hex');
}
