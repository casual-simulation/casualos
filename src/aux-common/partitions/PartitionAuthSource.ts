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
import type { WebsocketErrorCode } from '../websockets';
import type {
    ActionKinds,
    AuthorizeActionMissingPermission,
    ConnectionIndicator,
    DenialReason,
    PublicUserInfo,
    ResourceKinds,
    SubjectType,
} from '../common';
import type { Observable } from 'rxjs';
import { Subject, filter, first, merge } from 'rxjs';
import type { NotAuthorizedError, ServerError } from '../Errors';

/**
 * Defines an interface that is able to provide events for when authentication information is requested or provided to partitions.
 */
export class PartitionAuthSource {
    private _onAuthRequest: Subject<PartitionAuthRequest> = new Subject();
    private _onAuthResponse: Subject<PartitionAuthResponse> = new Subject();
    private _onAuthPermissionRequest: Subject<PartitionAuthRequestPermission> =
        new Subject();
    private _onAuthPermissionResult: Subject<PartitionAuthPermissionResult> =
        new Subject();
    private _onAuthExternalPermissionRequest: Subject<PartitionAuthExternalRequestPermission> =
        new Subject();
    private _onAuthExternalPermissionResult: Subject<PartitionAuthExternalPermissionResult> =
        new Subject();
    private _indicators: Map<string, ConnectionIndicator> = new Map();
    private _promises: Map<string, Promise<PartitionAuthResponse>> = new Map();

    /**
     * Gets an observable for when a partition requests or provides authentication information.
     */
    get onAuthMessage(): Observable<PartitionAuthMessage> {
        return merge(
            this._onAuthRequest,
            this._onAuthResponse,
            this._onAuthPermissionRequest,
            this._onAuthPermissionResult,
            this._onAuthExternalPermissionRequest,
            this._onAuthExternalPermissionResult
        );
    }

    /**
     * Gets an observable for when a partition requests permission.
     */
    get onAuthPermissionRequest(): Observable<PartitionAuthRequestPermission> {
        return this._onAuthPermissionRequest;
    }

    /**
     * Gets an observable for when a partition provides permission result.
     */
    get onAuthPermissionResult(): Observable<PartitionAuthPermissionResult> {
        return this._onAuthPermissionResult;
    }

    /**
     * Gets an observable for when an external permissions request is recieved.
     */
    get onAuthExternalPermissionRequest(): Observable<PartitionAuthExternalRequestPermission> {
        return this._onAuthExternalPermissionRequest;
    }

    /**
     * Gets an observable for when an external permissions result is recieved.
     */
    get onAuthExternalPermissionResult(): Observable<PartitionAuthExternalPermissionResult> {
        return this._onAuthExternalPermissionResult;
    }

    /**
     * Gets an observable for when a partition requests authentication information.
     */
    get onAuthRequest(): Observable<PartitionAuthRequest> {
        return this._onAuthRequest;
    }

    /**
     * Gets an observable for when auth information should be provided to a partition.
     */
    get onAuthResponse(): Observable<PartitionAuthResponse> {
        return this._onAuthResponse;
    }

    constructor(initialIndicators?: Map<string, ConnectionIndicator>) {
        if (initialIndicators) {
            this._indicators = new Map(initialIndicators);
        }
        this._onAuthResponse.subscribe((response) => {
            if (response.success) {
                this._indicators.set(response.origin, response.indicator);
            }
        });
    }

    /**
     * Gets the connection indicator that is currently stored for the given origin.
     * @param origin The origin.
     * @returns Returns the connection indicator or null if none is stored.
     */
    getConnectionIndicatorForOrigin(
        origin: string
    ): ConnectionIndicator | null {
        return this._indicators.get(origin) ?? null;
    }

    /**
     * Gets an observable that resolves when there is an auth response for the given HTTP origin.
     * @param origin The origin.
     */
    onAuthResponseForOrigin(origin: string): Observable<PartitionAuthResponse> {
        return this._onAuthResponse.pipe(
            filter((response) => response.origin === origin)
        );
    }

    /**
     * Sends a request for authentication information. Returns an observable that resolves with the first response for the origin.
     * @param request The request that should be sent.
     */
    sendAuthRequest(
        request: PartitionAuthRequest
    ): Promise<PartitionAuthResponse> {
        const key = `${request.origin}:${request.kind}:${request.errorCode}:${request.resource?.recordName}:${request.resource?.inst}}`;

        if (this._promises.has(key)) {
            return this._promises.get(key);
        }

        const promise = new Promise<PartitionAuthResponse>(
            (resolve, reject) => {
                this._onAuthResponse
                    .pipe(first((r) => r.origin === request.origin))
                    .subscribe({
                        next: (r) => resolve(r),
                        error: (err) => {
                            this._promises.delete(key);
                            reject(err);
                        },
                    });
                this._onAuthRequest.next(request);
            }
        );
        this._promises.set(key, promise);
        return promise;
    }

    /**
     * Sends a response for authentication information.
     * @param response The response that should be sent.
     */
    sendAuthResponse(response: PartitionAuthResponse): void {
        this._onAuthResponse.next(response);
    }

    /**
     * Sends the given request for permission.
     * @param request The request.
     */
    sendAuthPermissionRequest(request: PartitionAuthRequestPermission): void {
        this._onAuthPermissionRequest.next(request);
    }

    /**
     * Sends the given permission result.
     * @param result The result.
     */
    sendAuthPermissionResult(result: PartitionAuthPermissionResult): void {
        this._onAuthPermissionResult.next(result);
    }

