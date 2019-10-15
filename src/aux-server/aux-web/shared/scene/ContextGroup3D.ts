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
import { Object3D, Group } from 'three';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { Simulation3D } from './Simulation3D';
import { BotGameObject } from './BotGameObject';
import { AuxBot3D } from './AuxBot3D';

/**
 * Defines a class that represents a visualization of a context for the AUX Builder.
 *
 * Note that each aux bot gets its own builder context.
 * Whether or not anything is visualized in the context depends on the bot tags.
 */
export class ContextGroup3D extends GameObject implements BotGameObject {
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
    contexts: Set<string>;

    /**
     * The domain that the group is for.
     */
    domain: AuxDomain;

    /**
     * The simulation the group is for.
     */
    simulation3D: Simulation3D;

    /**
     * A map of contexts to a map of bot IDs to bots in the context group.
     */
    bots: Map<string, Map<string, AuxBot3D>>;

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

    get childColliders() {
        return this._childColliders;
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
        this.contexts = new Set();
        this.bots = new Map();
        this._decoratorFactory = decoratorFactory;

        this.add(this.display);
    }

    getBotsInContext(context: string): Map<string, AuxBot3D> {
        let map = this.bots.get(context);
        if (!map) {
            map = new Map();
            this.bots.set(context, map);
        }
        return map;
    }

    /**
     * Gets the bots that are contained by this builder context.
     */
    getBots() {
        return flatMap([...this.bots.values()].map(b => [...b.values()]));
    }

    frameUpdate(calc: BotCalculationContext) {
        // this.contexts.forEach(context => {
        //     context.frameUpdate(calc);
        // });
    }

    /**
     * Notifies the builder context that the given bot was added to the state.
     * @param bot The bot that was added.
     * @param calc The bot calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): ContextGroupUpdate {
        if (bot.id !== this.bot.id) {
            return null;
        }
        this.bot = bot;
        this._updateThis(bot, [], calc);
        return this._updateContexts(bot, calc, true);
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
    ): ContextGroupUpdate {
        if (bot.id !== this.bot.id) {
            return null;
        }
        this.bot = bot;
        this._updateThis(bot, updates, calc);
        return this._updateContexts(bot, calc, false);
    }

    /**
     * Notifies the builder context that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {}

    dispose(): void {}

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
            return this._addContexts(bot, contexts, calc, firstUpdate);
        }
        return {
            addedContexts: [],
            removedContexts: [],
        };
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
        newContexts: string[],
        calc: BotCalculationContext,
        firstUpdate: boolean
    ): ContextGroupUpdate {
        let contexts = newContexts || [];

        const currentContexts = this.currentContexts();
        const missingContexts = difference(contexts, currentContexts);
        const removedContexts = difference(currentContexts, contexts);

        for (let c of missingContexts) {
            this.contexts.add(c);
        }
        for (let c of removedContexts) {
            this.contexts.delete(c);
        }

        return {
            addedContexts: missingContexts,
            removedContexts: removedContexts,
        };
    }

    private currentContexts(): string[] {
        return [...this.contexts.keys()];
    }
}

export interface ContextGroupUpdate {
    addedContexts: string[];
    removedContexts: string[];
}
