import { GameObject } from './GameObject';
import {
    Bot,
    BotCalculationContext,
    TagUpdatedEvent,
    hasValue,
    calculateBotValue,
    AuxDomain,
    getBotConfigContexts,
} from '@casual-simulation/aux-common';
import { difference, flatMap } from 'lodash';
import { Context3D } from './Context3D';
import { GridChecker } from './grid/GridChecker';
import { Object3D, Group } from 'three';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { Simulation3D } from './Simulation3D';

/**
 * Defines a class that represents a visualization of a context for the AUX Builder.
 *
 * Note that each aux bot gets its own builder context.
 * Whether or not anything is visualized in the context depends on the bot tags.
 */
export class ContextGroup3D extends GameObject {
    /**
     * The bot that this context represents.
     */
    bot: Bot;

    /**
     * The group that contains the contexts that this group is displaying.
     */
    display: Group;

    /**
     * The contexts that are represented by this builder context.
     */
    contexts: Map<string, Context3D>;

    /**
     * The domain that the group is for.
     */
    domain: AuxDomain;

    /**
     * The simulation the group is for.
     */
    simulation3D: Simulation3D;

    protected _childColliders: Object3D[];
    protected _decoratorFactory: AuxBot3DDecoratorFactory;

    /**
     * Gets the colliders that should be used for this context group.
     */
    get groupColliders() {
        return super.colliders;
    }

    /**
     * Sets the colliders that should be used for this context group.
     */
    set groupColliders(value: Object3D[]) {
        super.colliders = value;
    }

    get colliders() {
        return flatMap([this._childColliders, this.groupColliders]);
    }

    set colliders(value: Object3D[]) {
        this._childColliders = value;
    }

    /**
     * Creates a new Builder Context 3D Object.
     * @param The bot that this builder represents.
     */
    constructor(
        simulation3D: Simulation3D,
        bot: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxBot3DDecoratorFactory
    ) {
        super();
        this.simulation3D = simulation3D;
        this.domain = domain;
        this.bot = bot;
        this.display = new Group();
        this.contexts = new Map();
        this._decoratorFactory = decoratorFactory;

        this.add(this.display);
    }

    /**
     * Gets the bots that are contained by this builder context.
     */
    getBots() {
        return flatMap([...this.contexts.values()], c => [...c.bots.values()]);
    }

    frameUpdate(calc: BotCalculationContext) {
        this.contexts.forEach(context => {
            context.frameUpdate(calc);
        });
    }

    /**
     * Notifies the builder context that the given bot was added to the state.
     * @param bot The bot that was added.
     * @param calc The bot calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext) {
        if (bot.id === this.bot.id) {
            this.bot = bot;
            this._updateThis(bot, [], calc);
            this._updateContexts(bot, calc, true);
        }

        for (let [id, context] of this.contexts) {
            context.botAdded(bot, calc);
        }
    }

    /**
     * Notifies the builder context that the given bot was updated.
     * @param bot The bot that was updated.
     * @param updates The updates that happened on the bot.
     * @param calc The bot calculation context that should be used.
     */
    botUpdated(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        if (bot.id === this.bot.id) {
            this.bot = bot;
            this._updateThis(bot, updates, calc);
            this._updateContexts(bot, calc, false);
        }

        for (let [id, context] of this.contexts) {
            context.botUpdated(bot, updates, calc);
        }
    }

    /**
     * Notifies the builder context that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        this.contexts.forEach(context => {
            context.botRemoved(id, calc);
        });
    }

    dispose(): void {
        this.contexts.forEach(context => {
            context.dispose();
        });
    }

    /**
     * Updates the contexts that this context group should be displaying.
     * @param bot The context bot.
     * @param calc The bot calculation context that should be used.
     */
    private _updateContexts(
        bot: Bot,
        calc: BotCalculationContext,
        firstUpdate: boolean
    ) {
        const contexts = this._getContextsThatShouldBeDisplayed(bot, calc);
        // TODO: Handle scenarios where builder.context is empty or null
        if (contexts) {
            this._addContexts(bot, contexts, calc, firstUpdate);
        }
    }

    protected _getContextsThatShouldBeDisplayed(
        bot: Bot,
        calc: BotCalculationContext
    ): string[] {
        return getBotConfigContexts(calc, bot);
    }

    protected _updateThis(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        this.updateMatrixWorld(true);
    }

    private _addContexts(
        bot: Bot,
        newContexts: string | string[],
        calc: BotCalculationContext,
        firstUpdate: boolean
    ) {
        let contexts: string[];
        if (Array.isArray(newContexts)) {
            contexts = newContexts;
        } else if (typeof newContexts === 'string') {
            contexts = [newContexts];
        }

        if (contexts) {
            const currentContexts = this.currentContexts();
            const missingContexts = difference(contexts, currentContexts);
            const removedContexts = difference(currentContexts, contexts);
            const realNewContexts = missingContexts.map(c =>
                this._createContext3d(c)
            );

            realNewContexts.forEach(c => {
                // console.log(`[ContextGroup3D] Add context ${c.context} to group ${this.bot.id}.`);
                this.contexts.set(c.context, c);
                this.display.add(c);

                if (!firstUpdate) {
                    calc.objects.forEach(o => {
                        c.botAdded(o, calc);
                    });
                }
            });
            removedContexts.forEach(c => {
                // console.log(`[ContextGroup3D] Remove context ${c} from group ${this.bot.id}.`);
                const context = this.contexts.get(c);
                if (typeof context !== 'undefined') {
                    context.dispose();
                    this.contexts.delete(c);
                    this.display.remove(context);
                }
            });
        }
    }

    protected _createContext3d(context: string): Context3D {
        return new Context3D(
            context,
            this,
            this.domain,
            this._childColliders,
            this._decoratorFactory
        );
    }

    private currentContexts(): string[] {
        return [...this.contexts.keys()];
    }
}
