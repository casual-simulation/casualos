import { WebsocketErrorCode } from '../websockets';
import { ConnectionIndicator, DenialReason } from '../common';
import { Observable, Subject, filter, first, merge } from 'rxjs';

/**
 * Defines an interface that is able to provide events for when authentication information is requested or provided to partitions.
 */
export class PartitionAuthSource {
    private _onAuthRequest: Subject<PartitionAuthRequest> = new Subject();
    private _onAuthResponse: Subject<PartitionAuthResponse> = new Subject();
    private _indicators: Map<string, ConnectionIndicator> = new Map();
    private _promises: Map<string, Promise<PartitionAuthResponse>> = new Map();

    /**
     * Gets an observable for when a partition requests or provides authentication information.
     */
    get onAuthMessage(): Observable<PartitionAuthMessage> {
        return merge(this._onAuthRequest, this._onAuthResponse);
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
                        next: (r) => {
                            this._promises.delete(key);
                            resolve(r);
                        },
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
}

export type PartitionAuthMessage = PartitionAuthRequest | PartitionAuthResponse;

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
