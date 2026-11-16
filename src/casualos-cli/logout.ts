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
import type { createRecordsClient } from '@casual-simulation/aux-records/RecordsClient';

/** Revoke the saved session before clearing credentials and ending provider SSO. */
export async function logoutSession(
    client: Pick<ReturnType<typeof createRecordsClient>, 'revokeSession'>,
    sessionKey: string | null,
    clearSession: () => void,
    openProviderLogout: (url: string) => Promise<void>
): Promise<void> {
    if (!sessionKey) {
        clearSession();
        return;
    }
    let result;
    try {
        result = await client.revokeSession({ sessionKey }, { sessionKey });
    } catch {
        throw new Error(
            'Could not revoke the session. Your saved login was retained so you can retry logout.'
        );
    }
    if (!result.success) {
        throw new Error(
            'Could not revoke the session. Your saved login was retained so you can retry logout.'
        );
    }
    clearSession();
    if (result.logoutUrl) {
        try {
            await openProviderLogout(result.logoutUrl);
        } catch {
            throw new Error(
                'The CasualOS session was revoked, but the provider logout page could not be opened. Sign out of the provider in your browser.'
            );
        }
    }
}
