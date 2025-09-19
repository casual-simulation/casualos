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
import type {
    ConnectionClient,
    RemoteCausalRepoProtocol,
    GenericHttpRequest,
    GetRecordsEndpointAction,
    StoredAux,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    asyncResult,
    asyncError,
    APPROVED_SYMBOL,
    iterableNext,
    iterableThrow,
    iterableComplete,
    formatVersionNumber,
    remote,
    installAuxFile,
    formatInstId,
    isRecordKey,
    parseRecordKey,
    action,
    ON_PACKAGE_INSTALLED_ACTION_NAME,
} from '@casual-simulation/aux-common';
import type {
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
    AIChatStreamAction,
    AIHumeGetAccessTokenAction,
    AISloydGenerateModelAction,
    RecordsCallProcedureAction,
    GrantEntitlementsAction,
    RecordPackageVersionAction,
    InstallPackageAction,
    InstallPackageSuccess,
    ListInstalledPackagesAction,
} from '@casual-simulation/aux-runtime';
import type { AuxConfigParameters } from '../vm/AuxConfig';
import axios from 'axios';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import type { BotHelper } from './BotHelper';
import { sha256 } from 'hash.js';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import '@casual-simulation/aux-common/BlobPolyfill';
import type { Observable } from 'rxjs';
import { mergeWith } from 'rxjs';
import {
    ReplaySubject,
    Subject,
    filter,
    firstValueFrom,
    map,
    share,
    takeWhile,
} from 'rxjs';
import { DateTime } from 'luxon';
import type {
    AIChatResponse,
    AIGenerateImageResponse,
    AIGenerateSkyboxResponse,
    AIGetSkyboxResponse,
} from '@casual-simulation/aux-records/AIController';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';
import type {
    RecordsClientActions,
    RecordsClientInputs,
} from '@casual-simulation/aux-records/RecordsClient';

/* eslint-disable casualos/no-non-type-imports */
import { createRecordsClient } from '@casual-simulation/aux-records/RecordsClient';
import type {
    EraseFileResult,
    GetDataResult,
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
    GrantRoleResult,
    IssueMeetTokenResult,
    ListDataResult,
    ReadFileFailure,
    ReadFileResult,
    ReadFileSuccess,
    RecordDataResult,
    RecordFileFailure,
    RecordFileResult,
    ReportInstRequest,
    ReportInstResult,
    RevokePermissionResult,
    RevokeRoleResult,
} from '@casual-simulation/aux-records';

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
 * Whether to use HTTP requests for streaming AI chat.
 * If true, then the client will send HTTP requests for ai_chat_stream requests.
 * If false, then the client will use the WebSocket connection to stream AI chat.
 */
const USE_HTTP_STREAMING = false;

/**
 * Defines an interface that represents info about a records endpoint.
 */
export interface RecordsEndpointInfo {
    /**
     * The HTTP origin that API requests should be made to.
     */
    recordsOrigin: string;

    /**
     * The WebSocket origin that Websocket requests should be made to.
     */
    websocketOrigin?: string;

    /**
     * The protocol that websocket requests should be made over.
     */
    websocketProtocol?: RemoteCausalRepoProtocol;

    /**
     * The headers that should be included in HTTP requests to authenticate the user.
     */
    headers: { [key: string]: string };

    /**
     * The token that should be used for the request.
     * Null if the user isn't logged in.
     */
    token: string | null;

    /**
     * Whether there was an error resolving the info.
     */
    error: boolean;
}

export type GetEndpointInfoFunction = (
    endpoint: string,
    authenticateIfNotLoggedIn: boolean
) => Promise<RecordsEndpointInfo | null>;

export const RECORDS_WS_PROTOCOL = 'casualos.records';

/**
 * Defines a class that provides capabilities for storing and retrieving records.
 */
export class RecordsManager {
    private _config: AuxConfigParameters;
    private _helper: BotHelper;
    private _getEndpointInfo: GetEndpointInfoFunction;
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

    private _allowedProcedures = new Map<keyof RecordsClientActions, boolean>([
        ['createRecord', true],
        ['recordWebhook', true],
        ['getWebhook', true],
        ['listWebhooks', true],
        ['eraseWebhook', true],
        ['runWebhook', true],
        ['recordNotification', true],
        ['getNotification', false],
        ['listNotifications', false],
        ['eraseNotification', true],
        ['subscribeToNotification', true],
        ['unsubscribeFromNotification', true],
        ['sendNotification', true],
        ['listNotificationSubscriptions', true],
        ['listUserNotificationSubscriptions', true],
        ['createOpenAIRealtimeSession', true],
        ['erasePackageVersion', true],
        ['listPackageVersions', false],
        ['getPackageVersion', false],
        ['recordPackage', true],
        ['erasePackage', true],
        ['listPackages', false],
        ['getPackage', false],
        ['recordSearchCollection', true],
        ['getSearchCollection', false],
        ['eraseSearchCollection', true],
        ['listSearchCollections', false],
        ['recordSearchDocument', true],
        ['eraseSearchDocument', true],
        ['listRecords', true],
        ['listPermissions', true],
        ['listInsts', true],
        ['recordDatabase', true],
        ['eraseDatabase', true],
        ['listDatabases', false],
        ['getDatabase', true],
        ['queryDatabase', true],
    ]);

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
     * Gets a records client that can be used to make records requests.
     */
    get client(): ReturnType<typeof createRecordsClient> {
        return this._client;
    }

