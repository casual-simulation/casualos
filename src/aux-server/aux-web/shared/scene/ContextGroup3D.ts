import { GameObject, IGameObject } from './GameObject';
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
import { AuxBot3D } from './AuxBot3D';
import { ContextGroupUpdate, ContextGroup } from './ContextGroup';
import { AuxBotVisualizer } from './AuxBotVisualizer';
import { ContextGroupHelper } from './ContextGroupHelper';

/**
 * Defines a class that represents a visualization of a context for the AUX Builder.
 *
 * Note that each aux bot gets its own builder context.
 * Whether or not anything is visualized in the context depends on the bot tags.
 */
export class ContextGroup3D extends GameObject implements ContextGroup {
    private _helper: ContextGroupHelper<AuxBot3D>;

    /**
     * The group that contains the contexts that this group is displaying.
     */
    display: Group;

    /**
     * The domain that the group is for.
     */
    domain: AuxDomain;

    simulation3D: Simulation3D;

    get bot() {
        return this._helper.bot;
    }

    get bots() {
        return this._helper.bots;
    }

    get contexts() {
        return this._helper.contexts;
    }

    protected _childColliders: Object3D[];
    protected _decoratorFactory: AuxBot3DDecoratorFactory;
    protected _colliders: Object3D[];

    /**
     * Gets the colliders that should be used for this context group.
     */
    get groupColliders() {
        return this._colliders;
    }

    /**
     * Sets the colliders that should be used for this context group.
     */
    set groupColliders(value: Object3D[]) {
        this._colliders = value;
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
        this._helper = new ContextGroupHelper<AuxBot3D>(bot, (calc, bot) =>
            getBotConfigContexts(calc, bot)
        );
        this.domain = domain;
        this.display = new Group();
        this._decoratorFactory = decoratorFactory;

        this.add(this.display);
    }

    hasBotInContext(context: string, id: string): boolean {
        return this._helper.hasBotInContext(context, id);
    }

    getBotInContext(context: string, id: string): AuxBotVisualizer {
        return this._helper.getBotInContext(context, id);
    }

    addBotToContext(context: string, bot: Bot): AuxBotVisualizer {
        const mesh = new AuxBot3D(
            bot,
            this,
            context,
            this.childColliders,
            this._decoratorFactory
        );
        this._helper.addBotToContext(context, bot, mesh);
        const bots = this.getBotsInContext(context);

        this.display.add(mesh);
        bots.set(bot.id, mesh);

        return mesh;
    }

    removeBotFromContext(context: string, bot: AuxBotVisualizer): void {
        if (!(bot instanceof AuxBot3D)) {
            return;
        }
        const bots = this.getBotsInContext(context);
        bots.delete(bot.bot.id);
        this.display.remove(bot);
    }

    getBotsInContext(context: string): Map<string, AuxBot3D> {
        return this._helper.getBotsInContext(context);
    }

    /**
     * Gets the bots that are contained by this builder context.
     */
    getBots() {
        return flatMap([...this.bots.values()].map(b => [...b.values()]));
    }

    /**
     * Notifies the builder context that the given bot was added to the state.
     * @param bot The bot that was added.
     * @param calc The bot calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): ContextGroupUpdate {
        const updates = this._helper.botAdded(bot, calc);
        if (updates) {
            this._updateThis(bot, [], calc);
        }

        return updates;
    }

    /**
     * Notifies the builder context that the given bot was updated.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated on the bot.
     * @param calc The bot calculation context that should be used.
     */
    botUpdated(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ): ContextGroupUpdate {
        const updates = this._helper.botUpdated(bot, tags, calc);
        if (updates) {
            this._updateThis(bot, [], calc);
            for (let removed of updates.removedBots) {
                if (removed instanceof AuxBot3D) {
                    this.display.remove(removed);
                }
            }
        }
        return updates;
    }

    /**
     * Notifies the builder context that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        return this._helper.botRemoved(id, calc);
    }

    dispose(): void {}

    protected _getContextsThatShouldBeDisplayed(
        bot: Bot,
        calc: BotCalculationContext
    ): string[] {
        return getBotConfigContexts(calc, bot);
    }

    protected _updateThis(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ) {
        this.updateMatrixWorld(true);
    }
}
