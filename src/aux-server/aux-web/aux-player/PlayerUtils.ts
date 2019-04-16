
import {
    AuxFile,
    FileCalculationContext,
    calculateFileValue
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

export function doesFileDefinePlayerContext(file: AuxFile, context: string, calc: FileCalculationContext): PlayerContextSearchResult {
    let result: PlayerContextSearchResult = {
        matchFound: false,
        playerContexts: undefined
    };

    if (!!file.tags[`aux.player.context`]) {
        // This file defines a player context. But does it match the user's current context?
        const contextValue = calculateFileValue(calc, file, `aux.player.context`);
        result.playerContexts = [];
        if (Array.isArray(contextValue)) {
            result.playerContexts = contextValue;
        } else if (typeof contextValue === 'string') {
            result.playerContexts = [contextValue];
        }
    
        // Now that we have an array of defined player context values from the file, check if the user's current context is one of them.
        result.matchFound = result.playerContexts.indexOf(context) != -1;
    }

    return result;
}