import { Object3D, Texture, Color, Vector2 } from 'three';
import { ContextGroup3D, ContextGroupUpdate } from './ContextGroup3D';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    Bot,
    BotCalculationContext,
    hasValue,
    PrecalculatedBot,
    AuxBot,
    GLOBALS_BOT_ID,
    getBotConfigContexts,
    isBotInContext,
    tagsOnBot,
    BotIndex,
    BotIndexEvent,
    BotTagAddedEvent,
    BotTagRemovedEvent,
    BotTagUpdatedEvent,
    calculateStringTagValue,
    calculateBotValue,
} from '@casual-simulation/aux-common';
import { SubscriptionLike, Subscription } from 'rxjs';
import { concatMap, tap, flatMap as rxFlatMap, map } from 'rxjs/operators';
import { flatMap, sortBy } from 'lodash';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { CameraRig } from './CameraRigFactory';
import { Game } from './Game';
import { AuxBot3DFinder } from '../AuxBot3DFinder';
import { AuxBot3D } from './AuxBot3D';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { UpdatedBotInfo } from '@casual-simulation/aux-vm';

/**
 * Defines a class that is able to render a simulation.
 */
export abstract class Simulation3D extends Object3D
    implements SubscriptionLike, AuxBot3DFinder {
    protected _subs: SubscriptionLike[];

    /**
     * The game view.
     */
    protected _game: Game;

    closed: boolean;
    onBotAdded: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotUpdated: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotRemoved: ArgEvent<Bot> = new ArgEvent<Bot>();

    /**
     * The list of contexts that are being rendered in the simulation.
     */
    contexts: ContextGroup3D[];

    /**
     * The simulation that this object is rendering.
     */
    simulation: BrowserSimulation;

    /**
     * The map of context names to the groups they belong in.
     */
    private _contextMap: Map<string, ContextGroup3D[]>;

    /**
     * A map of bot Ids to their context group 3D object.
     */
    private _contextGroups: Map<string, ContextGroup3D>;

    /**
     * A map of bot Ids to their bots.
     */
    private _botMap: Map<string, AuxBot3D[]>;
    private _index: BotIndex;
    private _currentContext: BotCalculationContext;

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
        this.contexts = [];
        this._subs = [];
        this._decoratorFactory = new AuxBot3DDecoratorFactory(game, this);
        this._contextMap = new Map();
        this._contextGroups = new Map();
        this._botMap = new Map();
        this._index = new BotIndex();
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
                        let sceneBackgroundColor = bot.tags['aux.scene.color'];
                        this._sceneBackground = hasValue(sceneBackgroundColor)
                            ? new Color(sceneBackgroundColor)
                            : null;
                    })
                )
                .subscribe()
        );
    }

    _botsUpdated(updates: UpdatedBotInfo[], initialUpdate: boolean) {
        const events = this._index.updateBots(updates);
        this._processEvents(events);
    }

    _botsRemoved(bots: string[]) {
        const events = this._index.removeBots(bots);
        this._processEvents(events);
    }

    _botsAdded(bots: PrecalculatedBot[]) {
        const events = this._index.addBots(bots);
        this._processEvents(events);

        if (!this.isLoaded) {
            this.isLoaded = true;
            this._onLoaded();
        }
    }

    private _processEvents(events: BotIndexEvent[]) {
        this._currentContext = this.simulation.helper.createContext();
        let updatedBots = new Map<Bot, string[]>();
        for (let event of events) {
            this._processContextEvent(this._currentContext, event);

            let tags = updatedBots.get(event.bot);
            if (!tags) {
                tags = [];
                updatedBots.set(event.bot, tags);
            }
            tags.push(event.tag);
        }

        for (let [bot, tags] of updatedBots) {
            let updated = false;

            let group = this._contextGroups.get(bot.id);
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

    private _processContextEvent(
        calc: BotCalculationContext,
        event: BotIndexEvent
    ) {
        if (event.tag === 'aux.context') {
            this._processContextGroupTag(calc, event);
        } else {
            this._processContextTag(calc, event);
        }
    }

    private _processContextGroupTag(
        calc: BotCalculationContext,
        event: BotIndexEvent
    ) {
        if (event.type === 'bot_tag_added') {
            this._contextAdded(calc, event);
        } else if (event.type === 'bot_tag_removed') {
            this._contextRemoved(calc, event);
        } else if (event.type === 'bot_tag_updated') {
            this._contextUpdated(calc, event);
        }
    }

    private _contextAdded(
        calc: BotCalculationContext,
        event: BotTagAddedEvent
    ) {
        const context = this._createContext(calc, event.bot);
        if (context) {
            this._contextGroups.set(event.bot.id, context);
            this.contexts.push(context);
            this.add(context);

            context.botAdded(event.bot, calc);

            const contextIds = getBotConfigContexts(calc, event.bot);
            for (let id of contextIds) {
                this._addGroupToContext(id, context);
                this._addExistingBotsToGroup(id, calc, context);
            }
        }
    }

    private _addExistingBotsToGroup(
        context: string,
        calc: BotCalculationContext,
        group: ContextGroup3D
    ) {
        let botsWithContextTag = this._index.findBotsWithTag(context);
        let botsInContext = botsWithContextTag.filter(b =>
            isBotInContext(calc, b, context)
        );
        for (let existingBot of botsInContext) {
            this._addBotToGroup(calc, group, context, existingBot);
        }

        console.log(
            `[Simulation3D] Added ${botsInContext.length} bots to ${context}`
        );
    }

    private _addGroupToContext(context: string, group: ContextGroup3D) {
        let groups = this._findContextGroups(context);
        groups.push(group);
    }

    private _contextRemoved(
        calc: BotCalculationContext,
        event: BotTagRemovedEvent
    ) {
        const context = this._contextGroups.get(event.bot.id);
        if (context) {
            removeFromList(context, this.contexts);
            this.remove(context);

            for (let id of context.contexts) {
                this._removeGroupFromContext(id, context);
            }

            for (let bot of context.getBots()) {
                this._removeBotFromSimulation(bot);
            }
        }
    }

    private _removeGroupFromContext(context: string, group: ContextGroup3D) {
        let groups = this._findContextGroups(context);
        removeFromList(group, groups);
    }

    private _contextUpdated(
        calc: BotCalculationContext,
        event: BotTagUpdatedEvent
    ) {
        const context = this._contextGroups.get(event.bot.id);
        if (context) {
            const result = context.botUpdated(event.bot, [], calc);

            for (let removed of result.removedContexts) {
                this._removeGroupFromContext(removed, context);

                const bots = context.getBotsInContext(removed);
                for (let [id, bot] of bots) {
                    this._removeBot3DFromGroup(context, bot, bots);
                }
            }

            for (let added of result.addedContexts) {
                this._addGroupToContext(added, context);
                this._addExistingBotsToGroup(added, calc, context);
            }
        }
    }

    private _processContextTag(
        calc: BotCalculationContext,
        event: BotIndexEvent
    ) {
        const groups = this._findContextGroups(event.tag);
        if (groups.length <= 0) {
            return;
        }
        const isInContext = this._isTagInContext(calc, event);
        if (isInContext) {
            this._addBotsToGroups(calc, groups, event.tag, event.bot);
        } else {
            this._removeBotFromContext(groups, event.tag, event.bot);
        }
    }

    private _isTagInContext(calc: BotCalculationContext, event: BotIndexEvent) {
        return isBotInContext(calc, event.bot, event.tag);
    }

    private _addBotsToGroups(
        calc: BotCalculationContext,
        groups: ContextGroup3D[],
        context: string,
        bot: Bot
    ) {
        for (let group of groups) {
            this._addBotToGroup(calc, group, context, bot);
        }
    }

    private _addBotToGroup(
        calc: BotCalculationContext,
        group: ContextGroup3D,
        context: string,
        bot: Bot
    ) {
        const bots = group.getBotsInContext(context);
        if (!bots.has(bot.id)) {
            const mesh = new AuxBot3D(
                bot,
                group,
                context,
                group.childColliders,
                this._decoratorFactory
            );

            group.display.add(mesh);
            bots.set(bot.id, mesh);
            let meshes = this.findBotsById(bot.id);
            meshes.push(mesh);

            mesh.botUpdated(bot, [], calc);

            this.onBotAdded.invoke(bot);
        }
    }

    private _removeBotFromContext(
        groups: ContextGroup3D[],
        context: string,
        bot: Bot
    ) {
        for (let group of groups) {
            this._removeBotFromGroup(group, context, bot);
        }
    }

    private _removeBotFromGroup(
        group: ContextGroup3D,
        context: string,
        bot: Bot
    ) {
        const bots = group.getBotsInContext(context);
        const mesh = bots.get(bot.id);
        if (mesh) {
            this._removeBot3DFromGroup(group, mesh, bots);
        }
    }

    private _removeBot3DFromGroup(
        group: ContextGroup3D,
        mesh: AuxBot3D,
        bots: Map<string, AuxBot3D>
    ) {
        bots.delete(mesh.bot.id);
        group.display.remove(mesh);
        this._removeBotFromSimulation(mesh);
    }

    private _removeBotFromSimulation(mesh: AuxBot3D) {
        let meshes = this.findBotsById(mesh.bot.id);
        removeFromList(mesh, meshes);
        mesh.dispose();

        this.onBotRemoved.invoke(mesh.bot);
    }

    private _findContextGroups(tag: string): ContextGroup3D[] {
        let groups = this._contextMap.get(tag);
        if (!groups) {
            groups = [];
            this._contextMap.set(tag, groups);
        }
        return groups;
    }

    _onLoaded() {}

    findBotsById(id: string): AuxBot3D[] {
        let list = this._botMap.get(id);
        if (!list) {
            list = [];
            this._botMap.set(id, list);
        }

        return list;
    }

    // _updateBotMap() {
    //     this._botMap = new Map();
    //     for (let bot3d of this.bots) {
    //         const id = bot3d.bot.id;
    //         const list = this._botMap.get(id);
    //         if (list) {
    //             list.push(bot3d);
    //         } else {
    //             this._botMap.set(id, [bot3d]);
    //         }
    //     }
    // }

    frameUpdate() {
        this._processUpdateList();
        this._frameUpdateCore(this._currentContext);

        // countChildren(this);
    }

    private _processUpdateList() {
        if (this._updateList.size <= 0) {
            return;
        }
        for (let id of this._updateList) {
            if (!this._updatedList.has(id)) {
                const bots = this.findBotsById(id);
                if (bots.length > 0) {
                    this._botUpdatedCore(this._currentContext, <
                        PrecalculatedBot
                    >bots[0].bot);
                }
            }
        }
        this._updateList.clear();
        this._updatedList.clear();
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
     * Gets the camera that is used as the primary rendering camera for this simulation.
     */
    abstract getMainCameraRig(): CameraRig;

    protected _frameUpdateCore(calc: BotCalculationContext) {
        for (let [id, bots] of this._botMap) {
            for (let bot of bots) {
                bot.frameUpdate(this._currentContext);
            }
        }
    }

    protected _tryAddContext(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        let context = this._createContext(calc, bot);
        if (context) {
            this.contexts.push(context);
            this.add(context);
        }
    }

    protected _botAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        this._botAddedCore(calc, bot);
        this._botUpdated(calc, bot, true);

        this.onBotAdded.invoke(bot);
    }

    protected _botAddedCore(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        // Find the contexts for the bot.
        // for (let [context, _3d] of this._contextMap) {
        //     if (isBotInContext(calc, bot, context)) {
        //         // Add bot to context
        //         this._botAddedToContext(calc, bot, context, _3d);
        //     }
        // }
        // for (let context of this.contexts) {
        //     context.botAdded(bot, calc);
        // }
    }

    // protected _botAddedToContext(
    //     calc: BotCalculationContext,
    //     bot: Bot,
    //     context: string,
    //     visualizations: ContextGroup3D[]
    // ) {
    //     for (let viz of visualizations) {
    //         const mesh = new AuxBot3D(
    //             bot,
    //             viz,
    //             context,
    //             viz.colliders,
    //             this._decoratorFactory
    //         );
    //         this.bots.push(mesh);
    //         viz.display.add(mesh);

    //         mesh.botUpdated(bot, [], calc);
    //     }
    // }

    protected _botRemoved(calc: BotCalculationContext, id: string): void {
        this._botRemovedCore(calc, id);

        this.onBotRemoved.invoke(null);
    }

    protected _botRemovedCore(calc: BotCalculationContext, id: string) {
        let removedIndex: number = -1;
        this.contexts.forEach((context, index) => {
            context.botRemoved(id, calc);
            if (context.bot.id === id) {
                removedIndex = index;
            }
        });

        if (removedIndex >= 0) {
            const context = this.contexts[removedIndex];
            this._removeContext(context, removedIndex);
        }
    }

    protected _removeContext(context: ContextGroup3D, removedIndex: number) {
        context.dispose();
        this.remove(context);
        this.contexts.splice(removedIndex, 1);
    }

    protected _botUpdated(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        initialUpdate: boolean
    ): void {
        let { shouldRemove } = this._shouldRemoveUpdatedBot(
            calc,
            bot,
            initialUpdate
        );

        this._botUpdatedCore(calc, bot);

        this.onBotUpdated.invoke(bot);

        if (shouldRemove) {
            this._botRemoved(calc, bot.id);
        }
    }

    protected _botUpdatedCore(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        if (bot != undefined) {
            this._updatedList.add(bot.id);
            for (let context of this.contexts) {
                context.botUpdated(bot, [], calc);
            }
            // await Promise.all(
            //     this.contexts.map(c => c.botUpdated(bot, [], calc))
            // );
        }
    }

    protected _shouldRemoveUpdatedBot(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        initialUpdate: boolean
    ): { shouldRemove: boolean } {
        return {
            shouldRemove: false,
        };
    }

    unsubscribe(): void {
        this._subs.forEach(s => s.unsubscribe());
        this.remove(...this.children);
        this.contexts.splice(0, this.contexts.length);
        this.closed = true;
        this._subs = [];
        this._botMap = new Map();
        this._contextMap = new Map();
        this._contextGroups = new Map();
    }

    /**
     * Creates a new context group for the given bot.
     * @param bot The bot to create the context group for.
     */
    protected abstract _createContext(
        calc: BotCalculationContext,
        bot: Bot
    ): ContextGroup3D;
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
