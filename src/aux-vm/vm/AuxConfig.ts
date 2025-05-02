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
    AuxPartitionConfig,
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
    StoredAuxVersion1,
} from '@casual-simulation/aux-common';
import { hasValue, parseVersionNumber } from '@casual-simulation/aux-common';
import type { AuxDevice } from '@casual-simulation/aux-runtime';

/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    /**
     * The ID of the config bot.
     */
    configBotId: string;

    /**
     * The configuration parameters for the simulation.
     */
    config: AuxConfigParameters;

    /**
     * Defines the partitioning structure for bots.
     */
    partitions: AuxPartitionConfig;
}

export interface AuxConfigParameters {
    version: string | null;
    versionHash: string | null;
    builder?: string;
    bootstrapState?: StoredAuxVersion1;
    device?: AuxDevice;

    /**
     * Whether to only allow compiling and runing scripts
     * that have valid signatures.
     */
    forceSignedScripts?: boolean;

    /**
     * Whether to run in debug mode.
     * This will likely cause more verbose console output.
     */
    debug?: boolean;

    /**
     * The connection protocol that causal repo partitions should use.
     */
    causalRepoConnectionProtocol?: RemoteCausalRepoProtocol;

    /**
     * The URL that causal repo partitions should connect to.
     * If omitted, then the URL origin will be used.
     */
    causalRepoConnectionUrl?: string;

    /**
     * Whether collaborative repositories should be persisted locally.
     * Defaults to false.
     */
    collaborativeRepLocalPersistence?: boolean;

    /**
     * Whether static repositories should be persisted locally.
     * Defaults to true.
     */
    staticRepoLocalPersistence?: boolean;

    /**
     * The version of the shared partitions that should be used.
     */
    sharedPartitionsVersion?: SharedPartitionsVersion;

    /**
     * The origin that the VM iframe should be loaded from.
     */
    vmOrigin?: string;

    /**
     * The origin that the Auth iframe should be loaded from.
     */
    authOrigin?: string;

    /**
     * The origin that the records API is hosted at.
     */
    recordsOrigin?: string;

    /**
     * The list of portal bots that should be automatically created
     * before the sync event is triggered.
     */
    builtinPortals?: string[];

    /**
     * The configuration needed to perform timesync for the simulation.
     */
    timesync?: AuxTimeSyncConfiguration;

    /**
     * Gets the player mode of this CasualOS version.
     *
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode?: 'player' | 'builder';

    /**
     * Whether privo login is required.
     */
    requirePrivoLogin?: boolean;

    /**
     * The comId that was specified when this config was created.
     */
    comId?: string;

    /**
     * Whether full support for the DOM should be enabled.
     * This will run the VM without the web worker so that scripts have direct access to the iframe.
     * May not be supported in all environments.
     * Defaults to false.
     */
    enableDom?: boolean;
}

export interface AuxTimeSyncConfiguration {
    /**
     * The host that timesync requests should be made to.
     */
    host?: string;

    /**
     * The protocol that should be used for time sync requests.
     */
    connectionProtocol?: TimeSyncProtocol;
}

export type TimeSyncProtocol = RemoteCausalRepoProtocol;

export function buildVersionNumber(config: AuxConfigParameters) {
    if (!config) {
        return null;
    }
    return {
        hash: config.versionHash,
        ...parseVersionNumber(config.version),
        playerMode: config.playerMode ?? 'builder',
    };
}
