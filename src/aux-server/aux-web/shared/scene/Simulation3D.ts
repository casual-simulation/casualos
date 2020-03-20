import { Object3D, Texture, Color, Vector2 } from 'three';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    Bot,
    BotCalculationContext,
    hasValue,
    PrecalculatedBot,
    GLOBALS_BOT_ID,
    BotIndexEvent,
} from '@casual-simulation/aux-common';
import { SubscriptionLike, Subject, Observable } from 'rxjs';
import { tap, startWith } from 'rxjs/operators';
import flatMap from 'lodash/flatMap';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { CameraRig } from './CameraRigFactory';
import { Game } from './Game';
import { AuxBotVisualizerFinder } from '../AuxBotVisualizerFinder';
import { AuxBotVisualizer } from './AuxBotVisualizer';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import {
    UpdatedBotInfo,
    BotDimensionsUpdate,
    DimensionAddedEvent,
    DimensionRemovedEvent,
    BotAddedToDimensionEvent,
    BotRemovedFromDimensionEvent,
    BotDimensionEvent,
} from '@casual-simulation/aux-vm';
import { DimensionGroup } from './DimensionGroup';
import { DimensionGroup3D } from './DimensionGroup3D';
import { AuxBot3D } from './AuxBot3D';
import { PortalConfig } from 'aux-web/aux-player/scene/PortalConfig';

/**
 * Defines a class that is able to render a simulation.
 */
