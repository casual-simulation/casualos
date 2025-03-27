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
import type { ServerError } from '@casual-simulation/aux-common/Errors';

export type IssueMeetTokenResult =
    | IssueMeetTokenSuccess
    | IssueMeetTokenFailure;

/**
 * Defines an interface that represents a successful "Issue meet token" result.
 */
export interface IssueMeetTokenSuccess {
    success: true;

    /**
     * The name of the room.
     */
    roomName: string;

    /**
     * The token that can be used to access the room.
     */
    token: string;

    /**
     * The URL that the meeting should connect to.
     */
    url: string;
}

export interface IssueMeetTokenFailure {
    success: false;
    errorCode:
        | ServerError
        | 'not_supported'
        | 'invalid_room_name'
        | 'invalid_username';
    errorMessage: string;
}
