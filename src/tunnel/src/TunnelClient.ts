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
import type { TunnelRequest } from './ClientTunnelRequest';
import type { Observable } from 'rxjs';
import type { TunnelMessage } from './TunnelResponse';

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