export abstract class Simulation3D extends Object3D
    implements SubscriptionLike, AuxBotVisualizerFinder {
    protected _subs: SubscriptionLike[];

    /**
     * The game view.
     */
    protected _game: Game;

    closed: boolean;

    /**
     * Gets an observable that resolves whenever a dimension group is added.
     */
    get onDimensionGroupAdded(): Observable<DimensionGroup> {
        return this._onDimensionGroupAdded.pipe(startWith(...this.dimensions));
    }

    /**
     * Gets an observable that resolves whenever a dimension group is removed.
     */
    get onDimensionGroupRemoved(): Observable<DimensionGroup> {
        return this._onDimensionGroupRemoved;
    }

    onBotAdded: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotUpdated: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotRemoved: ArgEvent<Bot> = new ArgEvent<Bot>();

    /**
     * The list of dimensions that are being rendered in the simulation.
     */
    dimensions: DimensionGroup[];

    /**
     * The simulation that this object is rendering.
     */
    simulation: BrowserSimulation;

    /**
     * The map of dimension names to the groups they belong in.
     */
    private _dimensionMap: Map<string, DimensionGroup[]>;

    /**
     * A map of bot Ids to their dimension group 3D object.
     */
    private _dimensionGroups: Map<string, DimensionGroup>;

    /**
     * A map of "{botId}-{dimensionTag}" to their dimension group 3D object.
     */
    private _dimensionTagsMap: Map<string, DimensionGroup>;

    /**
     * A map of bot Ids to their bots.
     */
    private _botMap: Map<string, AuxBotVisualizer[]>;
    private _currentContext: BotCalculationContext;
    private _onDimensionGroupAdded = new Subject<DimensionGroup>();
    private _onDimensionGroupRemoved = new Subject<DimensionGroup>();

    private _decoratorFactory: AuxBot3DDecoratorFactory;
    private _sceneBackground: Color | Texture = null;
    private _updateList: Set<string> = new Set();
    private _updatedList: Set<string> = new Set();
    private isLoaded: boolean = false;

    /**
     * Gets the list of bots that are in this simulation.
     */
    get bots() {
        return flatMap([...this._botMap.values()]);
    }

    /**
     * Gets the game view that is for this simulation.
     */
    get game() {
        return this._game;
    }

    /**
     * Gets the background color for the simulation.
     */
    get backgroundColor(): Color | Texture {
        return this._sceneBackground;
    }

    get decoratorFactory() {
        return this._decoratorFactory;
    }

    /**
     * Creates a new Simulation3D object that can be used to render the given simulation.
     * @param game The game.
     * @param simulation The simulation to render.
     */
    constructor(game: Game, simulation: BrowserSimulation) {
        super();
        this._game = game;
        this.simulation = simulation;
        this.dimensions = [];
        this._subs = [];
        this._decoratorFactory = new AuxBot3DDecoratorFactory(game, this);
        this._dimensionMap = new Map();
        this._dimensionGroups = new Map();
        this._dimensionTagsMap = new Map();
        this._botMap = new Map();
    }

    /**
     * Initializes the simulation 3D.
     */
    init() {
        this.isLoaded = false;

        this._subs.push(
            this.simulation.localEvents
                .pipe(
                    tap(e => {
                        if (e.type === 'tween_to') {
                            const foundBotIn3D =
                                this.findBotsById(e.botId).length > 0;
                            if (foundBotIn3D) {
                                this.game.tweenCameraToBot(
                                    this.getMainCameraRig(),
                                    e.botId,
                                    e.zoomValue,
                                    e.rotationValue
                                        ? new Vector2(
                                              e.rotationValue.x,
                                              e.rotationValue.y
                                          )
                                        : undefined,
                                    e.duration
                                );
                            }
                        }
                    })
                )
                .subscribe()
        );

        this._subs.push(
            this.simulation.dimensions
                .watchDimensions(...this._getDimensionTags())
                .pipe(tap(update => this._dimensionsUpdated(update)))
                .subscribe(null, err => console.log(err))
        );

        // Subscriptions to bot events.
        this._subs.push(
            this.simulation.watcher.botsDiscovered
                .pipe(tap(bot => this._botsAdded(bot)))
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher.botsRemoved
                .pipe(tap(bot => this._botsRemoved(bot)))
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher.botTagsUpdated
                .pipe(tap(update => this._botsUpdated(update, false)))
                .subscribe()
        );

        this._subs.push(
            this.simulation.watcher
                .botChanged(GLOBALS_BOT_ID)
                .pipe(
                    tap(bot => {
                        // Scene background color.
                        let sceneBackgroundColor = bot.tags['auxUniverseColor'];
                        this._sceneBackground = hasValue(sceneBackgroundColor)
                            ? new Color(sceneBackgroundColor)
                            : null;
                    })
                )
                .subscribe()
        );
    }

    /**
     * Gets the dimension group for the given bot ID and portal tag.
     * @param botId The ID of the bot that is defining the portal.
     * @param portalTag The tag that is defining the portal.
     */
    dimensionGroupForBotAndTag(botId: string, portalTag: string) {
        return this._dimensionTagsMap.get(
            keyForBotIDAndPortalTag(botId, portalTag)
        );
    }

    private _dimensionsUpdated(update: BotDimensionsUpdate): void {
        this._currentContext = update.calc;
        const calc = update.calc;
        for (let event of update.events) {
            if (!this._filterDimensionEvent(calc, event)) {
                continue;
            }
            if (event.type === 'dimension_added') {
                this._dimensionAdded(calc, event);
            } else if (event.type === 'dimension_removed') {
                this._dimensionRemoved(calc, event);
            } else if (event.type === 'bot_added_to_dimension') {
                this._botAddedToDimension(calc, event);
            } else if (event.type === 'bot_removed_from_dimension') {
                this._botRemovedFromDimension(calc, event);
            }
        }

        for (let u of update.updatedBots) {
            let updated = false;

            const bot = u.bot;
            const tags = u.tags;
            let group = this._dimensionGroups.get(bot.id);
            if (group) {
                group.botUpdated(bot, tags, this._currentContext);
                updated = true;
            }

            let bots = this.findBotsById(bot.id);
            for (let bot3D of bots) {
                bot3D.botUpdated(bot, tags, this._currentContext);
                updated = true;
            }

            if (updated) {
                this.onBotUpdated.invoke(bot);
            }
        }
    }

    private _dimensionAdded(
        calc: BotCalculationContext,
        event: DimensionAddedEvent
    ) {
        const key = keyForEvent(event);
        let group = this._dimensionTagsMap.get(key);
        if (!group) {
            group = this._createDimensionGroup(calc, event.dimensionBot, event);
            if (!group) {
                return;
            }
            this._dimensionGroups.set(event.dimensionBot.id, group);
            this._dimensionTagsMap.set(key, group);
            this.dimensions.push(group);
        }

        this._addGroupToDimension(event.dimension, group);
        group.addDimension(event.dimension);
        this._addExistingBotsToGroup(
            event.dimension,
            calc,
            group,
            event.existingBots
        );

        this._bindDimensionGroup(group);

        this._onDimensionGroupAdded.next(group);
    }

    /**
     * Adds the given dimension group to the 3D scene.
     * @param group The group.
     */
    protected _bindDimensionGroup(group: DimensionGroup) {
        if (group instanceof DimensionGroup3D) {
            this.add(group);
        }
    }

    protected _unbindDimensionGroup(group: DimensionGroup) {
        if (group instanceof DimensionGroup3D) {
            this.remove(group);
        }
    }

    protected _dimensionRemoved(
        calc: BotCalculationContext,
        event: DimensionRemovedEvent
    ) {
        const key = keyForEvent(event);
        let group = this._dimensionTagsMap.get(key);
        if (!group) {
            return;
        }

        this._removeGroupFromDimension(event.dimension, group);
        const bots = group.removeDimension(event.dimension);

        for (let bot of bots) {
            this._removeBotFromSimulation(bot);
        }

        if (group.dimensions.size === 0) {
            removeFromList(group, this.dimensions);
            this._dimensionGroups.delete(event.dimensionBot.id);
            this._dimensionTagsMap.delete(key);
            this._unbindDimensionGroup(group);

            this._onDimensionGroupRemoved.next(group);
        }
    }

    private _botAddedToDimension(
        calc: BotCalculationContext,
        event: BotAddedToDimensionEvent
    ) {
        const groups = this._findDimensionGroups(event.dimension);
        if (groups.length <= 0) {
            return;
        }

        this._addBotsToGroups(calc, groups, event.dimension, event.bot);
    }

    private _botRemovedFromDimension(
        calc: BotCalculationContext,
        event: BotRemovedFromDimensionEvent
    ) {
        const groups = this._findDimensionGroups(event.dimension);
        if (groups.length <= 0) {
            return;
        }

        this._removeBotsFromGroups(groups, event.dimension, event.bot);
    }

    _onLoaded() {}

    findBotsById(id: string): AuxBotVisualizer[] {
        let list = this._botMap.get(id);
        if (!list) {
            list = [];
            this._botMap.set(id, list);
        }

        return list;
    }

    frameUpdate() {
        this._processUpdateList();
        this._frameUpdateCore(this._currentContext);
    }

    /**
     * Ensures that the given bots are updated by next frame.
     * @param botIds The IDs of the bots to update.
     */
    ensureUpdate(botIds: string[]): void {
        for (let id of botIds) {
            this._updateList.add(id);
        }
    }

    /**
     * Gets the list of tags that should be watched for dimension values.
     */
    protected _getDimensionTags(): string[] {
        return ['auxDimensionConfig'];
    }

    /**
     * Determines if the given dimension event should be processed.
     * Useful for determining where and when dimensions should be allowed into the simulation.
     * Defaults to true.
     * @param calc The calculation context.
     * @param event The event.
     */
    protected _filterDimensionEvent(
        calc: BotCalculationContext,
        event: BotDimensionEvent
    ): boolean {
        return true;
    }

    protected _botsUpdated(updates: UpdatedBotInfo[], initialUpdate: boolean) {
        for (let bot of updates) {
            this._onBotUpdated(this._currentContext, bot);
        }
    }

    protected _botsRemoved(bots: string[]) {
        for (let bot of bots) {
            this._onBotRemoved(this._currentContext, bot);
        }
    }

    protected _botsAdded(bots: PrecalculatedBot[]) {
        for (let bot of bots) {
            this._onBotAdded(this._currentContext, bot);
        }

        if (!this.isLoaded) {
            this.isLoaded = true;
            this._onLoaded();
        }
    }

    protected _onBotAdded(calc: BotCalculationContext, bot: PrecalculatedBot) {}

    protected _onBotRemoved(calc: BotCalculationContext, bot: string) {}

    protected _onBotUpdated(
        calc: BotCalculationContext,
        update: UpdatedBotInfo
    ) {}

    /**
     * Creates a new list of dimension groups for the given bot.
     * @param bot The bot to create the dimension groups for.
     */
    protected abstract _createDimensionGroup(
        calc: BotCalculationContext,
        bot: Bot,
        event: DimensionAddedEvent
    ): DimensionGroup;

    /**
     * Determines if the given event is for a dimension group.
     * By default, only events that affect the 'auxDimensionConfig' tag count.
     * @param event The event.
     */
    protected _isDimensionGroupEvent(event: BotIndexEvent) {
        return event.tag === 'auxDimensionConfig';
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        for (let [id, bots] of this._botMap) {
            for (let bot of bots) {
                bot.frameUpdate(this._currentContext);
            }
        }
    }

    private _addExistingBotsToGroup(
        dimension: string,
        calc: BotCalculationContext,
        group: DimensionGroup,
        botsInDimension: Bot[]
    ) {
        for (let existingBot of botsInDimension) {
            this._addBotToGroup(calc, group, dimension, existingBot);
        }

        console.log(
            `[Simulation3D] Added ${
                botsInDimension.length
            } bots to ${dimension}`
        );
    }

    private _addGroupToDimension(dimension: string, group: DimensionGroup) {
        let groups = this._findDimensionGroups(dimension);
        groups.push(group);
    }

    private _removeGroupFromDimension(
        dimension: string,
        group: DimensionGroup
    ) {
        let groups = this._findDimensionGroups(dimension);
        removeFromList(group, groups);
    }

    private _addBotsToGroups(
        calc: BotCalculationContext,
        groups: DimensionGroup[],
        dimension: string,
        bot: Bot
    ) {
        for (let group of groups) {
            this._addBotToGroup(calc, group, dimension, bot);
        }
    }

    private _addBotToGroup(
        calc: BotCalculationContext,
        group: DimensionGroup,
        dimension: string,
        bot: Bot
    ) {
        if (!group.hasBotInDimension(dimension, bot.id)) {
            const mesh = group.addBotToDimension(dimension, bot);
            let meshes = this.findBotsById(bot.id);
            meshes.push(mesh);
            mesh.botUpdated(bot, new Set(), calc);
            this.onBotAdded.invoke(bot);
        }
    }

    private _removeBotsFromGroups(
        groups: DimensionGroup[],
        dimension: string,
        bot: Bot
    ) {
        for (let group of groups) {
            this._removeBotFromGroup(group, dimension, bot);
        }
    }

    private _removeBotFromGroup(
        group: DimensionGroup,
        dimension: string,
        bot: Bot
    ) {
        const mesh = group.getBotInDimension(dimension, bot.id);
        if (mesh) {
            this._removeBot3DFromGroup(group, dimension, mesh);
        }
    }

    private _removeBot3DFromGroup(
        group: DimensionGroup,
        dimension: string,
        mesh: AuxBotVisualizer
    ) {
        group.removeBotFromDimension(dimension, mesh);
        this._removeBotFromSimulation(mesh);
    }

    private _removeBotFromSimulation(mesh: AuxBotVisualizer) {
        let meshes = this.findBotsById(mesh.bot.id);
        removeFromList(mesh, meshes);
        mesh.dispose();

        this.onBotRemoved.invoke(mesh.bot);
    }

    private _findDimensionGroups(tag: string): DimensionGroup[] {
        let groups = this._dimensionMap.get(tag);
        if (!groups) {
            groups = [];
            this._dimensionMap.set(tag, groups);
        }
        return groups;
    }

    private _processUpdateList() {
        if (this._updateList.size <= 0) {
            return;
        }
        for (let id of this._updateList) {
            if (!this._updatedList.has(id)) {
                this._updatedList.add(id);
                const bots = this.findBotsById(id);
                for (let bot3D of bots) {
                    bot3D.botUpdated(
                        bot3D.bot,
                        new Set(),
                        this._currentContext
                    );
                }
                if (bots.length > 0) {
                    this.onBotUpdated.invoke(bots[0].bot);
                }
            }
        }
        this._updateList.clear();
        this._updatedList.clear();
    }

    /**
     * Gets the camera that is used as the primary rendering camera for this simulation.
     */
    abstract getMainCameraRig(): CameraRig;

    /**
     * Gets the grid scale that should be used for the given bot.
     * @param bot The bot.
     */
    abstract getGridScale(bot: AuxBot3D): number;

    unsubscribe(): void {
        this._subs.forEach(s => s.unsubscribe());
        this.remove(...this.children);
        this.dimensions.splice(0, this.dimensions.length);
        this.closed = true;
        this._subs = [];
        this._botMap = new Map();
        this._dimensionMap = new Map();
        this._dimensionGroups = new Map();
    }
}

function keyForEvent(
    event: DimensionAddedEvent | DimensionRemovedEvent
): string {
    return keyForBotIDAndPortalTag(event.dimensionBot.id, event.dimensionTag);
}

function keyForBotIDAndPortalTag(botId: string, portalTag: string): string {
    return `${botId}-${portalTag}`;
}

export function removeFromList<T>(item: T, arr: T[]) {
    const index = arr.indexOf(item);
    if (index >= 0) {
        arr.splice(index, 1);
    }
}

function countChildren(obj: Object3D) {
    let count = obj.children.length;
    for (let child of obj.children) {
        count += countChildren(child);
    }

    console.log(`[${obj.constructor.name}] ${count}`);
    return count;
}
