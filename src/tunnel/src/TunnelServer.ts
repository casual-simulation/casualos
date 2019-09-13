import { SubscriptionLike, Observable } from 'rxjs';
import { TunnelRequest } from './ServerTunnelRequest';

export type TunnelRequestMapper = (request: TunnelRequest) => TunnelRequest;
export type TunnelRequestFilter = (request: TunnelRequest) => boolean;

/**
 * Defines an interface for a service that is able to accept requests to open a tunnel.
 */
export interface TunnelServer extends SubscriptionLike {
    /**
     * Gets or sets a filter function that can be used to
     * pre-process tunnel requests before they are evaluated.
     */
    requestMapper: TunnelRequestMapper;

    /**
     * Gets or sets a filter function that can be used to accept and reject tunnel requests.
     */
    acceptTunnel: TunnelRequestFilter;

    /**
     * Starts listening for connections.
     */
    listen(): void;

    /**
     * Gets an observable which resolves whenever a new tunnel is accepted and
     * configured by the server.
     */
    // tunnelAccepted: Observable<TunnelRequest>;
}
