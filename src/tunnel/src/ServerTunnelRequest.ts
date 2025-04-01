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

export type TunnelRequest =
    | ForwardTunnelRequest
    | ReverseTunnelRequest
    | ConnectTunnelRequest;

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

/**
 * Defines an interface for a request to connect to an existing session.
 */
export interface ConnectTunnelRequest {
    direction: 'connect';
    id: string;
}
