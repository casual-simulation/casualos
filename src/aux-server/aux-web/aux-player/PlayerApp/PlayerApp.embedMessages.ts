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

/**
 * Determines whether the given message event should be forwarded to bots as an `onEmbedMessage` shout.
 *
 * Only messages that were posted directly by the actual parent window are forwarded. This excludes
 * messages from the auth iframe (and its origin), since that channel can carry sensitive auth data,
 * as well as any other iframe that CasualOS embeds internally (e.g. the VM iframe).
 *
 * @param event The message event that was received.
 * @param parentWindow The `window.parent` of the current window.
 * @param isEmbedded Whether the current window is embedded in an iframe.
 * @param authOrigin The origin of the auth site, if configured.
 */
export function shouldForwardEmbedMessage(
    event: { source: unknown; origin: string },
    parentWindow: unknown,
    isEmbedded: boolean,
    authOrigin: string | null | undefined
): boolean {
    if (!isEmbedded) {
        return false;
    }
    if (event.source !== parentWindow) {
        return false;
    }
    if (authOrigin && event.origin === authOrigin) {
        return false;
    }
    return true;
}
