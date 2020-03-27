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
    tagsOnBot,
    isFormula,
    isScript,
} from '../bots';
import { Observable } from 'rxjs';
import { AuxCompiler } from './AuxCompiler';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime {
    private _originalState: BotsState = {};
    private _compiledState: CompiledBotsState = {};
    private _compiler = new AuxCompiler();

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

        for (let bot of bots) {
            // TODO: Make the compiled bot have a script variant
            //       for supporting writing to tags and such.
            let newBot: CompiledBot = {
                id: bot.id,
                precalculated: true,
                tags: bot.tags,
                listeners: {},
                formulas: {},
                values: {},
            };
            let precalculated: PrecalculatedBot = {
                id: bot.id,
                precalculated: true,
                tags: bot.tags,
                values: newBot.values,
            };

            for (let tag of tagsOnBot(bot)) {
                let value = bot.tags[tag];
                if (isFormula(value)) {
                    newBot.formulas[tag] = this.compile(newBot, tag, value);
                    value = newBot.formulas[tag]();
                } else if (isScript(value)) {
                    newBot.listeners[tag] = this.compile(newBot, tag, value);
                }

                newBot.values[tag] = value;
            }

            if (hasValue(bot.space)) {
                newBot.space = bot.space;
                precalculated.space = bot.space;
            }
            nextOriginalState[bot.id] = bot;
            update.state[bot.id] = precalculated;
            update.addedBots.push(bot.id);
        }

        this._originalState = nextOriginalState;

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

    compile(bot: CompiledBot, tag: string, script: string) {
        return this._compiler.compile(script, {
            // TODO: Support all the weird features
            context: {
                bot,
                tag,
            },
            variables: {
                this: ctx => ctx.bot,
                bot: ctx => ctx.bot,
            },
        });
    }
}

// Types of bots
// 1. Raw bot - original data
// 2. Script bot - data + compiled scripts
// 3. Precalculated bot - derived data

// Raw bot -> runtime bot -> precalculated bot

interface CompiledBotsState {
    [id: string]: CompiledBot;
}

interface CompiledBot extends PrecalculatedBot {
    listeners: {
        [tag: string]: () => any;
    };
    formulas: {
        [tag: string]: () => any;
    };
}