    /**
     * Creates a new RecordsManager that is able to consume records events from the AuxLibrary API.
     * @param config The AUX Config that should be used.
     * @param helper The Bot Helper that the simulation is using.
     * @param getEndpointInfo The function that should be used to resolve the info for the given endpoint. Should return null if the endpoint is not supported.
     * @param skipTimers Whether to skip the timers used for skybox requests.
     */
    constructor(
        config: AuxConfigParameters,
        helper: BotHelper,
        getEndpointInfo: GetEndpointInfoFunction,
        skipTimers: boolean = false,
        connectionClientFactory: (
            endpoint: string,
            protocol: RemoteCausalRepoProtocol
        ) => ConnectionClient = null
    ) {
        this._config = config;
        this._helper = helper;
        this._getEndpointInfo = getEndpointInfo;
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
            } else if (event.type === 'ai_chat_stream') {
                this._aiChatStream(event);
            } else if (event.type === 'ai_generate_skybox') {
                this._aiGenerateSkybox(event);
            } else if (event.type === 'ai_generate_image') {
                this._aiGenerateImage(event);
            } else if (event.type === 'ai_hume_get_access_token') {
                this._aiHumeGetAccessToken(event);
            } else if (event.type === 'ai_sloyd_generate_model') {
                this._aiSloydGenerateModel(event);
            } else if (event.type === 'list_user_studios') {
                this._listUserStudios(event);
            } else if (event.type === 'get_records_endpoint') {
                this._getRecordsEndpoint(event);
            } else if (event.type === 'records_call_procedure') {
                this._recordsCallProcedure(event);
            } else if (event.type === 'record_package_version') {
                this._recordPackageVersion(event);
            } else if (event.type === 'install_package') {
                this._installPackage(event);
            } else if (event.type === 'list_installed_packages') {
                this._listInstalledPackages(event);
            }
        }
    }

    async grantEntitlements(event: GrantEntitlementsAction) {
        const info = await this._resolveInfoForEvent(event);

        if (info.error) {
            return;
        }

        let grantIds: string[] = [];

        for (let feature of event.request.features) {
            const result = await this._client.grantEntitlement(
                {
                    packageId: event.request.packageId,
                    feature: feature,
                    scope: event.request.scope,
                    recordName: event.request.recordName,
                    expireTimeMs: event.request.expireTimeMs,
                },
                {
                    sessionKey: info.token,
                    endpoint: info.recordsOrigin,
                }
            );

            if (result.success === false) {
                console.error(
                    '[RecordsManager] Unable to grant entitlement:',
                    result
                );
                if (hasValue(event.taskId)) {
                    await this._helper.transaction(
                        asyncResult(event.taskId, result)
                    );
                }
                return;
            } else {
                grantIds.push(result.grantId);
            }
        }

        if (hasValue(event.taskId)) {
            await this._helper.transaction(
                asyncResult(event.taskId, {
                    success: true,
                    grantIds,
                })
            );
        }
    }

    private _getRecordsEndpoint(event: GetRecordsEndpointAction) {
        if (hasValue(event.taskId)) {
            this._helper.transaction(
                asyncResult(event.taskId, this._config.authOrigin)
            );
        }
    }

    private async _recordsCallProcedure(event: RecordsCallProcedureAction) {
        let name: keyof RecordsClientActions;
        let input: any;
        let query: any;
        for (let key in event.procedure) {
            if (Object.hasOwn(event.procedure, key)) {
                const val = event.procedure[key as keyof RecordsClientActions];
                if (val) {
                    name = key as keyof RecordsClientActions;
                    input = val.input;
                    query = val.query;
                    break;
                }
            }
        }

        if (!name || !this._allowedProcedures.has(name)) {
            console.warn(
                '[RecordsManager] No procedure found in the call procedure event.'
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: `The procedure was either not found or not allowed. (name: ${
                            name ?? 'undefined'
                        })`,
                    })
                );
            }
            return;
        }

        const requireLogin = this._allowedProcedures.get(name);
        const info = await this._resolveInfoForEvent(event, requireLogin);

        if (info.error) {
            return;
        }

        if (hasValue(this._helper.origin)) {
            const instances = this._getInstancesForRequest();
            if (query) {
                query.instances = instances;
            } else {
                input.instances = instances;
            }
        }

        const result = await this._client.callProcedure(
            name,
            input,
            {
                sessionKey: info.token,
                endpoint: info.recordsOrigin,
            },
            query
        );

        if (hasValue(event.taskId)) {
            this._helper.transaction(asyncResult(event.taskId, result));
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
    ): Promise<ReportInstResult> {
        const info = await this._resolveInfoForEvent(
            { options: {} } as any,
            false
        );
        if (info.error) {
            return;
        }

        const result: AxiosResponse<ReportInstResult> = await axios.post(
            await this._publishUrl(
                info.recordsOrigin,
                '/api/v2/records/insts/report'
            ),
            {
                ...request,
            },
            {
                ...this._axiosOptions,
                headers: info.headers,
            }
        );

        return result.data;
    }

    /**
     * Gets a token that can be used to access loom for the given record.
     * @param recordName The name of the record.
     */
    async getLoomToken(recordName: string): Promise<string> {
        const info = await this._resolveInfoForEvent({ options: {} } as any);

        if (info.error) {
            return;
        }

        const result = await this._client.getLoomAccessToken(
            {
                recordName,
            },
            {
                sessionKey: info.token,
                endpoint: info.recordsOrigin,
            }
        );

        if (result.success === false) {
            console.error('[RecordsManager] Unable to get loom token:', result);
            return null;
        }

        return result.token;
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
            let requestData: any = {
                recordKey: event.recordKey,
                address: event.address,
                data: event.data,
            };

            requestData.instances = this._getInstancesForRequest();

            if (hasValue(event.options.markers)) {
                requestData.markers = event.options.markers;
            }

            if (hasValue(event.options.updatePolicy)) {
                requestData.updatePolicy = event.options.updatePolicy;
            }

            if (hasValue(event.options.deletePolicy)) {
                requestData.deletePolicy = event.options.deletePolicy;
            }

            const result: AxiosResponse<RecordDataResult> = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    !event.requiresApproval
                        ? '/api/v2/records/data'
                        : '/api/v2/records/manual/data'
                ),
                requestData,
                {
                    ...this._axiosOptions,
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
            const info = await this._resolveInfoForEvent(event, false);
            if (info.error) {
                return;
            }

            const instances = this._getInstancesForRequest();

            if (hasValue(event.taskId)) {
                const result: AxiosResponse<GetDataResult> = await axios.get(
                    await this._publishUrl(
                        info.recordsOrigin,
                        !event.requiresApproval
                            ? '/api/v2/records/data'
                            : '/api/v2/records/manual/data',
                        {
                            recordName: event.recordName,
                            address: event.address,
                            instances,
                        }
                    ),
                    {
                        ...this._axiosOptions,
                        headers: info.headers,
                    }
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

    private async _listRecordData(
        event: ListRecordDataAction | ListRecordDataByMarkerAction
    ) {
        if (event.requiresApproval && !event[APPROVED_SYMBOL]) {
            return;
        }
        try {
            const info = await this._resolveInfoForEvent(event, false);
            if (info.error) {
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

            const instances = this._getInstancesForRequest();

            if (hasValue(event.taskId)) {
                let query: any = {
                    recordName: event.recordName,
                };

                if (event.type === 'list_record_data_by_marker') {
                    query.marker = event.marker;
                }

                query.address = event.startingAddress || null;
                query.instances = instances;

                const result: AxiosResponse<ListDataResult> = await axios.get(
                    await this._publishUrl(
                        info.recordsOrigin,
                        '/api/v2/records/data/list',
                        query
                    ),
                    {
                        ...this._axiosOptions,
                        headers: info.headers,
                    }
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

            const instances = this._getInstancesForRequest();

            const result: AxiosResponse<RecordDataResult> = await axios.request(
                {
                    ...this._axiosOptions,
                    method: 'DELETE',
                    url: await this._publishUrl(
                        info.recordsOrigin,
                        !event.requiresApproval
                            ? '/api/v2/records/data'
                            : '/api/v2/records/manual/data'
                    ),
                    data: {
                        recordKey: event.recordKey,
                        address: event.address,
                        instances,
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

            const fileInfo = await this._resolveRecordFileInfo(
                event.data,
                event.mimeType
            );

            if (fileInfo.success === false) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, fileInfo)
                    );
                }
                return;
            }

            const { byteLength, hash, mimeType, data } = fileInfo;

            const instances = this._getInstancesForRequest();

            const result: AxiosResponse<RecordFileResult> = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/file'
                ),
                {
                    recordKey: event.recordKey,
                    fileSha256Hex: hash,
                    fileMimeType: mimeType,
                    fileByteLength: byteLength,
                    fileDescription: event.description,
                    markers: event.options?.markers,
                    instances,
                },
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );

            const uploadResult = await this._uploadFile(
                result.data,
                data,
                hash
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, uploadResult)
                );
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

    private async _uploadFile(
        result: RecordFileResult,
        data: any,
        hash: string
    ): Promise<FileRecordedResult> {
        if (result.success === false) {
            return result;
        }
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

            return {
                success: true,
                url: url,
                sha256Hash: hash,
            };
            // if (hasValue(event.taskId)) {

            //     this._helper.transaction(
            //         asyncResult(event.taskId, {
            //             success: true,
            //             url: url,
            //             sha256Hash: hash,
            //         } as FileRecordedResult)
            //     );
            // }
        } else {
            console.error('[RecordsManager] File upload failed!', uploadResult);
            return {
                success: false,
                errorCode: 'upload_failed',
                errorMessage: 'The file upload failed.',
            };
            // if (hasValue(event.taskId)) {
            //     this._helper.transaction(
            //         asyncResult(event.taskId, {
            //             success: false,
            //             errorCode: 'upload_failed',
            //             errorMessage: 'The file upload failed.',
            //         } as FileRecordedResult)
            //     );
            // }
        }
    }

    private async _resolveRecordFileInfo(
        eventData: any,
        eventMimeType: string
    ): Promise<
        | RecordFileFailure
        | {
              success: true;
              byteLength: number;
              hash: string;
              mimeType: string;
              data: any;
          }
    > {
        let byteLength: number;
        let hash: string;
        let mimeType: string;
        let data: any;

        if (typeof eventData === 'function') {
            // if (hasValue(event.taskId)) {
            //     this._helper.transaction(
            //         asyncResult(event.taskId, {
            //             success: false,
            //             errorCode: 'invalid_file_data',
            //             errorMessage:
            //                 'Function instances cannot be stored in files.',
            //         } as RecordFileResult)
            //     );
            // }
            return {
                success: false,
                errorCode: 'invalid_file_data',
                errorMessage: 'Function instances cannot be stored in files.',
            };
        } else if (typeof eventData === 'undefined' || eventData === null) {
            return {
                success: false,
                errorCode: 'invalid_file_data',
                errorMessage:
                    'Null or undefined values cannot be stored in files.',
            };
        } else if (
            typeof eventData === 'string' ||
            typeof eventData === 'number' ||
            typeof eventData === 'boolean'
        ) {
            const encoder = new TextEncoder();
            data = encoder.encode(eventData.toString());
            byteLength = data.byteLength;
            mimeType = eventMimeType || 'text/plain';
            hash = getHash(data);
        } else if (typeof eventData === 'object') {
            if (eventData instanceof Blob) {
                const buffer = await eventData.arrayBuffer();
                data = new Uint8Array(buffer);
                byteLength = data.byteLength;
                mimeType =
                    eventMimeType ||
                    eventData.type ||
                    'application/octet-stream';
                hash = getHash(data);
            } else if (eventData instanceof ArrayBuffer) {
                data = new Uint8Array(eventData);
                byteLength = data.byteLength;
                mimeType = eventMimeType || 'application/octet-stream';
                hash = getHash(data);
            } else if (ArrayBuffer.isView(eventData)) {
                data = new Uint8Array(eventData.buffer);
                byteLength = data.byteLength;
                mimeType = eventMimeType || 'application/octet-stream';
                hash = getHash(data);
            } else {
                const obj = eventData;
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
                        eventMimeType ||
                        obj.mimeType ||
                        (typeof obj.data === 'string'
                            ? 'text/plain'
                            : 'application/octet-stream');
                    hash = getHash(data);
                } else {
                    let json = stringify(eventData);
                    data = new TextEncoder().encode(json);
                    byteLength = data.byteLength;
                    mimeType = eventMimeType || 'application/json';
                    hash = getHash(data);
                }
            }
        }

        return {
            success: true,
            byteLength,
            hash,
            mimeType,
            data,
        };
    }

    private async _getFile(event: GetFileAction) {
        try {
            const info = await this._resolveInfoForEvent(event, false);
            if (info.error) {
                return;
            }

            const instances = this._getInstancesForRequest();

            const result: AxiosResponse<ReadFileResult> = await axios.get(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/file',
                    {
                        fileUrl: event.fileUrl,
                        instances,
                    }
                ),
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );

            if (hasValue(event.taskId)) {
                if (result.data.success) {
                    const getResult = await axios.request({
                        ...this._axiosOptions,
                        method: result.data.requestMethod as any,
                        url: result.data.requestUrl,
                        headers: result.data.requestHeaders,
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
                    this._helper.transaction(
                        asyncError(event.taskId, result.data)
                    );
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

    private async _readFile(result: ReadFileSuccess) {
        const getResult = await axios.request({
            ...this._axiosOptions,
            method: result.requestMethod as any,
            url: result.requestUrl,
            headers: result.requestHeaders,
        });

        if (getResult.status >= 200 && getResult.status < 300) {
            return {
                success: true,
                data: getResult.data,
            } as const;
        } else {
            return {
                success: false,
                errorCode:
                    getResult.status === 404
                        ? 'file_not_found'
                        : getResult.status >= 500
                        ? 'server_error'
                        : 'not_authorized',
                errorMessage:
                    getResult.status === 404
                        ? 'The file was not found.'
                        : 'The file download failed.',
            } as ReadFileFailure;
        }
    }

    private async _eraseFile(event: EraseFileAction) {
        try {
            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }

            console.log('[RecordsManager] Deleting file...', event);

            const instances = this._getInstancesForRequest();

            const result: AxiosResponse<EraseFileResult> = await axios.request({
                ...this._axiosOptions,
                method: 'DELETE',
                url: await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/file'
                ),
                data: {
                    recordKey: event.recordKey,
                    fileUrl: event.fileUrl,
                    instances,
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

            const instances = this._getInstancesForRequest();

            const result: AxiosResponse<RecordDataResult> = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/events/count'
                ),
                {
                    recordKey: event.recordKey,
                    eventName: event.eventName,
                    count: event.count,
                    instances,
                },
                {
                    ...this._axiosOptions,
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
            const info = await this._resolveInfoForEvent(event);
            if (info.error) {
                return;
            }

            if (hasValue(event.taskId)) {
                const instances = this._getInstancesForRequest();
                const result: AxiosResponse<GetDataResult> = await axios.get(
                    await this._publishUrl(
                        info.recordsOrigin,
                        '/api/v2/records/events/count',
                        {
                            recordName: event.recordName,
                            eventName: event.eventName,
                            instances,
                        }
                    ),
                    { ...this._axiosOptions, headers: info.headers }
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

    private async _joinRoom(event: JoinRoomAction) {
        try {
            const info = await this._resolveInfoForEvent(event, false);

            if (info.error) {
                // if (hasValue(event.taskId)) {
                //     this._helper.transaction(
                //         asyncResult(event.taskId, {
                //             success: false,
                //             errorCode: 'not_supported',
                //             errorMessage:
                //                 'Records are not supported on this inst.',
                //         } as IssueMeetTokenResult)
                //     );
                // }
                return;
            }

            if (hasValue(event.taskId)) {
                const userId = this._helper.userId;
                const result: AxiosResponse<IssueMeetTokenResult> =
                    await axios.post(
                        await this._publishUrl(
                            info.recordsOrigin,
                            '/api/v2/meet/token'
                        ),
                        {
                            roomName: event.roomName,
                            userName: userId,
                        },
                        { ...this._axiosOptions }
                    );

                const data = result.data;
                if (data.success) {
                    const join: RoomJoin = {
                        roomName: data.roomName,
                        token: data.token,
                        url: data.url,
                        options: event.options,
                        resolve: (options) => {
                            this._helper.transaction(
                                asyncResult(event.taskId, {
                                    success: true,
                                    roomName: data.roomName,
                                    options,
                                })
                            );
                        },
                        reject: (code, message) => {
                            this._helper.transaction(
                                asyncResult(event.taskId, {
                                    success: false,
                                    roomName: data.roomName,
                                    errorCode: code,
                                    errorMessage: message,
                                })
                            );
                        },
                    };

                    this._roomJoin.next(join);
                } else {
                    this._helper.transaction(asyncResult(event.taskId, data));
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
            const instances = this._getInstancesForRequest();

            let requestData: any = {
                recordName: event.recordName,
                permission: event.permission,
                instances,
            };

            const result: AxiosResponse<
                GrantMarkerPermissionResult | GrantResourcePermissionResult
            > = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/permissions'
                ),
                requestData,
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Permission granted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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
            const instances = this._getInstancesForRequest();

            let requestData: any = {
                recordName: event.recordName,
                permissionId: event.permissionId,
                instances,
            };

            const result: AxiosResponse<RevokePermissionResult> =
                await axios.post(
                    await this._publishUrl(
                        info.recordsOrigin,
                        '/api/v2/records/permissions/revoke'
                    ),
                    requestData,
                    {
                        ...this._axiosOptions,
                        headers: info.headers,
                    }
                );

            if (result.data.success) {
                console.log('[RecordsManager] Permission revoked!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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

            if (this._helper.origin.isStatic) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncError(
                            event.taskId,
                            'Unable to grant inst admin permission to static insts.'
                        )
                    );
                }
                return;
            }

            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
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
            let requestData: any = {
                recordName: event.recordName,
                inst: formatInstId(
                    this._helper.origin.recordName,
                    this._helper.origin.inst
                ),
                role: 'admin',
                expireTimeMs: startOfNextDay.toMillis(),
            };

            const result: AxiosResponse<GrantRoleResult> = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/role/grant'
                ),
                requestData,
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Role granted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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

            const instances = this._getInstancesForRequest();

            let requestData: any = {
                recordName: event.recordName,
                userId: event.userId,
                inst: event.inst,
                role: event.role,
                expireTimeMs: event.expireTimeMs,
                instances,
            };

            const result: AxiosResponse<GrantRoleResult> = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/role/grant'
                ),
                requestData,
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Role granted!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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

            const instances = this._getInstancesForRequest();

            console.log('[RecordsManager] Revoking role...', event);
            let requestData: any = {
                recordName: event.recordName,
                userId: event.userId,
                inst: event.inst,
                role: event.role,
                instances,
            };

            const result: AxiosResponse<RevokeRoleResult> = await axios.post(
                await this._publishUrl(
                    info.recordsOrigin,
                    '/api/v2/records/role/revoke'
                ),
                requestData,
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );

            if (result.data.success) {
                console.log('[RecordsManager] Role revoked!');
            }
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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
            let requestData: any = {
                ...rest,
                model: preferredModel,
                messages: event.messages,
            };

            requestData.instances = this._getInstancesForRequest();

            const result: AxiosResponse<AIChatResponse> = await axios.post(
                await this._publishUrl(info.recordsOrigin, '/api/v2/ai/chat'),
                requestData,
                {
                    ...this._axiosOptions,
                    headers: info.headers,
                }
            );
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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

    private async _aiChatStream(event: AIChatStreamAction) {
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
            let requestData: any = {
                ...rest,
                model: preferredModel,
                messages: event.messages,
            };

            requestData.instances = this._getInstancesForRequest();

            if (USE_HTTP_STREAMING) {
                const result = await this._client.aiChatStream(requestData, {
                    sessionKey: info.token,
                    endpoint: info.recordsOrigin,
                });

                if (hasValue(event.taskId)) {
                    if (Symbol.asyncIterator in result) {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                            })
                        );

                        try {
                            for await (let data of result) {
                                this._helper.transaction(
                                    iterableNext(event.taskId, data)
                                );
                            }

                            this._helper.transaction(
                                iterableComplete(event.taskId)
                            );
                        } catch (err) {
                            this._helper.transaction(
                                iterableThrow(event.taskId, err)
                            );
                        }
                    } else {
                        this._helper.transaction(
                            asyncResult(event.taskId, result)
                        );
                    }
                }

                return;
            }

            const client = await this._getWebsocketClient(
                info.websocketOrigin,
                info.websocketProtocol
            );
            if (!client) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Streaming AI chat is not supported on this inst.',
                        })
                    );
                }
                return;
            }

            const result = await this._sendWebsocketStreamRequest(
                client,
                'POST',
                '/api/v2/ai/chat/stream',
                {},
                requestData,
                info.headers
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: true,
                    })
                );

                result.subscribe({
                    next: (data) => {
                        this._helper.transaction(
                            iterableNext(event.taskId, data)
                        );
                    },
                    error: (err) => {
                        this._helper.transaction(
                            iterableThrow(event.taskId, err)
                        );
                    },
                    complete: () => {
                        this._helper.transaction(
                            iterableComplete(event.taskId)
                        );
                    },
                });
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

            const { endpoint, blockadeLabs, ...rest } = event.options;
            let requestData: any = {
                prompt: event.prompt,
                negativePrompt: event.negativePrompt,
                blockadeLabs: blockadeLabs,
            };

            const instances = this._getInstancesForRequest();

            const result: AxiosResponse<AIGenerateSkyboxResponse> =
                await axios.post(
                    await this._publishUrl(
                        info.recordsOrigin,
                        '/api/v2/ai/skybox'
                    ),
                    {
                        ...requestData,
                        instances,
                    },
                    {
                        ...this._axiosOptions,
                        headers: info.headers,
                    }
                );

            if (!result.data.success) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, result.data)
                    );
                }
                return;
            }

            const skyboxId = result.data.skyboxId;
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

                const getResult: AxiosResponse<AIGetSkyboxResponse> =
                    await axios.get(
                        await this._publishUrl(
                            info.recordsOrigin,
                            '/api/v2/ai/skybox',
                            {
                                skyboxId: result.data.skyboxId,
                                instances,
                            }
                        ),
                        {
                            ...this._axiosOptions,
                            headers: info.headers,
                        }
                    );

                if (getResult.data.success) {
                    if (getResult.data.status === 'generated') {
                        if (hasValue(event.taskId)) {
                            this._helper.transaction(
                                asyncResult(event.taskId, getResult.data)
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

            const instances = this._getInstancesForRequest();

            const result =
                await this._sendWebsocketSupportedRequest<AIGenerateImageResponse>(
                    info.recordsOrigin,
                    info.websocketOrigin,
                    info.websocketProtocol,
                    'POST',
                    '/api/v2/ai/image',
                    {},
                    {
                        ...requestData,
                        instances,
                    },
                    info.headers
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

    private async _aiHumeGetAccessToken(event: AIHumeGetAccessTokenAction) {
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

            const result = await this._client.getHumeAccessToken(
                {
                    recordName: event.recordName,
                },
                {
                    sessionKey: info.token,
                    endpoint: info.recordsOrigin,
                }
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error(
                '[RecordsManager] Error getting Hume access token:',
                e
            );
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _aiSloydGenerateModel(event: AISloydGenerateModelAction) {
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

            const result = await this._client.createSloydModel(
                {
                    recordName: event.recordName,
                    prompt: event.prompt,
                    baseModelId: event.baseModelId,
                    levelOfDetail: event.levelOfDetail,
                    outputMimeType: event.outputMimeType,
                    thumbnail: event.thumbnail,
                },
                {
                    endpoint: info.recordsOrigin,
                    sessionKey: info.token,
                }
            );

            if (hasValue(event.taskId)) {
                this._helper.transaction(asyncResult(event.taskId, result));
            }
        } catch (e) {
            console.error('[RecordsManager] Error generating Sloyd model:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _recordPackageVersion(event: RecordPackageVersionAction) {
        try {
            const info = await this._resolveInfoForEvent(event);

            if (info.error) {
                return;
            }

            const fileInfo = await this._resolveRecordFileInfo(
                event.request.state,
                'application/json'
            );

            if (fileInfo.success === false) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, fileInfo)
                    );
                }
                return;
            }

            const { byteLength, hash, mimeType, data } = fileInfo;

            const instances = this._getInstancesForRequest();

            const result = await this._client.recordPackageVersion(
                {
                    recordName: event.request.recordName,
                    item: {
                        address: event.request.address,
                        key: event.request.key,
                        description: event.request.description,
                        entitlements: event.request.entitlements,
                        markers: event.request.markers as [string, ...string[]],
                        auxFileRequest: {
                            fileByteLength: byteLength,
                            fileSha256Hex: hash,
                            fileMimeType: mimeType,
                            fileDescription: `${event.request.recordName}/${
                                event.request.address
                            }@${formatVersionNumber(
                                event.request.key.major,
                                event.request.key.minor,
                                event.request.key.patch,
                                event.request.key.tag
                            )}`,
                        },
                    },
                    instances,
                },
                {
                    endpoint: info.recordsOrigin,
                    sessionKey: info.token,
                }
            );

            if (result.success === false) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(asyncResult(event.taskId, result));
                }
                return;
            }

            const uploadResult = await this._uploadFile(
                result.auxFileResult,
                data,
                hash
            );

            if (uploadResult.success === false) {
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, uploadResult)
                    );
                }
                return;
            }

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, {
                        success: true,
                        recordName: result.recordName,
                        address: result.address,
                        auxFileResult: uploadResult,
                    })
                );
            }
        } catch (e) {
            console.error(
                '[RecordsManager] Error recording package version:',
                e
            );
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _installPackage(event: InstallPackageAction) {
        try {
            const info = await this._resolveInfoForEvent(event, false);

            if (info.error) {
                return;
            }

            const instances = this._getInstancesForRequest();

            if (this._helper.origin?.isStatic) {
                // static origins need to install packages via fetching the package

                const input: RecordsClientInputs['getPackageVersion'] = {
                    recordName: event.recordName,
                    address: event.address,
                    instances,
                };

                if (event.key) {
                    if (typeof event.key === 'string') {
                        input.key = event.key;
                    } else if (typeof event.key === 'object') {
                        if (event.key.sha256) {
                            input.sha256 = event.key.sha256;
                        } else {
                            input.major = event.key.major;
                            input.minor = event.key.minor;
                            input.patch = event.key.patch;
                            input.tag = event.key.tag;
                        }
                    }
                }

                const result = await this._client.getPackageVersion(input, {
                    sessionKey: info.token,
                    endpoint: info.recordsOrigin,
                });

                if (result.success === false) {
                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, result)
                        );
                    }
                    return;
                }
                if (result.auxFile.success === false) {
                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, result.auxFile)
                        );
                    }
                    return;
                }

                const fileResult = await this._readFile(result.auxFile);

                if (fileResult.success === false) {
                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, fileResult)
                        );
                    }
                    return;
                } else {
                    // get json and apply it
                    const aux: StoredAux = fileResult.data;

                    await this._helper.transaction(
                        remote(installAuxFile(aux, 'default'))
                    );

                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncResult(event.taskId, {
                                success: true,
                                packageLoadId: null,
                                package: result.item,
                            } as InstallPackageSuccess),
                            action(
                                ON_PACKAGE_INSTALLED_ACTION_NAME,
                                null,
                                null,
                                {
                                    packageLoadId: null,
                                    package: result.item,
                                }
                            )
                        );
                    }
                }
            } else {
                if (!this._helper.origin) {
                    if (hasValue(event.taskId)) {
                        this._helper.transaction(
                            asyncError(
                                event.taskId,
                                'Unable to install package with no simulation origin!'
                            )
                        );
                    }
                    return;
                }

                // other origins can install via a HTTP request
                const result = await this._client.installPackage(
                    {
                        recordName: this._helper.origin.recordName,
                        inst: this._helper.origin.inst,
                        package: {
                            recordName: event.recordName,
                            address: event.address,
                            key: event.key,
                        },
                        instances,
                    },
                    {
                        sessionKey: info.token,
                        endpoint: info.recordsOrigin,
                    }
                );

                if (hasValue(event.taskId)) {
                    if (result.success === false) {
                        this._helper.transaction(
                            asyncResult(event.taskId, result)
                        );
                    } else {
                        const { success, ...data } = result;
                        this._helper.transaction(
                            asyncResult(event.taskId, result),
                            action(
                                ON_PACKAGE_INSTALLED_ACTION_NAME,
                                null,
                                null,
                                {
                                    ...data,
                                }
                            )
                        );
                    }
                }
            }
        } catch (e) {
            console.error('[RecordsManager] Error installing package:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private async _listInstalledPackages(event: ListInstalledPackagesAction) {
        try {
            const info = await this._resolveInfoForEvent(event, false);

            if (info.error) {
                return;
            }

            const instances = this._getInstancesForRequest();

            if (
                !hasValue(this._helper.origin) ||
                this._helper.origin.isStatic
            ) {
                console.warn(
                    `[RecordsManager] Unable to list packages for local insts.`
                );
                if (hasValue(event.taskId)) {
                    this._helper.transaction(
                        asyncResult(event.taskId, {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage:
                                'Listing packages is not supported for local insts.',
                        })
                    );
                }
            } else {
                const result = await this._client.listInstalledPackages(
                    {
                        recordName: this._helper.origin.recordName,
                        inst: this._helper.origin.inst,
                        instances,
                    },
                    {
                        sessionKey: info.token,
                        endpoint: info.recordsOrigin,
                    }
                );

                if (hasValue(event.taskId)) {
                    this._helper.transaction(asyncResult(event.taskId, result));
                }
            }
        } catch (e) {
            console.error('[RecordsManager] Error listing packages:', e);
            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncError(event.taskId, e.toString())
                );
            }
        }
    }

    private _getInstancesForRequest() {
        let instances: string[] = undefined;
        if (hasValue(this._helper.origin) && !this._helper.origin.isStatic) {
            instances = [
                formatInstId(
                    this._helper.origin.recordName,
                    this._helper.origin.inst
                ),
            ];
        }
        return instances;
    }

    private async _sendWebsocketSupportedRequest<TResponse>(
        recordsOrigin: string,
        websocketOrigin: string,
        websocketProtocol: RemoteCausalRepoProtocol,
        method: GenericHttpRequest['method'],
        path: string,
        query: any,
        data: any,
        headers: any
    ): Promise<TResponse> {
        const client = this._getConnectionClient(
            websocketOrigin,
            websocketProtocol
        );

        if (!client) {
            const result: AxiosResponse<TResponse> = await axios.request({
                url: await this._publishUrl(recordsOrigin, path, query),
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

            const disconnected = client.connectionState.pipe(
                filter((c) => !c.connected),
                map(() => {
                    throw new Error('The request encountered an error.');
                })
            );

            const id = this._httpRequestId++;
            const promise = firstValueFrom(
                client.event('http_response').pipe(
                    mergeWith(disconnected),
                    filter((response) => response.id === id)
                )
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
                return JSON.parse(response.response.body as string);
            }
            return null;
        }
    }

    private async _getWebsocketClient(
        websocketOrigin: string,
        websocketProtocol: RemoteCausalRepoProtocol
    ): Promise<ConnectionClient> {
        const client = this._getConnectionClient(
            websocketOrigin,
            websocketProtocol
        );

        return client;
    }

    private async _sendWebsocketStreamRequest<TResponse>(
        client: ConnectionClient,
        method: GenericHttpRequest['method'],
        path: string,
        query: any,
        data: any,
        headers: any
    ): Promise<Observable<TResponse>> {
        await firstValueFrom(
            client.connectionState.pipe(filter((c) => c.connected))
        );

        const id = this._httpRequestId++;

        const disconnected = client.connectionState.pipe(
            filter((c) => !c.connected),
            map(() => {
                throw new Error('The request encountered an error.');
            })
        );

        const responses = client.event('http_partial_response').pipe(
            mergeWith(disconnected),
            filter((response) => response.id === id),
            takeWhile((response) => !response.final),
            map((response) => {
                if (response.response.body) {
                    return JSON.parse(response.response.body as string);
                }
                return null;
            }),
            share({
                connector: () => new ReplaySubject(),
                resetOnError: false,
                resetOnComplete: false,
                resetOnRefCountZero: false,
            })
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

        return responses;
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

            const query: any = {};
            if (this._config.comId) {
                query['comId'] = this._config.comId;
            }

            const result: AxiosResponse<ListUserStudiosAction> =
                await axios.get(
                    await this._publishUrl(
                        info.recordsOrigin,
                        '/api/v2/studios/list',
                        query
                    ),
                    {
                        ...this._axiosOptions,
                        headers: info.headers,
                    }
                );

            if (hasValue(event.taskId)) {
                this._helper.transaction(
                    asyncResult(event.taskId, result.data)
                );
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
            | AIChatStreamAction
            | AIGenerateSkyboxAction
            | AIGenerateImageAction
            | AIHumeGetAccessTokenAction
            | AISloydGenerateModelAction
            | ListUserStudiosAction
            | RecordsAction,
        authenticateIfNotLoggedIn: boolean = true
    ): Promise<RecordsEndpointInfo> {
        let recordKeyPolicy: PublicRecordKeyPolicy = null;
        if ('recordKey' in event && isRecordKey(event.recordKey)) {
            const parsed = parseRecordKey(event.recordKey);
            if (parsed) {
                const [name, password, policy] = parsed;
                recordKeyPolicy = policy;
                if (recordKeyPolicy === 'subjectless') {
                    authenticateIfNotLoggedIn = false;
                }
            }
        }

        const info = await this._getInfoFromEvent(
            event.options,
            authenticateIfNotLoggedIn
        );

        if (!info) {
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
                recordsOrigin: null,
                headers: null,
                token: null,
            };
        }

        if (!hasValue(info.token) && recordKeyPolicy === 'subjectfull') {
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
                recordsOrigin: null,
                headers: null,
                token: null,
            };
        }

        return info;
    }

    /**
     * Gets the information needed to call an API on the given endpoint.
     * Returns a promise that resolves with the information. Resolves with null if there is no configured endpoint and one is not provided.
     * @param endpoint The endpoint. If not specifed, then the default one will be used.
     * @param authenticateIfNotLoggedIn Whether to authenticate the user if not logged in.
     */
    getInfoForEndpoint(
        endpoint: string | null,
        authenticateIfNotLoggedIn: boolean
    ): Promise<RecordsEndpointInfo | null> {
        if (!endpoint) {
            endpoint = this._config.authOrigin;
            if (!endpoint) {
                return Promise.resolve(null);
            }
        }

        return this._getEndpointInfo(endpoint, authenticateIfNotLoggedIn);
    }

    private _getInfoFromEvent(
        event: {
            endpoint?: string;
        },
        authenticateIfNotLoggedIn: boolean
    ): Promise<RecordsEndpointInfo | null> {
        let endpoint: string = event.endpoint;
        return this.getInfoForEndpoint(endpoint, authenticateIfNotLoggedIn);
    }

    private async _publishUrl(
        recordsOrigin: string,
        path: string,
        queryParams: any = {}
    ): Promise<string> {
        let url = new URL(path, recordsOrigin);

        for (let key in queryParams) {
            const val = queryParams[key];
            if (hasValue(val)) {
                if (Array.isArray(val)) {
                    url.searchParams.set(key, val.join(','));
                } else {
                    url.searchParams.set(key, val as string);
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
