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
import type { SubscriptionLike, Observable } from 'rxjs';
import type { TunnelRequest } from './ServerTunnelRequest';

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
    tunnelAccepted: Observable<TunnelRequest>;

    /**
     * Gets an observable which resolves whenever a tunnel is dropped.
     */
    tunnelDropped: Observable<TunnelRequest>;
}
