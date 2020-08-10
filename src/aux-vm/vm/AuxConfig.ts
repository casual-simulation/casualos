import { AuxPartitionConfig, AuxDevice } from '@casual-simulation/aux-common';

/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    config: AuxConfigParameters;

    /**
     * Defines the partitioning structure for bots.
     */
    partitions: AuxPartitionConfig;
}

export interface AuxConfigParameters {
    version: string;
    versionHash: string;
    builder?: string;
    device?: AuxDevice;

    /**
     * Whether to only allow compiling and runing scripts
     * that have valid signatures.
     */
    forceSignedScripts?: boolean;
}

export function buildVersionNumber(config: AuxConfigParameters) {
    if (!config) {
        return null;
    }
    return {
        hash: config.versionHash,
        ...parseVersionNumber(config.version),
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
        };
    }
    const versionRegex = /^v(\d+)\.(\d+)\.(\d+)$/i;
    const [str, major, minor, patch] = versionRegex.exec(version);

    return {
        version: str,
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch),
    };
}
