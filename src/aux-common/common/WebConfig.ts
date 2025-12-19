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
import type {
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
} from '../partitions';
import { z } from 'zod';

/**
 * The possible BIOS options.
 *
 * - "enter join code" indicates that the user should be prompted to enter a join code.
 * - "temp" indicates that a temporary instance should be created (no persistence).
 * - "static inst", "local inst", and "local" indicates that the instance should be loaded statically.
 * - "public inst", "free inst", and "free" indicates that the instance should be loaded from the public partition.
 * - "private inst", "studio inst", "studio", and "locked" indicates that the instance should be loaded from the private partition.
 * - "sign in" indicates that the user should be prompted to sign in.
 * - "sign up" indicates that the user should be prompted to sign up.
 * - "sign out" indicates that the user should be logged out.
 */
export type BiosOption =
    | 'enter join code'
    | 'join inst'
    | 'temp'
    | 'static inst'
    | 'local inst'
    | 'local'
    | 'public inst'
    | 'free inst'
    | 'free'
    | 'private inst'
    | 'studio inst'
    | 'studio'
    | 'locked'
    | 'sign in'
    | 'sign up'
    | 'sign out'
    | 'delete inst';

export const BIOS_OPTION_SCHEMA = z.enum([
    'enter join code',
    'join inst',
    'temp',
    'static inst',
    'local inst',
    'local',
    'public inst',
    'free inst',
    'free',
    'private inst',
    'studio inst',
    'studio',
    'locked',
    'sign in',
    'sign up',
    'sign out',
    'delete inst',
]);

/**
 * Defines an interface for the configuration that the web client should try to pull from the server.
 */
export interface WebConfig {
    /**
     * The protocol version.
     */
    version: 1 | 2 | null;

    /**
     * The protocol that should be used for realtime connections.
     */
    causalRepoConnectionProtocol: RemoteCausalRepoProtocol;

    /**
     * The URL that should be used for realtime connections.
     */
    causalRepoConnectionUrl?: string | null;

    /**
     * Whether collaborative repositories should be persisted locally.
     * Defaults to false.
     */
    collaborativeRepoLocalPersistence?: boolean;

    /**
     * Whether static repositories should be persisted locally.
     * Defaults to true.
     */
    staticRepoLocalPersistence?: boolean;

    /**
     * The version of the shared partitions that should be used.
     */
    sharedPartitionsVersion?: SharedPartitionsVersion | null;

    /**
     * The HTTP Origin that should be used for VM Iframes.
     */
    vmOrigin?: string | null;

    /**
     * Whether to disable the VM entirely.
     *
     * This is primarily for custom domains and enabling full PWA support.
     *
     * Defaults to false.
     */
    disableVm?: boolean;

    /**
     * The HTTP origin that should be used for auth iframes.
     */
    authOrigin?: string | null;

    /**
     * The HTTP origin that should be used for records.
     */
    recordsOrigin?: string | null;

    /**
     * Whether collaboration should be disabled.
     * Setting this to true will replace the shared partition of simulations
     * with tempLocal partitions.
     */
    disableCollaboration?: boolean | null;

    /**
     * The URL that should be used to bootstrap AB1.
     */
    ab1BootstrapURL?: string | null;

    /**
     * Whether the server should inject the AB1 Bootstrap script via a script tag.
     */
    serverInjectBootstrapper?: boolean;

    /**
     * The API key that should be used for the ArcGIS mapping API.
     */
    arcGisApiKey?: string | null;

    /**
     * The app name that should be used for the Jitsi meet portal.
     */
    jitsiAppName?: string | null;

    /**
     * The API Key that should be used for what3words integration.
     */
    what3WordsApiKey?: string | null;

    /**
     * Gets the player mode of this CasualOS version.
     *
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode?: 'player' | 'builder' | null;

    /**
     * Whether to require that users login with Privo before they can access collaboration features.
     */
    requirePrivoLogin?: boolean;

    /**
     * The allowed BIOS options.
     * If omitted, then all options are allowed.
     *
     * Possible options are:
     * - "enter join code"
     * - "static inst"
     * - "public inst"
     * - "private inst"
     * - "sign in"
     * - "sign up"
     * - "sign out"
     */
    allowedBiosOptions?: BiosOption[];

    /**
     * The default BIOS option.
     * If specified, then the BIOS will automatically select this option when shown.
     */
    defaultBiosOption?: BiosOption;

    /**
     * The automatic BIOS option.
     * If specified, then the BIOS will automatically execute this option.
     */
    automaticBiosOption?: BiosOption;

    /**
     * The instance ID to use when executing the automatic BIOS option.
     *
     * Should be formatted as `{recordName/{instName}`. For local/public insts, recordName can be omitted (e.g. `/{instName}`).
     */
    automaticBiosOptionInst?: string | null;

    /**
     * Whether full support for the DOM should be enabled.
     * This will run the VM without the web worker so that scripts have direct access to the iframe.
     * May not be supported in all environments.
     * Requires a separate VM origin for security purposes.
     * Defaults to false.
     */
    enableDom?: boolean;

