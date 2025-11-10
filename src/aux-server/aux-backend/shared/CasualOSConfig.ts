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
import {
    WEB_CONFIG_SCHEMA,
    type WebConfig,
} from '@casual-simulation/aux-common/common/WebConfig';
import {
    serverConfigSchema,
    type ServerConfig,
} from '@casual-simulation/aux-records';
import { z } from 'zod';

export const DRIVES_URL = '/drives';

/**
 * The configuration schema needed to run a CasualOS server.
 */
export const casualosConfigSchema = z.object({
    ...serverConfigSchema.shape,
    app: z
        .object({
            enabled: z
                .boolean()
                .describe(
                    'Whether serving the CasualOS apps should be enabled.'
                )
                .default(true),

            tls: z
                .object({
                    key: z
                        .string()
                        .describe('The TLS private key(s) in PEM format.'),
                    cert: z
                        .string()
                        .describe('The TLS certificate chains in PEM format.'),
                })
                .describe(
                    'The TLS configuration for the CasualOS app. If not provided, then TLS will not be used.'
                )
                .optional(),

            proxy: z
                .object({
                    trust: z
                        .string()
                        .describe(
                            'The IP Address range of proxies that should be trusted.'
                        )
                        .optional(),
                })
                .describe('The proxy configuration for the CasualOS app.')
                .optional(),

            debug: z
                .boolean()
                .describe(
                    'Whether to enable debug logging for the CasualOS app.'
                )
                .default(false),

            frontendPort: z
                .number()
                .describe(
                    'The port that the CasualOS app frontend should listen on.'
                )
                .default(3000),

            backendPort: z
                .number()
                .describe(
                    'The port that the CasualOS app backend API should listen on.'
                )
                .default(3002),

            webConfig: WEB_CONFIG_SCHEMA.describe(
                'The web configuration for the CasualOS frontend.'
            ).default({
                causalRepoConnectionProtocol: 'websocket',
                collaborativeRepoLocalPersistence: true,
                staticRepoLocalPersistence: true,
                sharedPartitionsVersion: 'v2',
                vmOrigin: null,
                authOrigin: null,
                recordsOrigin: null,
                disableCollaboration: null,
                ab1BootstrapURL: null,
                arcGisApiKey: null,
                jitsiAppName:
                    'vpaas-magic-cookie-332b53bd630448a18fcb3be9740f2caf',
                what3WordsApiKey: null,
                playerMode: 'player',
                requirePrivoLogin: false,
                allowedBiosOptions: null,
                defaultBiosOption: null,
                automaticBiosOption: null,
            }),

            drives: z
                .object({
                    dirs: z
                        .array(z.string())
                        .describe(
                            'The list of extra directories that should be served by the CasualOS app on the /drives path.'
                        ),

                    path: z
                        .string()
                        .describe(
                            'The base path that drives should be served from.'
                        )
                        .default('/drives'),
                })
                .optional(),
        })
        .describe('The configuration for the CasualOS app.')
        .default({
            enabled: false,
        }),
});

export type CasualOSConfig = z.infer<typeof casualosConfigSchema>;

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
