import { Object3D, Texture, Color, Vector2 } from 'three';
import { ContextGroup3D } from './ContextGroup3D';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    Bot,
    BotCalculationContext,
    hasValue,
    PrecalculatedBot,
    AuxBot,
    GLOBALS_BOT_ID,
    getBotConfigContexts,
} from '@casual-simulation/aux-common';
import { SubscriptionLike } from 'rxjs';
import { concatMap, tap, flatMap as rxFlatMap } from 'rxjs/operators';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { CameraRig } from './CameraRigFactory';
import { Game } from './Game';
import { AuxBot3DFinder } from '../AuxBot3DFinder';
import { AuxBot3D } from './AuxBot3D';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';

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

    private _botMap: Map<string, AuxBot3D[]>;
    private _decoratorFactory: AuxBot3DDecoratorFactory;
    private _sceneBackground: Color | Texture = null;
    private _updateList: Set<string> = new Set();
    private _updatedList: Set<string> = new Set();
    private isLoaded: boolean = false;

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
                            const foundBotIn3D = this.contexts.some(c =>
                                c.getBots().some(f => f.bot.id === e.botId)
                            );
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
            this.simulation.watcher.botsUpdated
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

    _botsUpdated(updates: PrecalculatedBot[], initialUpdate: boolean) {
        let calc = this.simulation.helper.createContext();
        for (let update of updates) {
            this._botUpdated(calc, update, initialUpdate);
        }
    }

    _botsRemoved(bots: string[]) {
        let calc = this.simulation.helper.createContext();
        for (let bot of bots) {
            this._botRemoved(calc, bot);
        }
    }

    _botsAdded(bots: PrecalculatedBot[]) {
        let calc = this.simulation.helper.createContext();
        console.log(`[Simulation3D] ${bots.length} bots added!`);
        const botsWithContext = bots.filter(
            b => getBotConfigContexts(calc, b).length > 0
        );
        console.log(`[Simulation3D] ${botsWithContext.length} contexts added!`);
        for (let bot of bots) {
            this._botAdded(calc, bot);
        }

        if (!this.isLoaded) {
            this.isLoaded = true;
            this._onLoaded();
        }
    }

    _onLoaded() {}

    findBotsById(id: string): AuxBot3D[] {
        if (!this._botMap) {
            this._updateBotMap();
        }

        return this._botMap.get(id) || [];
    }

    _updateBotMap() {
        this._botMap = new Map();
        for (let group of this.contexts) {
            for (let [name, context] of group.contexts) {
                for (let [id, bot] of context.bots) {
                    const list = this._botMap.get(id);
                    if (list) {
                        list.push(bot);
                    } else {
                        this._botMap.set(id, [bot]);
                    }
                }
            }
        }
    }

    frameUpdate() {
        const calc = this.simulation.helper.createContext();
        for (let id of this._updateList) {
            if (!this._updatedList.has(id)) {
                const bots = this.findBotsById(id);
                if (bots.length > 0) {
                    this._botUpdatedCore(calc, <PrecalculatedBot>bots[0].bot);
                }
            }
        }
        this._updateList.clear();
        this._updatedList.clear();

        this._frameUpdateCore(calc);
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
        this.contexts.forEach(context => {
            context.frameUpdate(calc);
        });
    }

    protected _botAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        this._botMap = null;
        let context = this._createContext(calc, bot);
        if (context) {
            this.contexts.push(context);
            this.add(context);
        }

        this._botAddedCore(calc, bot);
        this._botUpdated(calc, bot, true);

        this.onBotAdded.invoke(bot);
    }

    protected _botAddedCore(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        for (let context of this.contexts) {
            context.botAdded(bot, calc);
        }
    }

    protected _botRemoved(calc: BotCalculationContext, id: string): void {
        this._botMap = null;
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
        this._botMap = null;
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
        this._botMap = null;
    }

    /**
     * Creates a new context group for the given bot.
     * @param bot The bot to create the context group for.
     */
    protected abstract _createContext(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): ContextGroup3D;
}
