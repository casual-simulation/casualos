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
import { fromBase64String, toBase64String } from '../utils';

/**
 * Formats the given user ID, session ID, connection ID, record name, inst, and hash into a token.
 * @param userId The ID of the user.
 * @param sessionId The ID of the session.
 * @param connectionId The ID of the connection.
 * @param recordName The name of the record that the connection is for.
 * @param inst The ID of the instance that the connection is for.
 * @param hash The hash that was generated.
 */
export function formatV1ConnectionToken(
    userId: string,
    sessionId: string,
    connectionId: string,
    recordName: string,
    inst: string,
    hash: string
): string {
    return `vCT1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(connectionId)}.${toBase64String(
        recordName
    )}.${toBase64String(inst)}.${toBase64String(hash)}`;
}

/**
 * Parses the given connection token into a user ID, session ID, connection ID, inst, and hash array.
 * Returns null if the key cannot be parsed.
 * @param token The token to parse.
 */
export function parseConnectionToken(
    token: string | null
): [
    userId: string,
    sessionId: string,
    connectionId: string,
    recordName: string,
    inst: string,
    hash: string
] {
    return parseV1ConnectionToken(token);
}

/**
 * Parses the given connection token into a user ID, session ID, hash, connection ID, and device ID array.
 * Returns null if the key cannot be parsed or if it is not a V1 token.
 * @param token The token to parse.
 */
export function parseV1ConnectionToken(
    token: string
): [
    userId: string,
    sessionId: string,
    connectionId: string,
    recordName: string,
    inst: string,
    hash: string
] {
    if (!token) {
        return null;
    }

    if (!token.startsWith('vCT1.')) {
        return null;
    }

    const withoutVersion = token.slice('vCT1.'.length);
    let periodAfterUserId = withoutVersion.indexOf('.');
    if (periodAfterUserId < 0) {
        return null;
    }

    const userIdBase64 = withoutVersion.slice(0, periodAfterUserId);
    const sessionIdPlusConnectionId = withoutVersion.slice(
        periodAfterUserId + 1
    );

    if (userIdBase64.length <= 0 || sessionIdPlusConnectionId.length <= 0) {
        return null;
    }

    const periodAfterSessionId = sessionIdPlusConnectionId.indexOf('.');
    if (periodAfterSessionId < 0) {
        return null;
    }

    const sessionIdBase64 = sessionIdPlusConnectionId.slice(
        0,
        periodAfterSessionId
    );
    const connectionIdPlusExtra = sessionIdPlusConnectionId.slice(
        periodAfterSessionId + 1
    );

    if (sessionIdBase64.length <= 0 || connectionIdPlusExtra.length <= 0) {
        return null;
    }

    const periodAfterConnectionId = connectionIdPlusExtra.indexOf('.');
    if (periodAfterConnectionId < 0) {
        return null;
    }

    const connectionIdBase64 = connectionIdPlusExtra.slice(
        0,
        periodAfterConnectionId
    );
    const recordNamePlusExtra = connectionIdPlusExtra.slice(
        periodAfterConnectionId + 1
    );

    if (connectionIdBase64.length <= 0 || recordNamePlusExtra.length <= 0) {
        return null;
    }

    const periodAfterRecordName = recordNamePlusExtra.indexOf('.');
    if (periodAfterRecordName < 0) {
        return null;
    }
    const recordNameBase64 = recordNamePlusExtra.slice(
        0,
        periodAfterRecordName
    );
    const instPlusHash = recordNamePlusExtra.slice(periodAfterRecordName + 1);

    if (instPlusHash.length <= 0) {
        return null;
    }

    const periodAfterInst = instPlusHash.indexOf('.');

    if (periodAfterInst < 0) {
        return null;
    }

    const instBase64 = instPlusHash.slice(0, periodAfterInst);
    const hashBase64 = instPlusHash.slice(periodAfterInst + 1);

    if (hashBase64.length <= 0 || instBase64.length <= 0) {
        return null;
    }

    try {
        const userId = fromBase64String(userIdBase64);
        const sessionId = fromBase64String(sessionIdBase64);
        const connectionId = fromBase64String(connectionIdBase64);
        const recordName =
            recordNameBase64.length <= 0
                ? null
                : fromBase64String(recordNameBase64);
        const inst = fromBase64String(instBase64);
        const hash = fromBase64String(hashBase64);

        return [userId, sessionId, connectionId, recordName, inst, hash];
    } catch (err) {
        return null;
    }
}
