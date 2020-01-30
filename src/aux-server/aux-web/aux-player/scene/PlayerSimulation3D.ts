import {
    Bot,
    BotCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isDimensionLocked,
    calculateGridScale,
    PrecalculatedBot,
    toast,
    calculateBotValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    BotIndexEvent,
    DEFAULT_INVENTORY_VISIBLE,
    getPortalConfigBotID,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    userBotTagsChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    tap,
    filter,
    map,
    distinctUntilChanged,
    switchMap,
} from 'rxjs/operators';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { doesBotDefinePlayerDimension } from '../PlayerUtils';
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
import { UpdatedBotInfo, BotDimensionEvent } from '@casual-simulation/aux-vm';

export class PlayerSimulation3D extends Simulation3D {
    /**
     * The current dimension group 3d that the AUX Player is rendering.
     */
    private _dimensionGroup: DimensionGroup3D;

    private _dimensionBackground: Color | Texture = null;
    private _inventoryColor: Color | Texture = null;
    private _userInventoryColor: Color | Texture = null;
    private _inventoryVisible: boolean = DEFAULT_INVENTORY_VISIBLE;

    private _inventoryPannable: boolean = false;
    private _inventoryPanMinX: number = null;
    private _inventoryPanMaxX: number = null;
    private _inventoryPanMinY: number = null;
    private _inventoryPanMaxY: number = null;

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

