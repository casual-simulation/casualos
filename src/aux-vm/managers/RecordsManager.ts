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
    EraseFileAction,
    APPROVED_SYMBOL,
    ListRecordDataAction,
    RecordEventAction,
    GetEventCountAction,
    RecordsAction,
} from '@casual-simulation/aux-common';
import { AuxConfigParameters } from '../vm/AuxConfig';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { AuthHelperInterface } from './AuthHelperInterface';
import { BotHelper } from './BotHelper';
import {
    EraseFileResult,
    GetDataResult,
    ListDataResult,
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
    private _auths: Map<string, AuthHelperInterface>;
    private _authFactory: (endpoint: string) => AuthHelperInterface;

    /**
     * Creates a new RecordsManager that is able to consume records events from the AuxLibrary API.
     * @param config The AUX Config that should be used.
     * @param helper The Bot Helper that the simulation is using.
     * @param authFactory The function that should be used to instantiate AuthHelperInterface objects for each potential records endpoint. It should return null if the given endpoint is not supported.
     */
    constructor(
        config: AuxConfigParameters,
        helper: BotHelper,
        authFactory: (endpoint: string) => AuthHelperInterface
    ) {
        this._config = config;
        this._helper = helper;
        this._authFactory = authFactory;
        this._auths = new Map();
    }

    handleEvents(events: BotAction[]): void {
        for (let event of events) {
            if (event.type === 'record_data') {
                this._recordData(event);
            } else if (event.type === 'get_record_data') {
                this._getRecordData(event);
            } else if (event.type === 'list_record_data') {
                this._listRecordData(event);
            } else if (event.type === 'erase_record_data') {
                this._eraseRecordData(event);
            } else if (event.type === 'record_file') {
                this._recordFile(event);
            } else if (event.type === 'erase_file') {
                this._eraseFile(event);
            } else if (event.type === 'record_event') {
                this._recordEvent(event);
            } else if (event.type === 'get_event_count') {
                this._getEventCount(event);
            }
        }
    }

    private async _recordData(event: RecordDataAction) {
        if (event.requiresApproval && !event[APPROVED_SYMBOL]) {
            return;
        }
        try {

            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Recording data...', event);
            const result: AxiosResponse<RecordDataResult> = await axios.post(
                this._publishUrl(
                    info.auth,
                    !event.requiresApproval
                        ? '/api/v2/records/data'
                        : '/api/v2/records/manual/data'
                ),
                {
                    recordKey: event.recordKey,
                    address: event.address,
                    data: event.data,
                },
                {
                    headers: info.headers,
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
        if (event.requiresApproval && !event[APPROVED_SYMBOL]) {
            return;
        }
        try {
            const auth = this._getAuthFromEvent(event);

            if (!auth) {
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
                    this._publishUrl(
                        auth,
                        !event.requiresApproval
                            ? '/api/v2/records/data'
                            : '/api/v2/records/manual/data',
                        {
                            recordName: event.recordName,
                            address: event.address,
                        }
                    )
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

    private async _listRecordData(event: ListRecordDataAction) {
        if (event.requiresApproval && !event[APPROVED_SYMBOL]) {
            return;
        }
        try {
            const auth = this._getAuthFromEvent(event);

            if (!auth) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        } as ListDataResult)
                    );
                }
                return;
            }
            if (event.requiresApproval) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'It is not possible to list manual approval records.',
                        } as ListDataResult)
                    );
                }
                return;
            }

            if (hasValue(event.taskId)) {
                const result: AxiosResponse<ListDataResult> = await axios.get(
                    this._publishUrl(auth, '/api/v2/records/data/list', {
                        recordName: event.recordName,
                        address: event.startingAddress || null,
                    })
                );

                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error listing record:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _eraseRecordData(event: EraseRecordDataAction) {
        if (event.requiresApproval && !event[APPROVED_SYMBOL]) {
            return;
        }
        try {

            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Deleting data...', event);

            const result: AxiosResponse<RecordDataResult> = await axios.request(
                {
                    method: 'DELETE',
                    url: this._publishUrl(info.auth,
                        !event.requiresApproval
                            ? '/api/v2/records/data'
                            : '/api/v2/records/manual/data'
                    ),
                    data: {
                        recordKey: event.recordKey,
                        address: event.address,
                    },
                    headers: info.headers,
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
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Recording file...', event);

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
                this._publishUrl(info.auth, '/api/v2/records/file'),
                {
                    recordKey: event.recordKey,
                    fileSha256Hex: hash,
                    fileMimeType: mimeType,
                    fileByteLength: byteLength,
                    fileDescription: event.description,
                },
                {
                    headers: info.headers,
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

    private async _eraseFile(event: EraseFileAction) {
        try {
            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Deleting file...', event);

            const result: AxiosResponse<EraseFileResult> = await axios.request({
                method: 'DELETE',
                url: this._publishUrl(info.auth, '/api/v2/records/file'),
                data: {
                    recordKey: event.recordKey,
                    fileUrl: event.fileUrl,
                },
                headers: info.headers,
            });

            if (result.data.success) {
                console.log('[RecordsManager] File deleted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error deleting file:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _recordEvent(event: RecordEventAction) {
        try {
            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Recording event...', event);

            const result: AxiosResponse<RecordDataResult> = await axios.post(
                this._publishUrl(info.auth, '/api/v2/records/events/count'),
                {
                    recordKey: event.recordKey,
                    eventName: event.eventName,
                    count: event.count,
                },
                {
                    headers: info.headers,
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Event recorded!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error recording event:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getEventCount(event: GetEventCountAction) {
        try {
            const auth = this._getAuthFromEvent(event);

            if (!auth) {
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
                    this._publishUrl(auth, '/api/v2/records/events/count', {
                        recordName: event.recordName,
                        eventName: event.eventName,
                    })
                );

                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error getting event count:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _resolveInfoForEvent(event: RecordFileAction | EraseFileAction | RecordDataAction | EraseRecordDataAction | RecordEventAction): Promise< { error: boolean, auth: AuthHelperInterface, headers: { [key: string]: string } }> {
        const auth = this._getAuthFromEvent(event);

        if (!auth) {
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
            return {
                error: true,
                auth: null,
                headers: null,
            };
        }

        const policy = await auth.getRecordKeyPolicy(event.recordKey);
        let token: string;
        let headers: { [key: string]: string } = {};

        if (policy !== 'subjectless') {
            token = await this._getAuthToken(auth);
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
                return {
                    error: true,
                    auth: null,
                    headers: null,
                };
            }

            headers['Authorization'] = `Bearer ${token}`;
        }

        return {
            error: false,
            auth,
            headers
        };
    }

    private _getAuthFromEvent(event: { endpoint?: string }): AuthHelperInterface {
        let endpoint: string = event.endpoint;
        return this._getAuth(endpoint);
    }

    /**
     * Gets the AuthHelperInterface for the given endpoint.
     * Returns null if the given endpoint is unsupported.
     * @param endpoint The endpoint.
     */
    private _getAuth(endpoint: string): AuthHelperInterface {
        if (!endpoint) {
            endpoint = this._config.authOrigin;
            if (!endpoint) {
                return null;
            }
        }
        let auth: AuthHelperInterface = null;
        if (this._auths.has(endpoint)) {
            auth = this._auths.get(endpoint);
        } else {
            auth = this._authFactory(endpoint);
            this._auths.set(endpoint, auth);
    }
        return auth;
    }

    private async _getAuthToken(auth: AuthHelperInterface): Promise<string> {
        if (!auth) {
            return null;
        }
        if (!(await auth.isAuthenticated())) {
            await auth.authenticate();
        }
        return auth.getAuthToken();
    }

    private _publishUrl(auth: AuthHelperInterface, path: string, queryParams: any = {}): string {
        let url = new URL(path, auth.recordsOrigin);

        for (let key in queryParams) {
            const val = queryParams[key];
            if (hasValue(val)) {
                url.searchParams.set(key, val);
            }
        }

        return url.href;
    }
}

function getHash(buffer: Uint8Array): string {
    return sha256().update(buffer).digest('hex');
}
