import {
    Bot,
    BotCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isContextLocked,
    calculateGridScale,
    PrecalculatedBot,
    toast,
    calculateBotValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    BotIndexEvent,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { doesBotDefinePlayerContext } from '../PlayerUtils';
import {
    Color,
    Texture,
    OrthographicCamera,
    PerspectiveCamera,
    Math as ThreeMath,
} from 'three';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';
import { UpdatedBotInfo } from '@casual-simulation/aux-vm';

export class PlayerSimulation3D extends Simulation3D {
    /**
     * Keep bots in a back buffer so that we can add bots to contexts when they come in.
     * We should not guarantee that contexts will come first so we must have some lazy bot adding.
     */
    private _botBackBuffer: Map<string, Bot>;

    /**
     * The current context group 3d that the AUX Player is rendering.
     */
    private _contextGroup: ContextGroup3D;

    private _contextBackground: Color | Texture = null;
    private _inventoryColor: Color | Texture = null;
    private _userInventoryColor: Color | Texture = null;
    private _inventoryVisible: boolean = true;

    private _inventoryPannable: boolean = false;
    private _inventoryResizable: boolean = true;
    private _inventoryRotatable: boolean = true;
    private _inventoryZoomable: boolean = true;

    private _pannable: boolean = true;
    private _panMinX: number = null;
    private _panMaxX: number = null;
    private _panMinY: number = null;
    private _panMaxY: number = null;

    private _rotatable: boolean = true;

    private _zoomable: boolean = true;
    private _zoomMin: number = null;
    private _zoomMax: number = null;

    private _inventoryHeight: number = 0;
    private _playerRotationX: number = null;
    private _playerRotationY: number = null;
    private _playerZoom: number = null;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    context: string;
    grid3D: PlayerGrid3D;

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        if (this._contextBackground) {
            return this._contextBackground;
        } else {
            return super.backgroundColor;
        }
    }

    /**
     * Gets the visibility of the inventory that the simulation defines.
     */
    get inventoryVisible() {
        if (this._inventoryVisible != null) {
            return this._inventoryVisible;
        } else {
            return true;
        }
    }

    /**
     * Gets the pannability of the inventory camera that the simulation defines.
     */
    get pannable() {
        if (this._pannable != null) {
            return this._pannable;
        } else {
            return false;
        }
    }

    /**
     * Gets the minimum value the pan can be set to on the x axis
     */
    get panMinX() {
        if (this._panMinX != null) {
            return this._panMinX;
        } else {
            return null;
        }
    }

    /**
     * Gets the maximum value the pan can be set to on the x axis
     */
    get panMaxX() {
        if (this._panMaxX != null) {
            return this._panMaxX;
        } else {
            return null;
        }
    }

    /**
     * Gets the minimum value the pan can be set to on the y axis
     */
    get panMinY() {
        if (this._panMinY != null) {
            return this._panMinY;
        } else {
            return null;
        }
    }

    /**
     * Gets the maximum value the pan can be set to on the y axis
     */
    get panMaxY() {
        if (this._panMaxY != null) {
            return this._panMaxY;
        } else {
            return null;
        }
    }

    /**
     * Gets if rotation is allowed in the inventory that the simulation defines.
     */
    get rotatable() {
        if (this._rotatable != null) {
            return this._rotatable;
        } else {
            return true;
        }
    }

    /**
     * Gets if zooming is allowed in the inventory that the simulation defines.
     */
    get zoomable() {
        if (this._zoomable != null) {
            return this._zoomable;
        } else {
            return true;
        }
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        if (this._zoomMin != null) {
            return this._zoomMin;
        } else {
            return null;
        }
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        if (this._zoomMax != null) {
            return this._zoomMax;
        } else {
            return null;
        }
    }

    /**
     * Gets the pannability of the inventory camera that the simulation defines.
     */
    get inventoryPannable() {
        if (this._inventoryPannable != null) {
            return this._inventoryPannable;
        } else {
            return false;
        }
    }

    /**
     * Gets the resizability of the inventory viewport that the simulation defines.
     */
    get inventoryResizable() {
        if (this._inventoryResizable != null) {
            return this._inventoryResizable;
        } else {
            return true;
        }
    }

    /**
     * Gets if rotation is allowed in the inventory that the simulation defines.
     */
    get inventoryRotatable() {
        if (this._inventoryRotatable != null) {
            return this._inventoryRotatable;
        } else {
            return true;
        }
    }

    /**
     * Gets if zooming is allowed in the inventory that the simulation defines.
     */
    get inventoryZoomable() {
        if (this._inventoryZoomable != null) {
            return this._inventoryZoomable;
        } else {
            return true;
        }
    }

    /**
     * Gets the height of the inventory that the simulation defines.
     */
    get inventoryHeight() {
        if (this._inventoryHeight != null) {
            return this._inventoryHeight;
        } else {
            return 0;
        }
    }

    /**
     * Gets the zoom level of the player that the simulation defines.
     */
    get playerZoom() {
        if (this._playerZoom != null) {
            return this._playerZoom;
        } else {
            return null;
        }
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationX() {
        if (this._playerRotationX != null) {
            return this._playerRotationX;
        } else {
            return null;
        }
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationY() {
        if (this._playerRotationY != null) {
            return this._playerRotationY;
        } else {
            return null;
        }
    }

    /**
     * Gets the background color of the inventory that the simulation defines.
     */
    get inventoryColor() {
        if (this._userInventoryColor) {
            return this._userInventoryColor;
        } else if (this._inventoryColor) {
            return this._inventoryColor;
        } else {
            return null;
        }
    }

    constructor(context: string, game: Game, simulation: BrowserSimulation) {
        super(game, simulation);

        this.context = context;
        this._botBackBuffer = new Map();

        const calc = this.simulation.helper.createContext();
        this._setupGrid(calc);
    }

    private _setupGrid(calc: BotCalculationContext) {
        if (this.grid3D) {
            this.remove(this.grid3D);
        }
        let gridScale = calculateGridScale(
            calc,
            this._contextGroup ? this._contextGroup.bot : null
        );
        this.grid3D = new PlayerGrid3D(gridScale).showGrid(false);
        this.grid3D.useAuxCoordinates = true;
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    init() {
        super.init();
    }

    setContext(context: string) {
        if (this.context === context) {
            return;
        }
        this.context = context;
        this.unsubscribe();
        this.closed = false;
        this.init();
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        super._frameUpdateCore(calc);
        this.grid3D.update();
    }

    protected _createContextGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        const _3DContext = this._create3DContextGroup(calc, bot);
        return _3DContext;
    }

    protected _create3DContextGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        if (this._contextGroup) {
            return null;
        }
        // We dont have a context group yet. We are in search of a bot that defines a player context that matches the user's current context.
        const result = doesBotDefinePlayerContext(bot, this.context, calc);
        const contextLocked = isContextLocked(calc, bot);
        if (result.matchFound && !contextLocked) {
            // Create ContextGroup3D for this bot that we will use to render all bots in the context.
            this._contextGroup = new ContextGroup3D(
                this,
                bot,
                'player',
                this.decoratorFactory
            );

            this._setupGrid(calc);

            // Subscribe to bot change updates for this context bot so that we can do things like change the background color to match the context color, etc.
            this._subs.push(
                this.simulation.watcher
                    .botChanged(bot.id)
                    .pipe(
                        tap(update => {
                            const bot = update;
                            // Update the context background color.
                            //let contextBackgroundColor =
                            //bot.tags['auxContextColor'];

                            let contextBackgroundColor = calculateBotValue(
                                calc,
                                bot,
                                `auxContextColor`
                            );

                            this._contextBackground = hasValue(
                                contextBackgroundColor
                            )
                                ? new Color(contextBackgroundColor)
                                : undefined;

                            this._pannable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.pannable`,
                                true
                            );

                            this._panMinX = calculateNumericalTagValue(
                                calc,
                                bot,
                                `aux.context.pannable.min.x`,
                                null
                            );

                            this._panMaxX = calculateNumericalTagValue(
                                calc,
                                bot,
                                `aux.context.pannable.max.x`,
                                null
                            );

                            this._panMinY = calculateNumericalTagValue(
                                calc,
                                bot,
                                `aux.context.pannable.min.y`,
                                null
                            );

                            this._panMaxY = calculateNumericalTagValue(
                                calc,
                                bot,
                                `aux.context.pannable.max.y`,
                                null
                            );

                            this._zoomable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.zoomable`,
                                true
                            );

                            this._zoomMin = calculateNumericalTagValue(
                                calc,
                                bot,
                                `aux.context.zoomable.min`,
                                null
                            );

                            this._zoomMax = calculateNumericalTagValue(
                                calc,
                                bot,
                                `aux.context.zoomable.max`,
                                null
                            );

                            this._rotatable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.rotatable`,
                                true
                            );

                            this._inventoryVisible = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.inventory.visible`,
                                true
                            );

                            this._inventoryPannable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.inventory.pannable`,
                                false
                            );

                            this._inventoryResizable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.inventory.resizable`,
                                true
                            );

                            this._inventoryRotatable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.inventory.rotatable`,
                                true
                            );

                            this._inventoryZoomable = calculateBooleanTagValue(
                                calc,
                                bot,
                                `aux.context.inventory.zoomable`,
                                true
                            );

                            this._inventoryHeight = calculateNumericalTagValue(
                                calc,
                                bot,
                                `auxContextInventoryHeight`,
                                0
                            );

                            this._playerZoom = calculateNumericalTagValue(
                                calc,
                                bot,
                                `auxContextPlayerZoom`,
                                null
                            );

                            this._playerRotationX = calculateNumericalTagValue(
                                calc,
                                bot,
                                `auxContextPlayerRotationX`,
                                null
                            );

                            this._playerRotationY = calculateNumericalTagValue(
                                calc,
                                bot,
                                `auxContextPlayerRotationY`,
                                null
                            );

                            let invColor = calculateBotValue(
                                calc,
                                bot,
                                `auxContextInventoryColor`
                            );

                            this._inventoryColor = hasValue(invColor)
                                ? new Color(invColor)
                                : undefined;
                        })
                    )
                    .subscribe()
            );

            return this._contextGroup;
        } else if (result.matchFound && contextLocked) {
            let message: string = 'The ' + this.context + ' context is locked.';

            this.simulation.helper.transaction(toast(message));

            this._botBackBuffer.set(bot.id, bot);
        } else {
            this._botBackBuffer.set(bot.id, bot);
        }

        return null;
    }

    // protected _createSimulationContextGroup(
    //     calc: BotCalculationContext,
    //     bot: PrecalculatedBot
    // ) {
    //     if (bot.id === this.simulation.helper.userId) {
    //         const userSimulationContextValue =
    //             bot.values['_auxUserChannelsContext'];
    //         if (
    //             !this.simulationContext ||
    //             this.simulationContext.context !== userSimulationContextValue
    //         ) {
    //             this.simulationContext = new SimulationContext(
    //                 this,
    //                 userSimulationContextValue
    //             );
    //             console.log(
    //                 '[PlayerSimulation3D] User changed simulation context to: ',
    //                 userSimulationContextValue
    //             );

    //             return this.simulationContext;
    //         }
    //     }

    //     return null;
    // }

    protected _isContextGroupEvent(event: BotIndexEvent) {
        return (
            super._isContextGroupEvent(event) ||
            (event.bot.id === this.simulation.helper.userId &&
                this._isUserContextGroupEvent(event))
        );
    }

    private _isUserContextGroupEvent(event: BotIndexEvent): boolean {
        return (
            event.tag === '_auxUserMenuContext' ||
            event.tag === '_auxUserChannelsContext'
        );
    }

    // TODO:
    // protected _removeContext(context: ContextGroup3D, removedIndex: number) {
    //     super._removeContext(context, removedIndex);

    //     if (context === this._contextGroup) {
    //         this._contextGroup = null;
    //     }
    // }

    _onLoaded() {
        super._onLoaded();

        // need to cause an action when another user joins
        // Send an event to all bots indicating that the given context was loaded.
        this.simulation.helper.action('onPlayerEnterContext', null, {
            context: this.context,
            player: this.simulation.helper.userBot,
        });
    }

    protected _onBotAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        super._onBotAdded(calc, bot);

        // Change the user's context after first adding and updating it
        // because the callback for update_bot was happening before we
        // could call botUpdated from botAdded.
        if (bot.id === this.simulation.helper.userBot.id) {
            this._updateUserBot(calc, bot);
        }
    }

    unsubscribe() {
        this._contextGroup = null;
        super.unsubscribe();
    }

    private async _updateUserBot(calc: BotCalculationContext, bot: Bot) {
        const userBot = this.simulation.helper.userBot;
        console.log(
            "[PlayerSimulation3D] Setting user's context to: " + this.context
        );
        let userBackgroundColor = calculateBotValue(
            calc,
            bot,
            `auxContextColor`
        );
        this._userInventoryColor = hasValue(userBackgroundColor)
            ? new Color(userBackgroundColor)
            : undefined;
        await this.simulation.helper.updateBot(userBot, {
            tags: { _auxUserContext: this.context },
        });
        await this.simulation.helper.updateBot(userBot, {
            tags: { _auxUserChannel: this.simulation.id },
        });
        this._subs.push(
            this.simulation.watcher
                .botChanged(bot.id)
                .pipe(
                    tap(update => {
                        const bot = update;
                        let userBackgroundColor = calculateBotValue(
                            calc,
                            bot,
                            `auxContextColor`
                        );
                        this._userInventoryColor = hasValue(userBackgroundColor)
                            ? new Color(userBackgroundColor)
                            : undefined;
                    })
                )
                .subscribe()
        );
    }
}
