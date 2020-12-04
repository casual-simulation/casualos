import { GameObject, IGameObject } from './GameObject';
import {
    Bot,
    BotCalculationContext,
    TagUpdatedEvent,
    hasValue,
    calculateBotValue,
    AuxDomain,
    getBotConfigDimensions,
} from '@casual-simulation/aux-common';
import flatMap from 'lodash/flatMap';
import { Object3D, Group } from 'three';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { Simulation3D } from './Simulation3D';
import { AuxBot3D } from './AuxBot3D';
import { DimensionGroup } from './DimensionGroup';
import { AuxBotVisualizer } from './AuxBotVisualizer';
import { DimensionGroupHelper } from './DimensionGroupHelper';

/**
 * Defines a class that represents a visualization of a dimension for the AUX Builder.
 *
 * Note that each aux bot gets its own builder dimension.
 * Whether or not anything is visualized in the dimension depends on the bot tags.
 */
export class DimensionGroup3D extends GameObject implements DimensionGroup {
    private _helper: DimensionGroupHelper<AuxBot3D>;

    /**
     * The group that contains the dimensions that this group is displaying.
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

    get dimensions() {
        return this._helper.dimensions;
    }

    protected _childColliders: Object3D[];
    protected _decoratorFactory: AuxBot3DDecoratorFactory;
    protected _groupColliders: Object3D[];
    protected _portalTag: string;

    /**
     * Gets the colliders that should be used for this dimension group.
     */
    get groupColliders() {
        return this._groupColliders;
    }

    /**
     * Sets the colliders that should be used for this dimension group.
     */
    set groupColliders(value: Object3D[]) {
        this._groupColliders = value;
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

    get portalTag() {
        return this._portalTag;
    }

    /**
     * Creates a new Builder dimension 3D Object.
     * @param The bot that this builder represents.
     */
    constructor(
        simulation3D: Simulation3D,
        bot: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxBot3DDecoratorFactory,
        portalTag: string
    ) {
        super();
        this.simulation3D = simulation3D;
        this._helper = new DimensionGroupHelper<AuxBot3D>(bot);
        this.domain = domain;
        this.display = new Group();
        this._decoratorFactory = decoratorFactory;
        this._portalTag = portalTag;

        this.add(this.display);
    }

    addDimension(dimension: string): void {
        this._helper.addDimension(dimension);
    }

    removeDimension(dimension: string): AuxBotVisualizer[] {
        const bots = this._helper.removeDimension(dimension);
        for (let bot of bots) {
            this.removeBotFromDimension(dimension, bot);
        }
        return bots;
    }

    hasBotInDimension(dimension: string, id: string): boolean {
        return this._helper.hasBotInDimension(dimension, id);
    }

    getBotInDimension(dimension: string, id: string): AuxBotVisualizer {
        return this._helper.getBotInDimension(dimension, id);
    }

    addBotToDimension(dimension: string, bot: Bot): AuxBotVisualizer {
        const mesh = new AuxBot3D(
            bot,
            this,
            dimension,
            this.childColliders,
            this._decoratorFactory
        );
        this._helper.addBotToDimension(dimension, bot, mesh);
        const bots = this.getBotsInDimension(dimension);

        mesh.setParent(this);
        bots.set(bot.id, mesh);

        return mesh;
    }

    removeBotFromDimension(dimension: string, bot: AuxBotVisualizer): void {
        if (!(bot instanceof AuxBot3D)) {
            return;
        }
        const bots = this.getBotsInDimension(dimension);
        bots.delete(bot.bot.id);
        this.display.remove(bot);
    }

    getBotsInDimension(dimension: string): Map<string, AuxBot3D> {
        return this._helper.getBotsInDimension(dimension);
    }

    /**
     * Gets the bots that are contained by this builder dimension.
     */
    getBots() {
        return flatMap([...this.bots.values()].map((b) => [...b.values()]));
    }

    /**
     * Notifies the builder dimension that the given bot was added to the state.
     * @param bot The bot that was added.
     * @param calc The bot calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): void {
        this._helper.botAdded(bot, calc);
        if (bot.id === this.bot.id) {
            this._updateThis(bot, [], calc);
        }
    }

    /**
     * Notifies the builder dimension that the given bot was updated.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated on the bot.
     * @param calc The bot calculation context that should be used.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext): void {
        this._helper.botUpdated(bot, tags, calc);
        if (bot.id === this.bot.id) {
            this._updateThis(bot, [], calc);
        }
    }

    /**
     * Notifies the builder dimension that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        return this._helper.botRemoved(id, calc);
    }

    dispose(): void {}

    protected _updateThis(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ) {
        this.updateMatrixWorld(true);
    }
}