    /**
     * Sends the given request for permission.
     * @param request The request.
     */
    sendAuthExternalPermissionRequest(
        request: PartitionAuthExternalRequestPermission
    ): void {
        this._onAuthExternalPermissionRequest.next(request);
    }

    /**
     * Sends the given permission result.
     * @param result The result.
     */
    sendAuthExternalPermissionResult(
        result: PartitionAuthExternalPermissionResult
    ): void {
        this._onAuthExternalPermissionResult.next(result);
    }

    /**
     * Sends the given auth message.
     * @param message The message that should be sent.
     */
    sendAuthMessage(message: PartitionAuthMessage): void {
        if (message.type === 'response') {
            this.sendAuthResponse(message);
        } else if (message.type === 'request') {
            this.sendAuthRequest(message);
        } else if (message.type === 'permission_request') {
            this.sendAuthPermissionRequest(message);
        } else if (message.type === 'permission_result') {
            this.sendAuthPermissionResult(message);
        } else if (message.type === 'external_permission_request') {
            this.sendAuthExternalPermissionRequest(message);
        } else if (message.type === 'external_permission_result') {
            this.sendAuthExternalPermissionResult(message);
        }
    }
}

export type PartitionAuthMessage =
    | PartitionAuthRequest
    | PartitionAuthResponse
    | PartitionAuthRequestPermission
    | PartitionAuthPermissionResult
    | PartitionAuthExternalRequestPermission
    | PartitionAuthExternalPermissionResult;

export interface PartitionAuthRequest {
    type: 'request';

    /**
     * The HTTP origin for the partition.
     */
    origin: string;

    /**
     * The kind of the request.
     * - "need_indicator" means that the partition does not have an indicator and needs one in order to login.
     * - "invalid_indicator" means that the partition has an indicator and tried to connect, but the indicator was rejected upon login.
     * - "not_authorized" means that the partition has an indicator logged in, but was rejected when trying to access a resource.
     */
    kind: 'need_indicator' | 'invalid_indicator' | 'not_authorized';

    /**
     * The error code that occurred.
     */
    errorCode?: WebsocketErrorCode;

    /**
     * The error message that ocurred.
     */
    errorMessage?: string;

    /**
     * The indicator that was used to connect.
     */
    indicator?: ConnectionIndicator;

    /**
     * The denial reason. Only present if the kind is "not_authorized".
     */
    reason?: DenialReason;

    /**
     * The resource that the denial occurred for.
     */
    resource?: PartitionResource;
}

export type PartitionResource = PartitionInstResource;

export interface PartitionInstResource {
    type: 'inst';

    /**
     * The name of the record.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The branch that is being loaded.
     */
    branch: string;
}

export type PartitionAuthResponse =
    | PartitionAuthResponseSuccess
    | PartitionAuthResponseFailure;

export interface PartitionAuthResponseBase {
    type: 'response';

    /**
     * The origin for the partition.
     */
    origin: string;
}

export interface PartitionAuthResponseSuccess
    extends PartitionAuthResponseBase {
    success: true;

    /**
     * The connection indicator that should be used.
     */
    indicator: ConnectionIndicator;
}

export interface PartitionAuthResponseFailure
    extends PartitionAuthResponseBase {
    success: false;
}

export interface PartitionAuthRequestPermission {
    type: 'permission_request';

    /**
     * The origin for the partition.
     */
    origin: string;

    /**
     * The reason why permission is being requested.
     */
    reason: AuthorizeActionMissingPermission;
}

export type PartitionAuthPermissionResult =
    | PartitionAuthPermissionResultSuccess
    | PartitionAuthPermissionResultFailure;

export interface PartitionAuthPermissionResultSuccess {
    type: 'permission_result';
    success: true;
    origin: string;

    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    subjectType: SubjectType;
    subjectId: string;

    /**
     * The actions that were authorized.
     * If null or undefined, then all action kinds were authorized.
     */
    actions?: ActionKinds[];
}

export interface PartitionAuthPermissionResultFailure {
    type: 'permission_result';
    success: false;
    origin: string;

    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    subjectType: SubjectType;
    subjectId: string;

    errorCode: NotAuthorizedError | ServerError | WebsocketErrorCode;
    errorMessage: string;
}

export interface PartitionAuthExternalRequestPermission {
    type: 'external_permission_request';

    /**
     * The origin for the partition.
     */
    origin: string;

    /**
     * The reason why permission is being requested.
     */
    reason: AuthorizeActionMissingPermission;

    /**
     * The information about the user that is requesting the permission.
     */
    user: PublicUserInfo | null;
}

export type PartitionAuthExternalPermissionResult =
    | PartitionAuthExternalPermissionResultSuccess
    | PartitionAuthExternalPermissionResultFailure;

export interface PartitionAuthExternalPermissionResultSuccess {
    type: 'external_permission_result';
    success: true;
    origin: string;

    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    subjectType: SubjectType;
    subjectId: string;

    /**
     * The actions that were authorized.
     * If null or undefined, then all action kinds were authorized.
     */
    actions?: ActionKinds[];
}

export interface PartitionAuthExternalPermissionResultFailure {
    type: 'external_permission_result';
    success: false;
    origin: string;

    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    subjectType: SubjectType;
    subjectId: string;

    errorCode: NotAuthorizedError | ServerError | WebsocketErrorCode;
    errorMessage: string;
}
