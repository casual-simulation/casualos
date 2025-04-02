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

export type TunnelRequest = ForwardTunnelRequest | ReverseTunnelRequest;

/**
 * Defines an interface for a request to open a tunnel that forwards requests from the local
 * device to the remote device.
 */
export interface ForwardTunnelRequest {
    direction: 'forward';

    /**
     * The token to use for the request.
     */
    token: string;

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
}

/**
 * Defines an interface for a request to open a tunnel that forwards requests from the remove device
 * to the local device.
 */
export interface ReverseTunnelRequest {
    direction: 'reverse';

    /**
     * The token to use for the request.
     */
    token: string;

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
}
