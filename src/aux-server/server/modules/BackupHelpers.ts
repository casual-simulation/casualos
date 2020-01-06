import {
    botsInDimension,
    getBotChannel,
    BotCalculationContext,
} from '@casual-simulation/aux-common';

/**
 * Gets the list of channel IDs that are loaded.
 * @param calc
 */
export function getChannelIds(calc: BotCalculationContext): string[] {
    const bots = botsInDimension(calc, 'aux.channels');
    const channels = bots
        .map(f => getBotChannel(calc, f))
        .filter(channel => channel);
    const channelsSet = new Set([...channels, 'admin']);
    return [...channelsSet].map(c => `aux-${c}`);
}
