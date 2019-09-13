import { TunnelRequest } from './TunnelRequest';
import { Observable } from 'rxjs';
import { TunnelMessage } from './TunnelResponse';

/**
 * Defines a tunnel client. That is, a service that is able to route traffic from a remote endpoint to a local port.
 */
export interface TunnelClient {
    /**
     * Tries opening a tunnel using the given request.
     * Returns a cold observable attempts to connect upon subscription and disconnects
     * upon unsubscription.
     */
    open(request: TunnelRequest): Observable<TunnelMessage>;
}
