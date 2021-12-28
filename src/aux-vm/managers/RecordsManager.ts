import {
    BotAction,
    PublishRecordAction,
    hasValue,
    asyncResult,
    asyncError,
    GetRecordsAction,
    DeleteRecordAction,
    RecordDataAction,
    GetRecordDataAction,
    RecordFileAction,
    FileRecordedResult,
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
            } else if (event.type === 'record_file') {
                this._recordFile(event);
            }
        }
    }

    private async _recordData(event: RecordDataAction) {
        try {
            console.log('[RecordHelper] Recording data...', event);
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
                console.log('[RecordHelper] Data recorded!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordHelper] Error publishing record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getRecordData(event: GetRecordDataAction) {
        try {
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
            console.error('[RecordHelper] Error getting record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _recordFile(event: RecordFileAction) {
        try {
            console.log('[RecordHelper] Recording file...', event);
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

            if (typeof event.data === 'string') {
                const encoder = new TextEncoder();
                data = encoder.encode(event.data);
                byteLength = data.byteLength;
                hash = sha256().update(data).digest('hex');
                mimeType = 'text/plain';
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
                const headers = result.data.uploadHeaders;

                const uploadResult = await axios.request({
                    method: method.toLowerCase() as any,
                    url: url,
                    headers: headers,
                    data: data,
                });

                if (uploadResult.status >= 200 && uploadResult.status < 300) {
                    console.log('[RecordHelper] File recorded!');

                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                                url: url,
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
            console.error('[RecordHelper] Error recording file:', e);
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
