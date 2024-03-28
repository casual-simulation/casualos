import {
    BotAction,
    hasValue,
    asyncResult,
    asyncError,
    APPROVED_SYMBOL,
    ConnectionClient,
    RemoteCausalRepoProtocol,
    GenericHttpRequest,
    GetRecordsEndpointAction,
} from '@casual-simulation/aux-common';
import {
    ListRecordDataAction,
    RecordEventAction,
    GetEventCountAction,
    RecordsAction,
    JoinRoomAction,
    LeaveRoomAction,
    RoomOptions,
    SetRoomOptionsAction,
    GetRoomOptionsAction,
    RoomJoinOptions,
    GrantInstAdminPermissionAction,
    GrantRoleAction,
    RevokeRoleAction,
    GetFileAction,
    AIChatAction,
    AIGenerateSkyboxAction,
    AIGenerateImageAction,
    ListUserStudiosAction,
    RecordDataAction,
    GetRecordDataAction,
    RecordFileAction,
    FileRecordedResult,
    EraseRecordDataAction,
    EraseFileAction,
    ListRecordDataByMarkerAction,
    GrantRecordPermissionAction,
    RevokeRecordPermissionAction,
} from '@casual-simulation/aux-runtime';
import { AuxConfigParameters } from '../vm/AuxConfig';
import axios from 'axios';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import { AuthHelperInterface } from './AuthHelperInterface';
import { BotHelper } from './BotHelper';
import {
    EraseFileResult,
    GetDataResult,
    ListDataResult,
    RecordDataResult,
    RecordFileResult,
    IssueMeetTokenResult,
    isRecordKey,
    GrantMarkerPermissionResult,
    RevokeMarkerPermissionResult,
    GrantRoleResult,
    RevokeRoleResult,
    GetFileRecordResult,
    ReadFileResult,
    ReadFileFailure,
    ReportInstRequest,
    ReportInstResult,
    GrantResourcePermissionResult,
    RevokePermissionResult,
    formatInstId,
    AIChatMessage,
    ValidateSessionKeyFailure,
} from '@casual-simulation/aux-records';
import { sha256 } from 'hash.js';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import '@casual-simulation/aux-common/BlobPolyfill';
import { Observable, Subject, filter, firstValueFrom } from 'rxjs';
import { DateTime } from 'luxon';
import {
    AIChatResponse,
    AIGenerateImageResponse,
    AIGenerateSkyboxResponse,
    AIGetSkyboxResponse,
} from '@casual-simulation/aux-records/AIController';
import { RuntimeActions } from '@casual-simulation/aux-runtime';
import {
    RecordsClientInputs,
    createRecordsClient,
} from '@casual-simulation/aux-records/RecordsClient';

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
    private _connectionClientFactory: (
        endpoint: string,
        protocol: RemoteCausalRepoProtocol
    ) => ConnectionClient;
    private _connectionClients: Map<string, ConnectionClient> = new Map();

    private _roomJoin: Subject<RoomJoin> = new Subject();
    private _roomLeave: Subject<RoomLeave> = new Subject();
    private _onSetRoomOptions: Subject<SetRoomOptions> = new Subject();
    private _onGetRoomOptions: Subject<GetRoomOptions> = new Subject();
    private _axiosOptions: AxiosRequestConfig<any>;
    private _skipTimers: boolean = false;
    private _httpRequestId: number = 0;
    private _client: ReturnType<typeof createRecordsClient>;

    /**
     * Gets an observable that resolves whenever a room_join event has been received.
     */
    get onRoomJoin(): Observable<RoomJoin> {
        return this._roomJoin;
    }

    /**
     * Gets an observable that resolves whenever a room_leave event has been received.
     */
    get onRoomLeave(): Observable<RoomLeave> {
        return this._roomLeave;
    }

    /**
     * Gets an observable that resolves whenever the options for a room should be set.
     */
    get onSetRoomOptions(): Observable<SetRoomOptions> {
        return this._onSetRoomOptions;
    }

    /**
     * Gets an observable that resolves whenever the options for a room should be retrieved.
     */
    get onGetRoomOptions(): Observable<GetRoomOptions> {
        return this._onGetRoomOptions;
    }

    /**
     * Creates a new RecordsManager that is able to consume records events from the AuxLibrary API.
     * @param config The AUX Config that should be used.
     * @param helper The Bot Helper that the simulation is using.
     * @param authFactory The function that should be used to instantiate AuthHelperInterface objects for each potential records endpoint. It should return null if the given endpoint is not supported.
     * @param skipTimers Whether to skip the timers used for skybox requests.
     */
    constructor(
        config: AuxConfigParameters,
        helper: BotHelper,
        authFactory: (endpoint: string) => AuthHelperInterface,
        skipTimers: boolean = false,
        connectionClientFactory: (
            endpoint: string,
            protocol: RemoteCausalRepoProtocol
        ) => ConnectionClient = null
    ) {
        this._config = config;
        this._helper = helper;
        this._authFactory = authFactory;
        this._auths = new Map();
        this._axiosOptions = {
            validateStatus: (status) => {
                return status < 500;
            },
        };
        this._skipTimers = skipTimers;
        this._connectionClientFactory = connectionClientFactory;
        this._client = createRecordsClient(config.recordsOrigin);
    }

    handleEvents(events: RuntimeActions[]): void {
        for (let event of events) {
            if (event.type === 'record_data') {
                this._recordData(event);
            } else if (event.type === 'get_record_data') {
                this._getRecordData(event);
            } else if (event.type === 'list_record_data') {
                this._listRecordData(event);
            } else if (event.type === 'list_record_data_by_marker') {
                this._listRecordData(event);
            } else if (event.type === 'erase_record_data') {
                this._eraseRecordData(event);
            } else if (event.type === 'record_file') {
                this._recordFile(event);
            } else if (event.type === 'get_file') {
                this._getFile(event);
            } else if (event.type === 'erase_file') {
                this._eraseFile(event);
            } else if (event.type === 'record_event') {
                this._recordEvent(event);
            } else if (event.type === 'get_event_count') {
                this._getEventCount(event);
            } else if (event.type === 'join_room') {
                this._joinRoom(event);
            } else if (event.type === 'leave_room') {
                this._leaveRoom(event);
            } else if (event.type === 'set_room_options') {
                this._setRoomOptions(event);
            } else if (event.type === 'get_room_options') {
                this._getRoomOptions(event);
            } else if (event.type === 'grant_record_permission') {
                this._grantRecordPermission(event);
            } else if (event.type === 'revoke_record_permission') {
                this._revokeRecordPermission(event);
            } else if (event.type === 'grant_inst_admin_permission') {
                this._grantInstAdminPermission(event);
            } else if (event.type === 'grant_role') {
                this._grantRole(event);
            } else if (event.type === 'revoke_role') {
                this._revokeRole(event);
            } else if (event.type === 'ai_chat') {
                this._aiChat(event);
            } else if (event.type === 'ai_generate_skybox') {
                this._aiGenerateSkybox(event);
            } else if (event.type === 'ai_generate_image') {
                this._aiGenerateImage(event);
            } else if (event.type === 'list_user_studios') {
                this._listUserStudios(event);
            } else if (event.type === 'get_records_endpoint') {
                this._getRecordsEndpoint(event);
            }
        }
    }

    private _getRecordsEndpoint(event: GetRecordsEndpointAction) {
        if (hasValue(event.taskId)) {
            this._helper.transaction(
                asyncResult(event.taskId, this._config.recordsOrigin)
            );
        }
    }

    /**
     * Reports the given inst to the server.
     * @param request The request to send to the server.
     */
    async reportInst(
        request: Omit<
            ReportInstRequest,
            'reportingUserId' | 'reportingIpAddress'
        >
    ): Promise<ReportInstResult | ValidateSessionKeyFailure> {
        const auth = this._getAuth(null);
        const token = await this._getAuthToken(auth, false);

        const result = this._client.reportInst(
            {
                ...request,
            },
            { sessionKey: token, endpoint: await auth.getRecordsOrigin() }
        );

        return result;
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
            let requestData: RecordsClientInputs['recordData'] = {
                recordKey: event.recordKey,
                address: event.address,
                data: event.data,
            };

            if (hasValue(this._helper.origin)) {
                requestData.instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            if (hasValue(event.options.markers)) {
                requestData.markers = event.options.markers as [
                    string,
                    ...string[]
                ];
            }

            if (hasValue(event.options.updatePolicy)) {
                requestData.updatePolicy = event.options.updatePolicy;
            }

            if (hasValue(event.options.deletePolicy)) {
                requestData.deletePolicy = event.options.deletePolicy;
            }

            const result = event.requiresApproval
                ? await this._client.recordManualData(requestData, {
                      sessionKey: info.token,
                      endpoint: await info.auth.getRecordsOrigin(),
                  })
                : await this._client.recordData(requestData, {
                      sessionKey: info.token,
                      endpoint: await info.auth.getRecordsOrigin(),
                  });

            if (result.success) {
                console.log('[RecordsManager] Data recorded!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
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
            const info = await this._resolveInfoForEvent(event, false);
            if (info.error) {
                return;
            }

            let instances: string[] = undefined;

            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            if (hasValue(event.taskId)) {
                const result = event.requiresApproval
                    ? await this._client.getManualData(
                          {
                              recordName: event.recordName,
                              address: event.address,
                              instances,
                          },
                          {
                              sessionKey: info.token,
                              endpoint: await info.auth.getRecordsOrigin(),
                          }
                      )
                    : await this._client.getData(
                          {
                              recordName: event.recordName,
                              address: event.address,
                              instances,
                          },
                          {
                              sessionKey: info.token,
                              endpoint: await info.auth.getRecordsOrigin(),
                          }
                      );

                this._helper.transaction(asyncResult(event.taskId, result));
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

    private async _listRecordData(
        event: ListRecordDataAction | ListRecordDataByMarkerAction
    ) {
        if (event.requiresApproval && !event[APPROVED_SYMBOL]) {
            return;
        }
        try {
            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }
            const auth = info.auth;

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

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            if (hasValue(event.taskId)) {
                const query: RecordsClientInputs['listData'] = {
                    recordName: event.recordName,
                };

                if (event.type === 'list_record_data_by_marker') {
                    query.marker = event.marker;
                }

                query.address = event.startingAddress || undefined;
                query.instances = instances;

                const result = await this._client.listData(query, {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                });

                this._helper.transaction(asyncResult(event.taskId, result));
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

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = event.requiresApproval
                ? await this._client.deleteManualData(
                      {
                          recordKey: event.recordKey,
                          address: event.address,
                          instances,
                      },
                      {
                          sessionKey: info.token,
                          endpoint: await info.auth.getRecordsOrigin(),
                      }
                  )
                : await this._client.eraseData(
                      {
                          recordKey: event.recordKey,
                          address: event.address,
                          instances,
                      },
                      {
                          sessionKey: info.token,
                          endpoint: await info.auth.getRecordsOrigin(),
                      }
                  );

            if (result.success) {
                console.log('[RecordsManager] Data deleted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
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
                    mimeType =
                        event.mimeType ||
                        event.data.type ||
                        'application/octet-stream';
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
                        mimeType =
                            event.mimeType ||
                            obj.mimeType ||
                            (typeof obj.data === 'string'
                                ? 'text/plain'
                                : 'application/octet-stream');
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

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.recordFile(
                {
                    recordKey: event.recordKey,
                    fileSha256Hex: hash,
                    fileMimeType: mimeType,
                    fileByteLength: byteLength,
                    fileDescription: event.description,
                    markers: event.options?.markers as [string, ...string[]],
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success === true) {
                const method = result.uploadMethod;
                const url = result.uploadUrl;
                const headers = { ...result.uploadHeaders };

                for (let name of UNSAFE_HEADERS) {
                    delete headers[name];
                }

                const uploadResult = await axios.request({
                    ...this._axiosOptions,
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
                    this._helper.transaction(asyncResult(event.taskId, result));
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

    private async _getFile(event: GetFileAction) {
        try {
            const info = await this._resolveInfoForEvent(event, false);
            if (info.error) {
                return;
            }

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.getFile(
                {
                    fileUrl: event.fileUrl,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (hasValue(event.taskId)) {
                if (result.success === true) {
                    const getResult = await axios.request({
                        ...this._axiosOptions,
                        method: result.requestMethod as any,
                        url: result.requestUrl,
                        headers: result.requestHeaders,
                    });

                    if (getResult.status >= 200 && getResult.status < 300) {
                        this._helper.transaction(
                            asyncResult(event.taskId, getResult.data)
                        );
                    } else {
                        this._helper.transaction(
                            asyncError(event.taskId, {
                                success: false,
                                errorCode:
                                    getResult.status === 404
                                        ? 'file_not_found'
                                        : getResult.status >= 500
                                        ? 'server_error'
                                        : 'not_authorized',
                                errorMessage: 'The file upload failed.',
                            } as ReadFileFailure)
                        );
                    }
                } else {
                    this._helper.transaction(asyncError(event.taskId, result));
                }
            }
        } catch (e) {
            console.error('[RecordsManager] Error getting file:', e);
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

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.eraseFile(
                {
                    recordKey: event.recordKey,
                    fileUrl: event.fileUrl,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] File deleted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
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

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.addEventCount(
                {
                    recordKey: event.recordKey,
                    eventName: event.eventName,
                    count: event.count,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] Event recorded!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
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
            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }

            if (hasValue(event.taskId)) {
                let instances: string[] = undefined;
                if (hasValue(this._helper.origin)) {
                    instances = [
                        formatInstId(
                            this._helper.origin.recordName,
                            this._helper.origin.inst
                        ),
                    ];
                }

                const result = await this._client.getEventCount(
                    {
                        recordName: event.recordName,
                        eventName: event.eventName,
                        instances,
                    },
                    {
                        sessionKey: info.token,
                        endpoint: await info.auth.getRecordsOrigin(),
                    }
                );

                this._helper.transaction(asyncResult(event.taskId, result));
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

    private async _joinRoom(event: JoinRoomAction) {
        try {
            const auth = this._getAuthFromEvent(event.options);

            if (!auth) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Records are not supported on this inst.',
                        } as IssueMeetTokenResult)
                    );
                }
                return;
            }

            if (hasValue(event.taskId)) {
                const userId = this._helper.userId;

                const result = await this._client.createMeetToken(
                    {
                        roomName: event.roomName,
                        userName: userId,
                    },
                    { endpoint: await auth.getRecordsOrigin() }
                );

                if (result.success) {
                    const join: RoomJoin = {
                        roomName: result.roomName,
                        token: result.token,
                        url: result.url,
                        options: event.options,
                        resolve: (options) => {
                            this._helper.transaction(
                                asyncResult(event.taskId, {
                                    success: true,
                                    roomName: result.roomName,
                                    options,
                                })
                            );
                        },
                        reject: (code, message) => {
                            this._helper.transaction(
                                asyncResult(event.taskId, {
                                    success: false,
                                    roomName: result.roomName,
                                    errorCode: code,
                                    errorMessage: message,
                                })
                            );
                        },
                    };

                    this._roomJoin.next(join);
                } else {
                    this._helper.transaction(asyncResult(event.taskId, result));
                }
            }
        } catch (e) {
            console.error('[RecordsManager] Error joining room:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _leaveRoom(event: LeaveRoomAction) {
        try {
            if (hasValue(event.taskId)) {
                const leave: RoomLeave = {
                    roomName: event.roomName,
                    resolve: () => {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                                roomName: event.roomName,
                            })
                        );
                    },
                    reject: (code, message) => {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: false,
                                roomName: event.roomName,
                                errorCode: code,
                                errorMessage: message,
                            })
                        );
                    },
                };

                this._roomLeave.next(leave);
            }
        } catch (e) {
            console.error('[RecordsManager] Error leaving room:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _setRoomOptions(event: SetRoomOptionsAction) {
        try {
            if (hasValue(event.taskId)) {
                const leave: SetRoomOptions = {
                    roomName: event.roomName,
                    options: event.options,
                    resolve: (options) => {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                                roomName: event.roomName,
                                options,
                            })
                        );
                    },
                    reject: (code, message) => {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: false,
                                roomName: event.roomName,
                                errorCode: code,
                                errorMessage: message,
                            })
                        );
                    },
                };

                this._onSetRoomOptions.next(leave);
            }
        } catch (e) {
            console.error('[RecordsManager] Error setting room options:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _getRoomOptions(event: GetRoomOptionsAction) {
        try {
            if (hasValue(event.taskId)) {
                const getRoomOptions: GetRoomOptions = {
                    roomName: event.roomName,
                    resolve: (options) => {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                                roomName: event.roomName,
                                options: options,
                            })
                        );
                    },
                    reject: (code, message) => {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: false,
                                roomName: event.roomName,
                                errorCode: code,
                                errorMessage: message,
                            })
                        );
                    },
                };

                this._onGetRoomOptions.next(getRoomOptions);
            }
        } catch (e) {
            console.error('[RecordsManager] Error setting room options:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _grantRecordPermission(event: GrantRecordPermissionAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            console.log(
                '[RecordsManager] Granting policy permission...',
                event
            );
            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.grantPermission(
                {
                    recordName: event.recordName,
                    permission: event.permission,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] Permission granted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error(
                '[RecordsManager] Error granting record permission:',
                e
            );
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _revokeRecordPermission(event: RevokeRecordPermissionAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            console.log(
                '[RecordsManager] Revoking policy permission...',
                event
            );
            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.revokePermission(
                {
                    permissionId: event.permissionId,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] Permission revoked!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error(
                '[RecordsManager] Error revoking policy permission:',
                e
            );
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _grantInstAdminPermission(
        event: GrantInstAdminPermissionAction
    ) {
        if (!event[APPROVED_SYMBOL]) {
            return;
        }
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            if (!hasValue(this._helper.origin)) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncError(
                            event.taskId,
                            'Unable to grant inst admin permission with no simulation origin!'
                        )
                    );
                }
                return;
            }

            const now = DateTime.now();
            const plusOneDay = now.plus({ day: 1 });
            const startOfNextDay = plusOneDay.set({
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
            });

            console.log('[RecordsManager] Granting inst admin role...', event);
            const result = await this._client.grantRole(
                {
                    recordName: event.recordName,
                    inst: formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                    role: 'admin',
                    expireTimeMs: startOfNextDay.toMillis(),
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] Role granted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error(
                '[RecordsManager] Error granting inst admin role:',
                e
            );
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _grantRole(event: GrantRoleAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Granting role...', event);

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.grantRole(
                {
                    recordName: event.recordName,
                    userId: event.userId,
                    inst: event.inst,
                    role: event.role,
                    expireTimeMs: event.expireTimeMs,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] Role granted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error('[RecordsManager] Error granting role:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _revokeRole(event: RevokeRoleAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            console.log('[RecordsManager] Revoking role...', event);

            const result = await this._client.revokeRole(
                {
                    recordName: event.recordName,
                    userId: event.userId,
                    inst: event.inst,
                    role: event.role,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (result.success) {
                console.log('[RecordsManager] Role revoked!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error('[RecordsManager] Error revoking role:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _aiChat(event: AIChatAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            if (!info.token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        })
                    );
                }
                return;
            }

            const { endpoint, preferredModel, ...rest } = event.options;

            let instances: string[];
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.aiChat(
                {
                    ...rest,
                    model: preferredModel,
                    messages: event.messages as [
                        AIChatMessage,
                        ...AIChatMessage[]
                    ],
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error('[RecordsManager] Error sending chat message:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _aiGenerateSkybox(event: AIGenerateSkyboxAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            if (!info.token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        })
                    );
                }
                return;
            }

            const { blockadeLabs } = event.options;

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result = await this._client.createAiSkybox(
                {
                    prompt: event.prompt,
                    negativePrompt: event.negativePrompt,
                    blockadeLabs: blockadeLabs,
                    instances,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (!result.success) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(asyncResult(event.taskId, result));
                }
                return;
            }

            const skyboxId = result.skyboxId;
            for (let i = 0; i < 10; i++) {
                if (!this._skipTimers) {
                    const seconds =
                        i === 0
                            ? 1
                            : i === 1
                            ? 4
                            : i === 2
                            ? 4
                            : i === 3
                            ? 8
                            : i === 4
                            ? 16
                            : i === 5
                            ? 32
                            : 32;

                    await wait(seconds);
                }

                const getResult = await this._client.getAiSkybox(
                    {
                        skyboxId,
                    },
                    {
                        sessionKey: info.token,
                        endpoint: await info.auth.getRecordsOrigin(),
                    }
                );

                if (getResult.success) {
                    if (getResult.status === 'generated') {
                        if (hasValue(event.taskId)) {
                            this._helper.transaction(
                                asyncResult(event.taskId, getResult)
                            );
                        }
                        return;
                    }
                }
            }

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'The request timed out.',
                    })
                );
            }
        } catch (e) {
            console.error('[RecordsManager] Error generating skybox:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _aiGenerateImage(event: AIGenerateImageAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            if (!info.token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        })
                    );
                }
                return;
            }

            const { taskId, type, options, ...rest } = event;
            let requestData: any = {
                ...rest,
            };

            let instances: string[] = undefined;
            if (hasValue(this._helper.origin)) {
                instances = [
                    formatInstId(
                        this._helper.origin.recordName,
                        this._helper.origin.inst
                    ),
                ];
            }

            const result =
                await this._sendWebsocketSupportedRequest<AIGenerateImageResponse>(
                    info.auth,
                    'POST',
                    '/api/v2/ai/image',
                    {},
                    {
                        ...requestData,
                        instances,
                    },
                    {
                        Authorization: `Bearer ${info.token}`,
                    }
                );

            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error('[RecordsManager] Error generating image:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _sendWebsocketSupportedRequest<TResponse>(
        auth: AuthHelperInterface,
        method: GenericHttpRequest['method'],
        path: string,
        query: any,
        data: any,
        headers: any
    ): Promise<TResponse> {
        const websocketOrigin = await auth.getWebsocketOrigin();
        const websocketProtocol = await auth.getWebsocketProtocol();
        const client = this._getConnectionClient(
            websocketOrigin,
            websocketProtocol
        );

        if (!client) {
            const result: AxiosResponse<TResponse> = await axios.request({
                url: await this._publishUrl(auth, path, query),
                method,
                ...this._axiosOptions,
                data: data,
                headers,
            });

            return result.data;
        } else {
            await firstValueFrom(
                client.connectionState.pipe(filter((c) => c.connected))
            );

            const id = this._httpRequestId++;
            const promise = firstValueFrom(
                client
                    .event('http_response')
                    .pipe(filter((response) => response.id === id))
            );

            client.send({
                type: 'http_request',
                id,
                request: {
                    path,
                    method,
                    headers,
                    pathParams: {},
                    query: query,
                    body: JSON.stringify(data),
                },
            });

            const response = await promise;
            if (response.response.body) {
                return JSON.parse(response.response.body);
            }
            return null;
        }
    }

    private _getConnectionClient(
        origin: string,
        protocol: RemoteCausalRepoProtocol
    ): ConnectionClient {
        if (!origin || !protocol || !this._connectionClientFactory) {
            return null;
        }

        let client = this._connectionClients.get(origin);
        if (!client) {
            client = this._connectionClientFactory(origin, protocol);
            if (client) {
                client.connect();
                this._connectionClients.set(origin, client);
            }
        }
        return client;
    }

    private async _listUserStudios(event: ListUserStudiosAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            if (!info.token) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage: 'The user is not logged in.',
                        })
                    );
                }
                return;
            }

            const result = await this._client.listStudios(
                {
                    comId: this._config.comId ?? undefined,
                },
                {
                    sessionKey: info.token,
                    endpoint: await info.auth.getRecordsOrigin(),
                }
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error('[RecordsManager] Error listing studios:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _resolveInfoForEvent(
        event:
            | RecordFileAction
            | GetRecordDataAction
            | ListRecordDataAction
            | ListRecordDataByMarkerAction
            | GetFileAction
            | EraseFileAction
            | RecordDataAction
            | EraseRecordDataAction
            | RecordEventAction
            | GetEventCountAction
            | GrantRecordPermissionAction
            | RevokeRecordPermissionAction
            | GrantInstAdminPermissionAction
            | GrantRoleAction
            | RevokeRoleAction
            | AIChatAction
            | AIGenerateSkyboxAction
            | AIGenerateImageAction
            | ListUserStudiosAction,
        authenticateIfNotLoggedIn: boolean = true
    ): Promise<{
        error: boolean;
        auth: AuthHelperInterface;
        token: string;
    }> {
        const auth = this._getAuthFromEvent(event.options);

        if (!auth) {
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'Records are not supported on this inst.',
                    } as RecordDataResult)
                );
            }
            return {
                error: true,
                auth: null,
                token: null,
            };
        }

        let token: string = null;
        if ('recordKey' in event && isRecordKey(event.recordKey)) {
            const policy = await auth.getRecordKeyPolicy(event.recordKey);

            if (policy !== 'subjectless') {
                token = await this._getAuthToken(
                    auth,
                    authenticateIfNotLoggedIn
                );
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
                        token: null,
                    };
                }
            }
        } else {
            token = await this._getAuthToken(auth, authenticateIfNotLoggedIn);
        }

        return {
            error: false,
            auth,
            token,
        };
    }

    private _getAuthFromEvent(event: {
        endpoint?: string;
    }): AuthHelperInterface {
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

    private async _getAuthToken(
        auth: AuthHelperInterface,
        authenticateIfNotLoggedIn: boolean
    ): Promise<string> {
        if (!auth) {
            return null;
        }
        if (authenticateIfNotLoggedIn) {
            if (!(await auth.isAuthenticated())) {
                await auth.authenticate();
            }
        }
        return auth.getAuthToken();
    }

    private async _publishUrl(
        auth: AuthHelperInterface,
        path: string,
        queryParams: any = {}
    ): Promise<string> {
        let url = new URL(path, await auth.getRecordsOrigin());

        for (let key in queryParams) {
            const val = queryParams[key];
            if (hasValue(val)) {
                if (Array.isArray(val)) {
                    url.searchParams.set(key, val.join(','));
                } else {
                    url.searchParams.set(key, val);
                }
            }
        }

        return url.href;
    }
}

