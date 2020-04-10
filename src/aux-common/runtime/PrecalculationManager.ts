import { DependencyManager, BotDependentInfo } from './DependencyManager';
import mapValues from 'lodash/mapValues';
import omitBy from 'lodash/omitBy';
import {
    PrecalculatedBotsState,
    BotsState,
    BotSandboxContext,
    StateUpdatedEvent,
    calculateCopiableValue,
    Bot,
    PrecalculatedBot,
    UpdatedBot,
    hasValue,
    calculateValue,
    convertToCopiableValue,
} from '../bots';
import { merge } from '../utils';

/**
 * Defines a class that manages precalculating bot state.
 */
export class PrecalculationManager {
    private _dependencies: DependencyManager;
    private _currentState: PrecalculatedBotsState;
    private _stateGetter: () => BotsState;
    private _contextFactory: () => BotSandboxContext;

    /**
     * Whether errors from formulas should be logged.
     */
    logFormulaErrors: boolean = false;

    constructor(
        stateGetter: () => BotsState,
        contextFactory: () => BotSandboxContext
    ) {
        this._stateGetter = stateGetter;
        this._contextFactory = contextFactory;
        this._currentState = {};
        this._dependencies = new DependencyManager();
    }

    get dependencies(): DependencyManager {
        return this._dependencies;
    }

    get botsState() {
        return this._currentState;
    }

    botsAdded(bots: Bot[]): StateUpdatedEvent {
        const updated = this._dependencies.addBots(bots);
        const context = this._contextFactory();

        let nextState: Partial<PrecalculatedBotsState> = {};

        for (let bot of bots) {
            let newBot: PrecalculatedBot = {
                id: bot.id,
                precalculated: true,
                tags: bot.tags,
                values: mapValues(bot.tags, (value, tag) =>
                    calculateCopiableValue(context, bot, tag, value)
                ),
            };

            if (bot.space) {
                newBot.space = bot.space;
            }
            nextState[bot.id] = newBot;
        }

        this._updateBots(updated, context, nextState);

        this._currentState = omitBy(
            merge(this._currentState, nextState),
            val => val === null
        );

        return {
            state: nextState,
            addedBots: bots.map(f => f.id),
            removedBots: [],
            updatedBots: Object.keys(updated),
        };
    }

    botsRemoved(botIds: string[]): StateUpdatedEvent {
        const updated = this._dependencies.removeBots(botIds);
        const context = this._contextFactory();

        let nextState: Partial<PrecalculatedBotsState> = {};
        for (let botId of botIds) {
            nextState[botId] = null;
        }

        this._updateBots(updated, context, nextState);

        this._currentState = omitBy(
            merge(this._currentState, nextState),
            val => val === null
        );

        return {
            state: nextState,
            addedBots: [],
            removedBots: botIds,
            updatedBots: Object.keys(updated),
        };
    }

    botsUpdated(updates: UpdatedBot[]): StateUpdatedEvent {
        const updated = this._dependencies.updateBots(updates);
        const context = this._contextFactory();

        let nextState: Partial<PrecalculatedBotsState> = {};

        for (let update of updates) {
            let nextUpdate = (nextState[update.bot.id] = <PrecalculatedBot>{
                tags: {},
                values: {},
            });
            for (let tag of update.tags) {
                nextUpdate.tags[tag] = update.bot.tags[tag];
            }
        }

        this._updateBots(updated, context, nextState);

        this._currentState = omitBy(
            merge(this._currentState, nextState),
            val => val === null
        );

        return {
            state: nextState,
            addedBots: [],
            removedBots: [],
            updatedBots: Object.keys(updated),
        };
    }

    private _updateBots(
        updated: BotDependentInfo,
        context: BotSandboxContext,
        nextState: Partial<PrecalculatedBotsState>
    ) {
        const originalState = this._stateGetter();
        for (let botId in updated) {
            const originalBot = originalState[botId];
            if (!originalBot) {
                continue;
            }
            let update: Partial<PrecalculatedBot> = nextState[botId];
            if (!update) {
                update = {
                    values: {},
                };
            }
            const tags = updated[botId];
            for (let tag of tags) {
                const originalTag = originalBot.tags[tag];
                if (hasValue(originalTag)) {
                    try {
                        const value = calculateValue(
                            context,
                            originalBot,
                            tag,
                            originalTag
                        );
                        if (this.logFormulaErrors && value instanceof Error) {
                            console.error('[PrecalculationManager]', value);
                        }
                        update.values[tag] = convertToCopiableValue(value);
                    } catch (value) {
                        if (this.logFormulaErrors && value instanceof Error) {
                            console.error('[PrecalculationManager]', value);
                        }
                        update.values[tag] = convertToCopiableValue(value);
                    }
                } else {
                    update.tags[tag] = null;
                    update.values[tag] = null;
                }
            }
            nextState[botId] = <PrecalculatedBot>update;
        }
    }
}
