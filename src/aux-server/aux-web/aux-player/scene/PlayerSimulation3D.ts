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
    DEFAULT_PORTAL_ROTATABLE,
    DEFAULT_PORTAL_PANNABLE,
    DEFAULT_PORTAL_ZOOMABLE,
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
    MathUtils as ThreeMath,
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

    private _pannable: boolean = null;
    private _panMinX: number = null;
    private _panMaxX: number = null;
    private _panMinY: number = null;
    private _panMaxY: number = null;

    private _rotatable: boolean = null;

    private _zoomable: boolean = null;
    private _zoomMin: number = null;
    private _zoomMax: number = null;

    private _playerRotationX: number = null;
    private _playerRotationY: number = null;
    private _playerZoom: number = null;
    private _gridScale: number = null;

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
     * Gets the pannability of the inventory camera that the simulation defines.
     */
    get pannable() {
        if (this._pannable != null) {
            return this._pannable;
        } else {
            return DEFAULT_PORTAL_PANNABLE;
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
            return DEFAULT_PORTAL_ROTATABLE;
        }
    }

    /**
     * Gets if zooming is allowed in the inventory that the simulation defines.
     */
    get zoomable() {
        if (this._zoomable != null) {
            return this._zoomable;
        } else {
            return DEFAULT_PORTAL_ZOOMABLE;
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

                        if (bot) {
                            this._updatePortalValues(bot);
                        } else {
                            this._dimensionBackground = null;
                            this._pannable = null;
                            this._panMinX = null;
                            this._panMaxX = null;
                            this._panMinY = null;
                            this._panMaxY = null;
                            this._zoomable = null;
                            this._zoomMin = null;
                            this._zoomMax = null;
                            this._rotatable = null;
                            this._playerZoom = null;
                            this._playerRotationX = null;
                            this._playerRotationY = null;
                            this.gridScale = calculateGridScale(null, null);
                        }
                    })
                )
                .subscribe()
        );
    }

    private _updatePortalValues(bot: PrecalculatedBot) {
        const calc = this.simulation.helper.createContext();
        // Update the dimension background color.
        //let dimensionBackgroundColor =
        //bot.tags['auxPortalColor'];
        let dimensionBackgroundColor = calculateBotValue(
            calc,
            bot,
            `auxPortalColor`
        );
        this._dimensionBackground = hasValue(dimensionBackgroundColor)
            ? new Color(dimensionBackgroundColor)
            : undefined;
        this._pannable = calculateBooleanTagValue(
            calc,
            bot,
            `auxPortalPannable`,
            DEFAULT_PORTAL_PANNABLE
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
            DEFAULT_PORTAL_ZOOMABLE
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
            DEFAULT_PORTAL_ROTATABLE
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
        const dimensionLocked = isDimensionLocked(calc, bot);
        if (dimensionLocked) {
            let message: string =
                'The ' + this.dimension + ' dimension is locked.';
            this.simulation.helper.transaction(toast(message));
            this.unsubscribe();
        }
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
    }

    protected _onBotAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        super._onBotAdded(calc, bot);
    }

    unsubscribe() {
        this._dimensionGroup = null;
        super.unsubscribe();
    }
}