function getHash(buffer: Uint8Array): string {
    return sha256().update(buffer).digest('hex');
}

/**
 * Defines an interface that represents the act of a room being joined.
 */
export interface RoomJoin extends RoomAction<RoomOptions> {
    /**
     * The name of the room that is being joined.
     */
    roomName: string;

    /**
     * The token that authorizes the room to be joined.
     */
    token: string;

    /**
     * The URL that should be connected to.
     */
    url: string;

    /**
     * The options for the room.
     */
    options: Partial<RoomJoinOptions>;
}

/**
 * Defines an interface that represents the act of a room being left.
 */
export interface RoomLeave extends RoomAction<void> {
    /**
     * The name of the room that should be left.
     */
    roomName: string;
}

/**
 * Defines an interface that represents the act of setting a room's options.
 */
export interface SetRoomOptions extends RoomAction<RoomOptions> {
    /**
     * The name of the room.
     */
    roomName: string;

    /**
     * The options that should be used for the room.
     */
    options: Partial<RoomOptions>;
}

/**
 * Defines an interface that represents the act of getting a room's options.
 */
export interface GetRoomOptions extends RoomAction<RoomOptions> {
    /**
     * The name of the room.
     */
    roomName: string;
}

export interface RoomAction<T> {
    /**
     * Resovles the operation as successful.
     */
    resolve(value?: T): void;

    /**
     * Rejects the operation as unsuccessful.
     * @param errorCode The error code.
     * @param errorMessage The error that occurred.
     */
    reject(errorCode: string, errorMessage: string): void;
}

function wait(seconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, seconds * 1000);
    });
}
