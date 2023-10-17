import { ConnectionIndicator } from 'common';
import { initial } from 'lodash';
import { Observable, Subject, filter, merge } from 'rxjs';

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
                this._indicators.set(response.host, response.indicator);
            }
        });
    }

    /**
     * Gets the connection indicator that is currently stored for the given host.
     * @param host The host.
     * @returns Returns the connection indicator or null if none is stored.
     */
    getConnectionIndicatorForHost(host: string): ConnectionIndicator | null {
        return this._indicators.get(host) ?? null;
    }

    /**
     * Gets an observable that resolves when there is an auth response for the given host.
     * @param host The host.
     */
    onAuthResponseForHost(host: string): Observable<PartitionAuthResponse> {
        return this._onAuthResponse.pipe(
            filter((response) => response.host === host)
        );
    }

    /**
     * Sends a request for authentication information.
     * @param request The request that should be sent.
     */
    sendAuthRequest(request: PartitionAuthRequest): void {
        this._onAuthRequest.next(request);
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
     * The host for the partition.
     */
    host: string;
}

export type PartitionAuthResponse =
    | PartitionAuthResponseSuccess
    | PartitionAuthResponseFailure;

export interface PartitionAuthResponseBase {
    type: 'response';

    /**
     * The host for the partition.
     */
    host: string;
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
