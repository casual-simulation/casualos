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
import { parseConnectionToken } from './ConnectionToken';

/**
 * Defines an interface that represents a connection indicator.
 * That is, the information that a client needs to establish a connection.
 */
export type ConnectionIndicator =
    | ConnectionIndicatorToken
    | ConnectionIndicatorId;

/**
 * Defines an interface that represents a connection token.
 */
export interface ConnectionIndicatorToken {
    /**
     * The connection token that should be used.
     */
    connectionToken: string;
}

/**
 * Defines an interface that represents a connection ID.
 */
export interface ConnectionIndicatorId {
    /**
     * The connection ID that should be used.
     */
    connectionId: string;
}

/**
 * Gets the connection ID for the given indicator.
 * @param indicator The indicator.
 */
export function getConnectionId(indicator: ConnectionIndicator) {
    if (!indicator) {
        return null;
    }
    if ('connectionToken' in indicator) {
        const parsed = parseConnectionToken(indicator.connectionToken);
        if (parsed) {
            return parsed[2];
        } else {
            return null;
        }
    } else {
        return indicator.connectionId;
    }
}
