import { GameObject } from './GameObject';
import {
    Bot,
    BotCalculationContext,
    calculateBotValue,
    TagUpdatedEvent,
    AuxDomain,
    isBotInContext,
    getBotConfigContexts,
    isConfigForContext,
    GLOBALS_BOT_ID,
} from '@casual-simulation/aux-common';
import { Object3D, SceneUtils } from 'three';
import { AuxBot3D } from './AuxBot3D';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';

/**
 * Defines a class that represents the visualization of a context.
 */
export class Context3D extends GameObject {
    static debug: boolean = false;

    /**
     * The context that this object represents.
     */
    context: string;

    /**
     * The domain this object is in.
     */
    domain: AuxDomain;

    /**
     * The bots that are in this context.
     */
    bots: Map<string, AuxBot3D>;

    /**
     * The group that this context belongs to.
     */
    contextGroup: ContextGroup3D;

    private _decoratorFactory: AuxBot3DDecoratorFactory;

    /**
     * Creates a new context which represents a grouping of bots.
     * @param context The tag that this context represents.
     * @param colliders The array that new colliders should be added to.
     */
    constructor(
        context: string,
        group: ContextGroup3D,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxBot3DDecoratorFactory
    ) {
        super();
        this.context = context;
        this.colliders = colliders;
        this.domain = domain;
        this.contextGroup = group;
        this.bots = new Map();
        this._decoratorFactory = decoratorFactory;
    }

    /**
     * Notifies this context that the given bot was added to the state.
     * @param bot The bot.
     * @param calc The calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext) {
        const isInContext3D = this.bots.has(bot.id);
        const isInContext = isBotInContext(calc, bot, this.context);

        if (!isInContext3D && isInContext) {
            this._addBot(bot, calc);
        }
    }

    /**
     * Notifies this context that the given bot was updated.
     * @param bot The bot.
     * @param updates The changes made to the bot.
     * @param calc The calculation context that should be used.
     */
    botUpdated(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        const isInContext3D = this.bots.has(bot.id);
        const isInContext = isBotInContext(calc, bot, this.context);

        if (!isInContext3D && isInContext) {
            this._addBot(bot, calc);
        } else if (isInContext3D && !isInContext) {
            this._removeBot(bot.id, calc);
        } else if (isInContext3D && isInContext) {
            this._updateBot(bot, updates, calc);
        }
    }

    /**
     * Notifies this context that the given bot was removed from the state.
     * @param bot The ID of the bot that was removed.
     * @param calc The calculation context.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        this._removeBot(id, calc);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this.bots) {
            this.bots.forEach(f => f.frameUpdate(calc));
        }
    }

    dispose(): void {
        if (this.bots) {
            this.bots.forEach(f => {
                f.dispose();
            });
        }
    }

    protected _addBot(bot: Bot, calc: BotCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Add', bot.id, 'to context', this.context);
        }
        const mesh = new AuxBot3D(
            bot,
            this.contextGroup,
            this.context,
            this.domain,
            this.colliders,
            this._decoratorFactory
        );
        this.bots.set(bot.id, mesh);
        this.add(mesh);

        mesh.botUpdated(bot, [], calc);

        // need to fire update twice as it sometimes doesn't update the bot decorator the first time.
        // mesh.botUpdated(bot, [], calc);
    }

    protected _removeBot(id: string, calc: BotCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Remove', id, 'from context', this.context);
        }
        const bot = this.bots.get(id);
        if (typeof bot !== 'undefined') {
            bot.botRemoved(calc);
            bot.dispose();
            this.remove(bot);
            this.bots.delete(id);
        }
    }

    protected _updateBot(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        let mesh = this.bots.get(bot.id);
        mesh.botUpdated(bot, updates, calc);
    }
}
