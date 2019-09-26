import {
    Bot,
    BotCalculationContext,
    calculateBotValue,
    getBotConfigContexts,
} from '@casual-simulation/aux-common';

interface PlayerContextSearchResult {
    /**
     * Is there a matching player context?
     */
    matchFound: boolean;

    /**
     * All player contexts found during the search.
     */
    playerContexts: string[];
}

export function doesFileDefinePlayerContext(
    file: Bot,
    context: string,
    calc: BotCalculationContext
): PlayerContextSearchResult {
    const contexts = getBotConfigContexts(calc, file);
    return {
        playerContexts: contexts,
        matchFound: contexts.indexOf(context) >= 0,
    };
}
