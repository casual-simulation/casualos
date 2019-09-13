/**
 * Defines an interface for a request to open a tunnel.
 */
export type TunnelRequest = ForwardTunnelRequest | ReverseTunnelRequest;

/**
 * Defines an interface for a request to open a tunnel that forwards requests from the local
 * device to the remote device.
 */
export interface ForwardTunnelRequest {
    direction: 'forward';

    /**
     * The authorization information to use for the request.
     */
    authorization: string;

    /**
     * The hostname that the request was made to.
     */
    hostname: string;

    /**
     * The host that the client wants traffic forwarded to.
     */
    forwardHost: string;

    /**
     * The port that the client wants traffic forwarded to.
     */
    forwardPort: number;
}

/**
 * Defines an interface for a request to open a tunnel that forwards requests from the remove device
 * to the local device.
 */
export interface ReverseTunnelRequest {
    direction: 'reverse';

    /**
     * The authorization information to use for the request.
     */
    authorization: string;

    /**
     * The hostname that the request was made to.
     */
    hostname: string;

    /**
     * The port that the client wants traffic forwarded from.
     */
    localPort: number;
}
