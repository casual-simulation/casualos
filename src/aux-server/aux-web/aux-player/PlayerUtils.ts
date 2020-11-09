import {
    Bot,
    BotCalculationContext,
    calculateBotValue,
    getBotConfigDimensions,
} from '@casual-simulation/aux-common';

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
