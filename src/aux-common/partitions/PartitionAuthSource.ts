import { ConnectionIndicator } from 'common';
import { initial } from 'lodash';
import { resolve } from 'path';
import { Observable, Subject, filter, first, merge } from 'rxjs';

/**
 * Defines an interface that is able to provide events for when authentication information is requested or provided to partitions.
 */
export class PartitionAuthSource {
    private _onAuthRequest: Subject<PartitionAuthRequest> = new Subject();
    private _onAuthResponse: Subject<PartitionAuthResponse> = new Subject();
    private _indicators: Map<string, ConnectionIndicator> = new Map();

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
        return new Promise<PartitionAuthResponse>((resolve, reject) => {
            this._onAuthResponse
                .pipe(first((r) => r.origin === request.origin))
                .subscribe({
                    next: (r) => resolve(r),
                    error: (err) => reject(err),
                });
            this._onAuthRequest.next(request);
        });
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
     * The origin for the partition.
     */
    origin: string;
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