    /**
     * Whether to enable debug mode for the VM.
     */
    debug?: boolean;

    /**
     * The URL of the logo to display in the loading screen.
     */
    logoUrl?: string | null;

    /**
     * The title of the logo to display in the loading screen.
     */
    logoTitle?: string | null;

    /**
     * The background color of the logo to display in the loading screen.
     * This is used to set the background color of the splash screen.
     */
    logoBackgroundColor?: string | null;

    /**
     * The URL that users can visit for support.
     */
    supportUrl?: string | null;

    /**
     * Whether to enable SMS authentication.
     * Defaults to false.
     */
    enableSmsAuthentication?: boolean;

    icons?: {
        favicon?: string | null;
        appleTouchIcon?: string | null;
    };
}

/**
 * The configuration interface that extends the web config with computed options.
 */
export interface CasualOSConfig extends WebConfig {
    /**
     * Whether subscriptions are supported in this configuration.
     */
    subscriptionsSupported: boolean;

    /**
     * Whether studios are supported in this configuration.
     */
    studiosSupported: boolean;

    /**
     * The comID that was used to load this configuration.
     */
    comId?: string | null;
}

export const WEB_CONFIG_SCHEMA = z.object({
    causalRepoConnectionProtocol: z
        .enum(['websocket', 'apiary-aws'])
        .prefault('websocket'),
    causalRepoConnectionUrl: z.string().min(1).max(512).optional(),
    collaborativeRepoLocalPersistence: z.boolean().prefault(false),
    staticRepoLocalPersistence: z.boolean().prefault(true),
    sharedPartitionsVersion: z.enum(['v2']).prefault('v2'),
    vmOrigin: z.string().min(1).max(128).nullable().optional(),
    disableVM: z.boolean().nullable().optional(),
    authOrigin: z.string().min(1).max(128).nullable().optional(),
    recordsOrigin: z.string().min(1).max(128).nullable().optional(),
    disableCollaboration: z.boolean().nullable().optional(),
    ab1BootstrapURL: z.string().min(1).max(512).nullable().optional(),
    serverInjectBootstrapper: z.boolean().nullable().optional(),
    arcGisApiKey: z.string().min(1).max(128).nullable().optional(),
    jitsiAppName: z.string().min(1).max(128).nullable().optional(),
    what3WordsApiKey: z.string().min(1).max(128).nullable().optional(),
    playerMode: z.enum(['player', 'builder']).nullable().optional(),
    requirePrivoLogin: z.boolean().prefault(false),
    allowedBiosOptions: z.array(BIOS_OPTION_SCHEMA).nullable().optional(),
    defaultBiosOption: BIOS_OPTION_SCHEMA.nullable().optional(),
    automaticBiosOption: BIOS_OPTION_SCHEMA.nullable().optional(),
    automaticBiosOptionInst: z
        .string()
        .nonempty()
        .nullable()
        .optional()
        .describe(
            'The instance ID to use when executing the automatic BIOS option. Should be formatted as `{recordName/{instName}`. For local/public insts, recordName can be omitted (e.g. `/{instName}`).'
        ),
    enableDom: z.boolean().prefault(false),
    debug: z.boolean().prefault(false),

    enableSmsAuthentication: z.boolean().nullable().optional(),

    logoUrl: z
        .string()
        .min(1)
        .max(512)
        .nullable()
        .optional()
        .describe('The URL of the logo to display in the loading screen.'),
    logoBackgroundColor: z
        .string()
        .min(1)
        .max(32)
        .nullable()
        .optional()
        .describe(
            'The background color of the logo to display in the loading screen. This is used to set the background color of the splash screen.'
        ),
    logoTitle: z
        .string()
        .min(1)
        .max(128)
        .nullable()
        .optional()
        .describe(
            'The title text that accompanies the logo in the loading screen.'
        ),

    icons: z
        .object({
            favicon: z
                .string()
                .nonempty()
                .nullable()
                .optional()
                .describe(
                    'The favicon that should be served for the web client. If not specified, a default favicon will be used. Should be 48x48 px and utilize transparency.'
                ),
            appleTouchIcon: z
                .string()
                .nonempty()
                .nullable()
                .optional()
                .describe(
                    'The apple touch icon that should be used for the web client. If not specified, a default apple touch icon will be used. Should be 180x180 px and not use transparency (background should be a solid color).'
                ),
        })
        .nullable()
        .optional()
        .describe('The set of icons that should be used for the web client.'),

    supportUrl: z.string().min(1).nullable().optional(),
});

export function parseWebConfig(
    config: any,
    defaultConfig: WebConfig
): WebConfig {
    if (config) {
        const result = WEB_CONFIG_SCHEMA.safeParse(config);
        if (result.success) {
            return result.data as WebConfig;
        } else {
            console.error('[WebConfig] Invalid web config', result);
        }
    }
    return defaultConfig;
}
