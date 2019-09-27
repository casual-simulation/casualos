import { Object3D, Texture, Color, Vector2 } from 'three';
import { ContextGroup3D } from './ContextGroup3D';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    Bot,
    BotCalculationContext,
    hasValue,
    PrecalculatedBot,
    AuxFile,
    GLOBALS_FILE_ID,
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
    onFileAdded: ArgEvent<Bot> = new ArgEvent<Bot>();
    onFileUpdated: ArgEvent<Bot> = new ArgEvent<Bot>();
    onFileRemoved: ArgEvent<Bot> = new ArgEvent<Bot>();

    /**
     * The list of contexts that are being rendered in the simulation.
     */
    contexts: ContextGroup3D[];

    /**
     * The simulation that this object is rendering.
     */
    simulation: BrowserSimulation;

    private _fileMap: Map<string, AuxBot3D[]>;
    private _decoratorFactory: AuxBot3DDecoratorFactory;
    private _sceneBackground: Color | Texture = null;
    private _updateList: Set<string> = new Set();
    private _updatedList: Set<string> = new Set();

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
        // Subscriptions to bot events.
        this._subs.push(
            this.simulation.watcher.botsDiscovered
                .pipe(concatMap(bot => this._filesAdded(bot)))
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher.botsRemoved
                .pipe(tap(bot => this._filesRemoved(bot)))
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher.botsUpdated
                .pipe(concatMap(update => this._botsUpdated(update, false)))
                .subscribe()
        );
        this._subs.push(
            this.simulation.localEvents
                .pipe(
                    tap(e => {
                        if (e.type === 'tween_to') {
                            const foundFileIn3D = this.contexts.some(c =>
                                c.getFiles().some(f => f.bot.id === e.botId)
                            );
                            if (foundFileIn3D) {
                                this.game.tweenCameraToFile(
                                    this.getMainCameraRig(),
                                    e.botId,
                                    e.zoomValue,
                                    e.rotationValue
                                        ? new Vector2(
                                              e.rotationValue.x,
                                              e.rotationValue.y
                                          )
                                        : undefined
                                );
                            }
                        }
                    })
                )
                .subscribe()
        );
        this._subs.push(
            this.simulation.watcher
                .botChanged(GLOBALS_FILE_ID)
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

    async _botsUpdated(updates: PrecalculatedBot[], initialUpdate: boolean) {
        let calc = this.simulation.helper.createContext();
        for (let update of updates) {
            await this._fileUpdated(calc, update, initialUpdate);
        }
    }

    async _filesRemoved(bots: string[]) {
        let calc = this.simulation.helper.createContext();
        for (let bot of bots) {
            await this._fileRemoved(calc, bot);
        }
    }

    async _filesAdded(bots: PrecalculatedBot[]) {
        let calc = this.simulation.helper.createContext();
        for (let bot of bots) {
            await this._fileAdded(calc, bot);
        }
    }

    findFilesById(id: string): AuxBot3D[] {
        if (!this._fileMap) {
            this._updateFileMap();
        }

        return this._fileMap.get(id) || [];
    }

    _updateFileMap() {
        this._fileMap = new Map();
        for (let group of this.contexts) {
            for (let [name, context] of group.contexts) {
                for (let [id, bot] of context.bots) {
                    const list = this._fileMap.get(id);
                    if (list) {
                        list.push(bot);
                    } else {
                        this._fileMap.set(id, [bot]);
                    }
                }
            }
        }
    }

    frameUpdate() {
        const calc = this.simulation.helper.createContext();
        for (let id of this._updateList) {
            if (!this._updatedList.has(id)) {
                const bots = this.findFilesById(id);
                if (bots.length > 0) {
                    this._fileUpdatedCore(calc, <PrecalculatedBot>bots[0].bot);
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

    protected async _fileAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): Promise<void> {
        this._fileMap = null;
        let context = this._createContext(calc, bot);
        if (context) {
            this.contexts.push(context);
            this.add(context);
        }

        await this._fileAddedCore(calc, bot);
        await this._fileUpdated(calc, bot, true);

        this.onFileAdded.invoke(bot);
    }

    protected async _fileAddedCore(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): Promise<void> {
        await Promise.all(this.contexts.map(c => c.botAdded(bot, calc)));
    }

    protected async _fileRemoved(
        calc: BotCalculationContext,
        id: string
    ): Promise<void> {
        this._fileMap = null;
        this._fileRemovedCore(calc, id);

        this.onFileRemoved.invoke(null);
    }

    protected _fileRemovedCore(calc: BotCalculationContext, id: string) {
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

    protected async _fileUpdated(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        initialUpdate: boolean
    ): Promise<void> {
        this._fileMap = null;
        let { shouldRemove } = this._shouldRemoveUpdatedFile(
            calc,
            bot,
            initialUpdate
        );

        await this._fileUpdatedCore(calc, bot);

        this.onFileUpdated.invoke(bot);

        if (shouldRemove) {
            this._fileRemoved(calc, bot.id);
        }
    }

    protected async _fileUpdatedCore(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        if (bot != undefined) {
            this._updatedList.add(bot.id);
            await Promise.all(
                this.contexts.map(c => c.botUpdated(bot, [], calc))
            );
        }
    }

    protected _shouldRemoveUpdatedFile(
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
        this._fileMap = null;
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