    get dimension(): string {
        if (this._dimensionGroup) {
            const dimensions = [...this._dimensionGroup.dimensions.values()];
            return dimensions[0] || null;
        }
        return null;
    }
    grid3D: PlayerGrid3D;

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        if (this._dimensionBackground) {
            return this._dimensionBackground;
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
            return DEFAULT_INVENTORY_VISIBLE;
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
     * Gets the minimum value the inventory's pan can be set to on the x axis
     */
    get inventoryPanMinX() {
        if (this._inventoryPanMinX != null) {
            return this._inventoryPanMinX;
        } else {
            return null;
        }
    }

    /**
     * Gets the maximum value the inventory's pan can be set to on the x axis
     */
    get inventoryPanMaxX() {
        if (this._inventoryPanMaxX != null) {
            return this._inventoryPanMaxX;
        } else {
            return null;
        }
    }

    /**
     * Gets the minimum value the inventory's pan can be set to on the y axis
     */
    get inventoryPanMinY() {
        if (this._inventoryPanMinY != null) {
            return this._inventoryPanMinY;
        } else {
            return null;
        }
    }

    /**
     * Gets the maximum value the inventory's pan can be set to on the y axis
     */
    get inventoryPanMaxY() {
        if (this._inventoryPanMaxY != null) {
            return this._inventoryPanMaxY;
        } else {
            return null;
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

    constructor(game: Game, simulation: BrowserSimulation) {
        super(game, simulation);

        const calc = this.simulation.helper.createContext();
        this._setupGrid(calc);
    }

    private _setupGrid(calc: BotCalculationContext) {
        if (this.grid3D) {
            this.remove(this.grid3D);
        }
        let gridScale = calculateGridScale(
            calc,
            this._dimensionGroup ? this._dimensionGroup.bot : null
        );
        this.grid3D = new PlayerGrid3D(gridScale).showGrid(false);
        this.grid3D.useAuxCoordinates = true;
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    init() {
        super.init();
        this._watchDimensionBot();
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        super._frameUpdateCore(calc);
        this.grid3D.update();
    }

    protected _getDimensionTags() {
        return ['auxPagePortal'];
    }

    protected _filterDimensionEvent(
        calc: BotCalculationContext,
        event: BotDimensionEvent
    ): boolean {
        // Only allow dimensions defined on the user's bot
        if (
            event.type === 'dimension_added' ||
            event.type === 'dimension_removed'
        ) {
            return event.dimensionBot.id === this.simulation.helper.userId;
        }
        return super._filterDimensionEvent(calc, event);
    }

    protected _createDimensionGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        if (this._dimensionGroup) {
            return null;
        }

        this._dimensionGroup = new DimensionGroup3D(
            this,
            this.simulation.helper.userBot,
            'player',
            this.decoratorFactory
        );

        // TODO: Update to support locking dimensions
        return this._dimensionGroup;
    }

    private _watchDimensionBot() {
        this._subs.push(
            watchPortalConfigBot(this.simulation, 'auxPagePortal')
                .pipe(
                    tap(update => {
                        const bot = update;
                        const calc = this.simulation.helper.createContext();
                        // Update the dimension background color.
                        //let dimensionBackgroundColor =
                        //bot.tags['auxDimensionColor'];
                        let dimensionBackgroundColor = calculateBotValue(
                            calc,
                            bot,
                            `auxDimensionColor`
                        );
                        this._dimensionBackground = hasValue(
                            dimensionBackgroundColor
                        )
                            ? new Color(dimensionBackgroundColor)
                            : undefined;
                        this._pannable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionPannable`,
                            true
                        );
                        this._panMinX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPannableMinX`,
                            null
                        );
                        this._panMaxX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPannableMaxX`,
                            null
                        );
                        this._panMinY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPannableMinY`,
                            null
                        );
                        this._panMaxY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPannableMaxY`,
                            null
                        );
                        this._zoomable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionZoomable`,
                            true
                        );
                        this._zoomMin = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionZoomableMin`,
                            null
                        );
                        this._zoomMax = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionZoomableMax`,
                            null
                        );
                        this._rotatable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionRotatable`,
                            true
                        );
                        this._inventoryVisible = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryVisible`,
                            DEFAULT_INVENTORY_VISIBLE
                        );
                        this._inventoryPannable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryPannable`,
                            false
                        );
                        this._inventoryPanMinX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryPannableMinX`,
                            null
                        );
                        this._inventoryPanMaxX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryPannableMaxX`,
                            null
                        );
                        this._inventoryPanMinY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryPannableMinY`,
                            null
                        );
                        this._inventoryPanMaxY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryPannableMaxY`,
                            null
                        );
                        this._inventoryResizable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryResizable`,
                            true
                        );
                        this._inventoryRotatable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryRotatable`,
                            true
                        );
                        this._inventoryZoomable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryZoomable`,
                            true
                        );
                        this._inventoryHeight = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionInventoryHeight`,
                            0
                        );
                        this._playerZoom = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPlayerZoom`,
                            null
                        );
                        this._playerRotationX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPlayerRotationX`,
                            null
                        );
                        this._playerRotationY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxDimensionPlayerRotationY`,
                            null
                        );
                        let invColor = calculateBotValue(
                            calc,
                            bot,
                            `auxDimensionInventoryColor`
                        );
                        this._inventoryColor = hasValue(invColor)
                            ? new Color(invColor)
                            : undefined;
                    })
                )
                .subscribe()
        );
    }

    protected _isDimensionGroupEvent(event: BotIndexEvent) {
        return (
            super._isDimensionGroupEvent(event) ||
            (event.bot.id === this.simulation.helper.userId &&
                this._isUserDimensionGroupEvent(event))
        );
    }

    private _isUserDimensionGroupEvent(event: BotIndexEvent): boolean {
        return event.tag === 'auxMenuPortal';
    }

    // TODO:
    // protected _removeDimension(dimension: DimensionGroup3D, removedIndex: number) {
    //     super._removeDimension(dimension, removedIndex);

    //     if (dimension === this._dimensionGroup) {
    //         this._dimensionGroup = null;
    //     }
    // }

    _onLoaded() {
        super._onLoaded();

        // need to cause an action when another user joins
        // Send an event to all bots indicating that the given dimension was loaded.
        this.simulation.helper.action('onPlayerEnterDimension', null, {
            dimension: this.dimension,
            player: this.simulation.helper.userBot,
        });
    }

    protected _onBotAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        super._onBotAdded(calc, bot);

        // Change the user's dimension after first adding and updating it
        // because the callback for update_bot was happening before we
        // could call botUpdated from botAdded.
        if (bot.id === this.simulation.helper.userId) {
            this._updateUserBot(calc, bot);
        }

        // TODO: Fix
        // // We dont have a dimension group yet. We are in search of a bot that defines a player dimension that matches the user's current dimension.
        // const result = doesBotDefinePlayerDimension(bot, this.dimension, calc);
        // const dimensionLocked = isDimensionLocked(calc, bot);
        // if (result.matchFound && !dimensionLocked) {
        //     this._setupGrid(calc);

        //     // Subscribe to bot change updates for this dimension bot so that we can do things like change the background color to match the dimension color, etc.
        //     this._watchDimensionBot(bot, calc);
        // } else if (result.matchFound && dimensionLocked) {
        //     let message: string =
        //         'The ' + this.dimension + ' dimension is locked.';

        //     this.simulation.helper.transaction(toast(message));
        //     this.unsubscribe();
        // }
    }

    unsubscribe() {
        this._dimensionGroup = null;
        super.unsubscribe();
    }

    private async _updateUserBot(calc: BotCalculationContext, bot: Bot) {
        let userBackgroundColor = calculateBotValue(
            calc,
            bot,
            `auxDimensionColor`
        );
        this._userInventoryColor = hasValue(userBackgroundColor)
            ? new Color(userBackgroundColor)
            : undefined;
        this._subs.push(
            this.simulation.watcher
                .botChanged(bot.id)
                .pipe(
                    filter(bot => !!bot),
                    tap(update => {
                        const bot = update;
                        let userBackgroundColor = calculateBotValue(
                            calc,
                            bot,
                            `auxDimensionColor`
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
