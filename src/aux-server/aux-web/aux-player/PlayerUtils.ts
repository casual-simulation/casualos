import {
    AuxFile,
    FileCalculationContext,
    calculateFileValue,
    getFileConfigContexts,
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
    file: AuxFile,
    context: string,
    calc: FileCalculationContext
): PlayerContextSearchResult {
    const contexts = getFileConfigContexts(calc, file);
    return {
        playerContexts: contexts,
        matchFound: contexts.indexOf(context) >= 0,
    };
}
