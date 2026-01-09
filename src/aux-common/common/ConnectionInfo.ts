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
import { memoize } from 'es-toolkit';
import { z } from 'zod';

export interface ConnectionInfo {
    /**
     * The ID of the connection.
     */
    connectionId: string;

    /**
     * The ID of the session.
     */
    sessionId: string | null;

    /**
     * The ID of the user that is associated with the connection.
     */
    userId: string | null;
}
export const connectionInfoSchema = memoize(() =>
    z.object({
        connectionId: z.string(),
        sessionId: z.string(),
        userId: z.string(),
    })
);
type ZodConnectionInfo = z.infer<ReturnType<typeof connectionInfoSchema>>;
type ZodConnectionInfoAssertion = HasType<ZodConnectionInfo, ConnectionInfo>;

export function connectionInfo(
    userId: string,
    sessionId: string,
    connectionId: string
): ConnectionInfo {
    return {
        userId,
        sessionId,
        connectionId,
    };
}

type HasType<T, Q extends T> = Q;
