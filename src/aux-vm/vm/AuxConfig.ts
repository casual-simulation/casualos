import {
    AuxPartitionConfig,
    hasValue,
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
    StoredAuxVersion1,
} from '@casual-simulation/aux-common';
import { AuxDevice } from '@casual-simulation/aux-runtime';

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
     */
    causalRepoConnectionUrl?: string;

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

/**
 * Parses the given version number.
 * @param version The version number.
 */
export function parseVersionNumber(version: string) {
    if (!version) {
        return {
            version: null,
            major: null,
            minor: null,
            patch: null,
            alpha: null,
        };
    }
    const versionRegex = /^v(\d+)\.(\d+)\.(\d+)((\:|-)\w+\.?\d*)*$/i;
    const [str, major, minor, patch, prerelease] = versionRegex.exec(version);

    let alpha: boolean | number = false;
    if (hasValue(prerelease)) {
        alpha = true;
        const [first, number] = prerelease.split('.');
        if (hasValue(number)) {
            alpha = parseInt(number);
        }
    }

    return {
        version: str,
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch),
        alpha,
    };
}
