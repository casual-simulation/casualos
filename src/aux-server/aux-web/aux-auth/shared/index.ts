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
import type { WebConfig, RemoteCausalRepoProtocol } from '@casual-simulation/aux-common';
import { tryParseJson } from '@casual-simulation/aux-common';
import { AuthManager } from './AuthManager';

declare const API_ENDPOINT: string;
declare const WEBSOCKET_ENDPOINT: string;
declare const WEBSOCKET_PROTOCOL: RemoteCausalRepoProtocol;
declare const GIT_TAG: string;

const injectedConfig = tryParseJson(
    document.querySelector('script#casualos-web-config')?.innerHTML
);
let authManager: AuthManager;
if (injectedConfig.success) {
    const config: WebConfig = injectedConfig.value;
    authManager = new AuthManager(
        config,
        GIT_TAG,
    );
} else {
    authManager = new AuthManager({
        version: 2,
        recordsOrigin: API_ENDPOINT,
        causalRepoConnectionUrl: WEBSOCKET_ENDPOINT,
        causalRepoConnectionProtocol: WEBSOCKET_PROTOCOL,
    },
        GIT_TAG
    );
}

export { authManager };
