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
     * The port that the local device should listen on for connections.
     */
    localPort: number;

    /**
     * The port that the remote device should forward connections to.
     */
    remotePort: number;

    /**
     * The host that the remote device should forward connections to.
     */
    remoteHost: string;

    /**
     * Extra information to include in the request.
     */
    extra: any;
}

/**
 * Defines an interface for a request to open a tunnel that forwards requests from the remove device
 * to the local device.
 */
export interface ReverseTunnelRequest {
    direction: 'reverse';

    /**
     * The port that the local device should send connections to.
     */
    localPort: number;

    /**
     * The host that the local device should send connections to.
     */
    localHost: string;

    /**
     * The port that the remote device should listen on for connections.
     * Leave undefined/null to let the remote device automatically allocate a port.
     */
    remotePort?: number;

    /**
     * Extra information to include in the request.
     */
    extra: any;
}
