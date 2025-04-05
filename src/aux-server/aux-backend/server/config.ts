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
import type { WebConfig } from '@casual-simulation/aux-common/common/WebConfig';
import type { ServerConfig } from '@casual-simulation/aux-records';

export const DRIVES_URL = '/drives';

/**
 * The server config.
 */
export interface Config {
    /**
     * The config for the collaboration features of the server.
     */
    collaboration: {
        httpPort: number;
        player: ClientConfig;
        dist: string;
        drives: string;
        tls: TLSOptions | null;
        proxy: ProxyConfig;

        /**
         * Whether to enable debug logging.
         */
        debug: boolean;
    };

    /**
     * The options for the backend API.
     */
    backend: {
        httpPort: number;
        dist: string;
        config: ServerConfig;
    };
}

export type SandboxType = 'none' | 'deno';

export interface TLSOptions {
    key: string;
    cert: string;
}

export interface ClientConfig {
    index: string;
    manifest: string;
    web: WebConfig;
}

export interface DirectoryConfig {
    server: DirectoryServerConfig | null;
    client: DirectoryClientConfig | null;

    dbName: string;
}

export interface DirectoryServerConfig {
    /**
     * The secret that should be used for signing/verifying tokens.
     */
    secret: string;

    /**
     * The URL that webhooks should be sent to.
     */
    webhook: string | null;
}

export interface DirectoryClientConfig {
    /**
     * The base address of the directory that this AUXPlayer should upload its data to.
     */
    upstream: string;

    /**
     * The base address of the tunnel server that the AUXPlayer should connect to.
     */
    tunnel: string | null;

    /**
     * The local IP Address that the directory client should use.
     * If not provided, then the client will determine the local IP from the attached network interfaces.
     */
    ipAddress?: string;
}

/**
 * The proxy config.
 */
export interface ProxyConfig {
    /**
     * The IP Address range of proxies that should be trusted.
     */
    trust: string;
}
