import { Object3D, Texture, Color, Vector2 } from 'three';
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
import {
    SubscriptionLike,
    Subscription,
    Subject,
    Observable,
    GroupedObservable,
} from 'rxjs';
import {
    concatMap,
    tap,
    flatMap as rxFlatMap,
    map,
    startWith,
} from 'rxjs/operators';
import { flatMap, sortBy } from 'lodash';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { CameraRig } from './CameraRigFactory';
import { Game } from './Game';
import { AuxBotVisualizerFinder } from '../AuxBotVisualizerFinder';
import { AuxBotVisualizer } from './AuxBotVisualizer';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import {
    UpdatedBotInfo,
    BotContextsUpdate,
    ContextAddedEvent,
    ContextRemovedEvent,
    BotAddedToContextEvent,
    BotRemovedFromContextEvent,
} from '@casual-simulation/aux-vm';
import { ContextGroup } from './ContextGroup';
import { ContextGroup3D } from './ContextGroup3D';

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
     * Gets an observable that resolves whenever a context group is added.
     */
    get onContextGroupAdded(): Observable<ContextGroup> {
        return this._onContextGroupAdded.pipe(startWith(...this.contexts));
    }

    /**
     * Gets an observable that resolves whenever a context group is removed.
     */
    get onContextGroupRemoved(): Observable<ContextGroup> {
        return this._onContextGroupRemoved;
    }

    onBotAdded: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotUpdated: ArgEvent<Bot> = new ArgEvent<Bot>();
    onBotRemoved: ArgEvent<Bot> = new ArgEvent<Bot>();

    /**
     * The list of contexts that are being rendered in the simulation.
     */
    contexts: ContextGroup[];

    /**
     * The simulation that this object is rendering.
     */
    simulation: BrowserSimulation;

    /**
     * The map of context names to the groups they belong in.
     */
    private _contextMap: Map<string, ContextGroup[]>;

    /**
     * A map of bot Ids to their context group 3D object.
     */
    private _contextGroups: Map<string, ContextGroup>;

    /**
     * A map of bot Ids to their bots.
     */
    private _botMap: Map<string, AuxBotVisualizer[]>;
    private _currentContext: BotCalculationContext;
    private _onContextGroupAdded = new Subject<ContextGroup>();
    private _onContextGroupRemoved = new Subject<ContextGroup>();

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
            this.simulation.contexts
                .watchContexts('aux.context')
                .pipe(tap(update => this._contextsUpdated(update)))
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

    private _contextsUpdated(update: BotContextsUpdate): void {
        this._currentContext = update.calc;
        const calc = update.calc;
        for (let event of update.contextEvents) {
            if (event.type === 'context_added') {
                this._contextAdded(calc, event);
            } else if (event.type === 'context_removed') {
                this._contextRemoved(calc, event);
            } else if (event.type === 'bot_added_to_context') {
                this._botAddedToContext(calc, event);
            } else if (event.type === 'bot_removed_from_context') {
                this._botRemovedFromContext(calc, event);
            }
        }

        for (let u of update.updatedBots) {
            let updated = false;

            const bot = u.bot;
            const tags = u.tags;
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

    private _contextAdded(
        calc: BotCalculationContext,
        event: ContextAddedEvent
    ) {
        let group = this._contextGroups.get(event.contextBot.id);
        if (!group) {
            group = this._createContextGroup(calc, event.contextBot);
            if (!group) {
                return;
            }
            this._contextGroups.set(event.contextBot.id, group);
            this.contexts.push(group);
        }

        this._addGroupToContext(event.context, group);
        group.addContext(event.context);
        this._addExistingBotsToGroup(
            event.context,
            calc,
            group,
            event.existingBots
        );

        if (group instanceof ContextGroup3D) {
            this.add(group);
        }

        this._onContextGroupAdded.next(group);
    }

    private _contextRemoved(
        calc: BotCalculationContext,
        event: ContextRemovedEvent
    ) {
        let group = this._contextGroups.get(event.contextBot.id);
        if (!group) {
            return;
        }

        this._removeGroupFromContext(event.context, group);
        const bots = group.removeContext(event.context);

        for (let bot of bots) {
            this._removeBotFromSimulation(bot);
        }

        if (group.contexts.size === 0) {
            removeFromList(group, this.contexts);
            this._contextGroups.delete(event.contextBot.id);
            if (group instanceof ContextGroup3D) {
                this.remove(group);
            }

            this._onContextGroupRemoved.next(group);
        }
    }

    private _botAddedToContext(
        calc: BotCalculationContext,
        event: BotAddedToContextEvent
    ) {
        const groups = this._findContextGroups(event.context);
        if (groups.length <= 0) {
            return;
        }

        this._addBotsToGroups(calc, groups, event.context, event.bot);
    }

    private _botRemovedFromContext(
        calc: BotCalculationContext,
        event: BotRemovedFromContextEvent
    ) {
        const groups = this._findContextGroups(event.context);
        if (groups.length <= 0) {
            return;
        }

        this._removeBotsFromGroups(groups, event.context, event.bot);
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
     * Creates a new list of context groups for the given bot.
     * @param bot The bot to create the context groups for.
     */
    protected abstract _createContextGroup(
        calc: BotCalculationContext,
        bot: Bot
    ): ContextGroup;

    /**
     * Determines if the given event is for a context group.
     * By default, only events that affect the 'aux.context' tag count.
     * @param event The event.
     */
    protected _isContextGroupEvent(event: BotIndexEvent) {
        return event.tag === 'aux.context';
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        for (let [id, bots] of this._botMap) {
            for (let bot of bots) {
                bot.frameUpdate(this._currentContext);
            }
        }
    }

    private _addExistingBotsToGroup(
        context: string,
        calc: BotCalculationContext,
        group: ContextGroup,
        botsInContext: Bot[]
    ) {
        for (let existingBot of botsInContext) {
            this._addBotToGroup(calc, group, context, existingBot);
        }

        console.log(
            `[Simulation3D] Added ${botsInContext.length} bots to ${context}`
        );
    }

    private _addGroupToContext(context: string, group: ContextGroup) {
        let groups = this._findContextGroups(context);
        groups.push(group);
    }

    private _removeGroupFromContext(context: string, group: ContextGroup) {
        let groups = this._findContextGroups(context);
        removeFromList(group, groups);
    }

    private _addBotsToGroups(
        calc: BotCalculationContext,
        groups: ContextGroup[],
        context: string,
        bot: Bot
    ) {
        for (let group of groups) {
            this._addBotToGroup(calc, group, context, bot);
        }
    }

    private _addBotToGroup(
        calc: BotCalculationContext,
        group: ContextGroup,
        context: string,
        bot: Bot
    ) {
        if (!group.hasBotInContext(context, bot.id)) {
            const mesh = group.addBotToContext(context, bot);
            let meshes = this.findBotsById(bot.id);
            meshes.push(mesh);
            mesh.botUpdated(bot, new Set(), calc);
            this.onBotAdded.invoke(bot);
        }
    }

    private _removeBotsFromGroups(
        groups: ContextGroup[],
        context: string,
        bot: Bot
    ) {
        for (let group of groups) {
            this._removeBotFromGroup(group, context, bot);
        }
    }

    private _removeBotFromGroup(
        group: ContextGroup,
        context: string,
        bot: Bot
    ) {
        const mesh = group.getBotInContext(context, bot.id);
        if (mesh) {
            this._removeBot3DFromGroup(group, context, mesh);
        }
    }

    private _removeBot3DFromGroup(
        group: ContextGroup,
        context: string,
        mesh: AuxBotVisualizer
    ) {
        group.removeBotFromContext(context, mesh);
        this._removeBotFromSimulation(mesh);
    }

    private _removeBotFromSimulation(mesh: AuxBotVisualizer) {
        let meshes = this.findBotsById(mesh.bot.id);
        removeFromList(mesh, meshes);
        mesh.dispose();

        this.onBotRemoved.invoke(mesh.bot);
    }

    private _findContextGroups(tag: string): ContextGroup[] {
        let groups = this._contextMap.get(tag);
        if (!groups) {
            groups = [];
            this._contextMap.set(tag, groups);
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
            }
        }
        this._updateList.clear();
        this._updatedList.clear();
    }

    /**
     * Gets the camera that is used as the primary rendering camera for this simulation.
     */
    abstract getMainCameraRig(): CameraRig;

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
