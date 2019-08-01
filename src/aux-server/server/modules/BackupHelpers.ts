import {
    filesInContext,
    getFileChannel,
    FileCalculationContext,
} from '@casual-simulation/aux-common';

/**
 * Gets the list of channel IDs that are loaded.
 * @param calc
 */
export function getChannelIds(calc: FileCalculationContext): string[] {
    const files = filesInContext(calc, 'aux.channels');
    const channels = files
        .map(f => getFileChannel(calc, f))
        .filter(channel => channel);
    const channelsSet = new Set([...channels, 'admin']);
    return [...channelsSet].map(c => `aux-${c}`);
}
