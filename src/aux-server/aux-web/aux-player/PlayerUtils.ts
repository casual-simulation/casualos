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
