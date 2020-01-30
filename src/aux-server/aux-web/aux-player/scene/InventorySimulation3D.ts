import {
    Object,
    BotCalculationContext,
    PrecalculatedBot,
    calculateGridScale,
    calculateBotValue,
    hasValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap, filter } from 'rxjs/operators';
import { InventoryContextGroup3D as InventoryDimensionGroup3D } from './InventoryContextGroup3D';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';
import { BotDimensionEvent } from '@casual-simulation/aux-vm';
import { Color, Texture } from 'three';

export class InventorySimulation3D extends Simulation3D {
    /**
     * The inventory dimension that this simulation is for.
     */
    inventoryDimension: string;

    grid3D: PlayerGrid3D;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.
    private _dimensionBackground: Color | Texture;
    private _pannable: boolean;
    private _panMinX: number;
    private _panMaxX: number;
    private _panMinY: number;
    private _panMaxY: number;
    private _zoomable: boolean;
    private _zoomMin: number;
    private _zoomMax: number;
    private _rotatable: boolean;
    private _resizable: boolean;
    private _height: number;
    private _playerZoom: number;
    private _playerRotationX: number;
    private _playerRotationY: number;
    private _gridScale: number;

    get hasDimension() {
        return this.dimensions.length > 0;
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        if (this._dimensionBackground) {
            return this._dimensionBackground;
        } else {
            return null;
        }
    }

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        if (this._resizable != null) {
            return this._resizable;
        } else {
            return true;
        }
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        if (this._height != null) {
            return this._height;
        } else {
            return 0;
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

    get gridScale() {
        return this._gridScale;
    }

    set gridScale(scale: number) {
        if (this._gridScale === scale) {
            return;
        }
        if (this.grid3D) {
            this.remove(this.grid3D);
        }
        this.grid3D = new PlayerGrid3D(scale).showGrid(false);
        this.grid3D.useAuxCoordinates = true;
    }

    constructor(game: Game, simulation: BrowserSimulation) {
        super(game, simulation);

        const calc = this.simulation.helper.createContext();
        let gridScale = calculateGridScale(calc, null);
        this.gridScale = gridScale;
    }

    getMainCameraRig(): CameraRig {
        return this._game.getInventoryCameraRig();
    }

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    filter(bot => !!bot),
                    tap(bot => {
                        const userInventoryDimensionValue =
                            bot.values['auxInventoryPortal'];
                        if (
                            !this.inventoryDimension ||
                            this.inventoryDimension !==
                                userInventoryDimensionValue
                        ) {
                            this.inventoryDimension = userInventoryDimensionValue;

                            console.log(
                                '[InventorySimulation3D] User changed inventory dimension to: ',
                                userInventoryDimensionValue
                            );
                        }
                    })
                )
                .subscribe()
        );
        super.init();
        this._watchDimensionBot();
    }

    protected _getDimensionTags() {
        return ['auxInventoryPortal'];
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
        if (bot.id === this.simulation.helper.userId) {
            return new InventoryDimensionGroup3D(
                this,
                this.simulation.helper.userBot,
                'player',
                this.decoratorFactory
            );
        }

        return null;
    }

    private _watchDimensionBot() {
        this._subs.push(
            watchPortalConfigBot(this.simulation, 'auxInventoryPortal')
                .pipe(
                    tap(update => {
                        const bot = update;
                        const calc = this.simulation.helper.createContext();
                        // Update the dimension background color.
                        //let dimensionBackgroundColor =
                        //bot.tags['auxPortalColor'];
                        let dimensionBackgroundColor = calculateBotValue(
                            calc,
                            bot,
                            `auxPortalColor`
                        );
                        this._dimensionBackground = hasValue(
                            dimensionBackgroundColor
                        )
                            ? new Color(dimensionBackgroundColor)
                            : undefined;
                        this._pannable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxPortalPannable`,
                            true
                        );
                        this._panMinX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPannableMinX`,
                            null
                        );
                        this._panMaxX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPannableMaxX`,
                            null
                        );
                        this._panMinY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPannableMinY`,
                            null
                        );
                        this._panMaxY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPannableMaxY`,
                            null
                        );
                        this._zoomable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxPortalZoomable`,
                            true
                        );
                        this._zoomMin = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalZoomableMin`,
                            null
                        );
                        this._zoomMax = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalZoomableMax`,
                            null
                        );
                        this._rotatable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxPortalRotatable`,
                            true
                        );
                        this._resizable = calculateBooleanTagValue(
                            calc,
                            bot,
                            `auxInventoryPortalResizable`,
                            true
                        );
                        this._height = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxInventoryPortalHeight`,
                            0
                        );
                        this._playerZoom = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPlayerZoom`,
                            null
                        );
                        this._playerRotationX = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPlayerRotationX`,
                            null
                        );
                        this._playerRotationY = calculateNumericalTagValue(
                            calc,
                            bot,
                            `auxPortalPlayerRotationY`,
                            null
                        );
                        this.gridScale = calculateGridScale(calc, bot);
                    })
                )
                .subscribe()
        );
    }
}
