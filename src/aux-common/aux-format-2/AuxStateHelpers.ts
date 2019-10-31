import {
    BotsState,
    PartialBotsState,
    Bot,
    PrecalculatedBotsState,
    PartialPrecalculatedBotsState,
    PrecalculatedBot,
} from '../bots/Bot';
import omitBy from 'lodash/omitBy';
import { merge } from '../utils';

/**
 * Applies the given update to the current state and returns the final result.
 * @param state The state.
 * @param update The update.
 */
export function apply(
    state: BotsState | PrecalculatedBotsState,
    update: PartialBotsState | PartialPrecalculatedBotsState
): BotsState {
    let updatedState = merge(state, update);

    for (let id in update) {
        let botUpdate: Partial<Bot> = update[id];
        if (!botUpdate) {
            delete updatedState[id];
            continue;
        }
        let bot = updatedState[id] as Bot | PrecalculatedBot;
        for (let tag in botUpdate.tags) {
            if (bot.tags[tag] === null) {
                delete bot.tags[tag];
                if ('values' in bot) {
                    delete bot.values[tag];
                }
            }
        }
    }

    return updatedState;
}
