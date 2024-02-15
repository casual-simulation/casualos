import {
    Bot,
    BotCalculationContext,
    calculateBotValue,
    getBotConfigDimensions,
} from '@casual-simulation/aux-common';
import { sortBy } from 'lodash';

interface PlayerContextSearchResult {
    /**
     * Is there a matching player dimension?
     */
    matchFound: boolean;

    /**
     * All player dimensions found during the search.
     */
    playerDimensions: string[];
}

export function doesBotDefinePlayerDimension(
    bot: Bot,
    dimension: string,
    calc: BotCalculationContext
): PlayerContextSearchResult {
    const dimensions = getBotConfigDimensions(calc, bot);
    return {
        playerDimensions: dimensions,
        matchFound: dimensions.indexOf(dimension) >= 0,
    };
}

/**
 * Safely parses the given URL.
 * If the given URL is invalid, null will be returned. Otherwise, the parsed URL object will be returned.
 * @param url The URL to parse.
 */
export function safeParseURL(url: string): URL {
    try {
        return new URL(url);
    } catch (err) {
        return null;
    }
}

/**
 * Sorts the given insts in the order that they should be stored in the inst tag.
 * @param insts The instance or instances.
 * @param currentInst The instance that the tag is being stored in.
 */
export function sortInsts<T extends string | string[]>(
    insts: T,
    currentInst: string
): T {
    if (Array.isArray(insts)) {
        return sortBy(insts, (i) => i !== currentInst) as T;
    } else {
        return insts;
    }
}
