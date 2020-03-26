// CasualOS has several key components:
//
// 1. Simulations - These are wrapper objects that manage creating and interfacing with AUX virtual machines.
// 2. VM - AUX Virtual Machines provide a security boundary to keep user scripts separate across multiple virtual machines.
// 3. Channel - These are manager objects which handle the persistence and runtime aspects of an AUX.
// 4. Partitions - These are services which manage the persistence and realtime sync of the AUX data model.
// 5. Runtimes - These are services which manage script execution and formula precalculation.

import {
    BotAction,
    StateUpdatedEvent,
    Bot,
    UpdatedBot,
    PrecalculatedBot,
    BotsState,
    PrecalculatedBotsState,
    hasValue,
} from '../bots';
import { Observable } from 'rxjs';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime {
    private _originalState: BotsState = {};
    private _compiledState: CompiledBotsState = {};
    private _precalculatedState: PrecalculatedBotsState = {};

    /**
     * An observable that resolves whenever the runtime issues an action.
     */
    onActions: Observable<BotAction[]>;

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * @param eventName The name of the event.
     * @param botIds The Bot IDs that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(eventName: string, botIds: string[], arg?: any): void {}

    /**
     * Executes the given script.
     * @param script The script to run.
     */
    execute(script: string): void {}

    /**
     * Signals to the runtime that the given bots were added.
     * @param bots The bots.
     */
    botsAdded(bots: Bot[]): StateUpdatedEvent {
        let update = {
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        } as StateUpdatedEvent;

        let nextOriginalState = Object.assign({}, this._originalState);
        let nextPrecalculatedState = Object.assign(
            {},
            this._precalculatedState
        );

        for (let bot of bots) {
            let newBot: PrecalculatedBot = {
                id: bot.id,
                precalculated: true,
                tags: bot.tags,
                values: bot.tags,
            };
            if (hasValue(bot.space)) {
                newBot.space = bot.space;
            }
            nextOriginalState[bot.id] = bot;
            nextPrecalculatedState[bot.id] = update.state[bot.id] = newBot;
            update.addedBots.push(bot.id);
        }

        this._originalState = nextOriginalState;
        this._precalculatedState = nextPrecalculatedState;

        return update;
    }

    /**
     * Signals to the runtime that the given bots were removed.
     * @param botIds The IDs of the bots that were removed.
     */
    botsRemoved(botIds: string[]): StateUpdatedEvent {
        return null;
    }

    /**
     * Signals to the runtime that the given bots were updated.
     * @param updates The bot updates.
     */
    botsUpdated(updates: UpdatedBot[]): StateUpdatedEvent {
        return null;
    }
}

// Types of bots
// 1. Raw bot - original data
// 2. Script bot - data + compiled scripts
// 3. Precalculated bot - derived data

// Raw bot -> runtime bot -> precalculated bot

interface CompiledBotsState {}
