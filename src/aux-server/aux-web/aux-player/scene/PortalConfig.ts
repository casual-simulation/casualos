import {
    isDimensionLocked,
    DEFAULT_PORTAL_ZOOMABLE,
    DEFAULT_PORTAL_PANNABLE,
    hasValue,
    calculateBotValue,
    BotCalculationContext,
    PrecalculatedBot,
    calculateGridScale,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    DEFAULT_PORTAL_ROTATABLE,
    calculateStringTagValue,
    PortalCameraControlsMode,
    calculatePortalCameraControlsMode,
    PortalCameraType,
    getCameraType,
    BotCursorType,
    getPortalCursor,
    getTagPosition,
    getTagRotation,
} from '@casual-simulation/aux-common';
import { Color, Texture } from '@casual-simulation/three';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { BoundedGrid3D } from '../../shared/scene/BoundedGrid3D';
import { AuxTextureLoader } from '../../shared/scene/AuxTextureLoader';
import { Grid3D, TileableGrid3D } from '../../shared/scene/Grid3D';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class PortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _dimensionBackground: Color = null;
    private _backgroundAddress: string = null;
    private _pannable: boolean = null;
    private _panMinX: number = null;
    private _panMaxX: number = null;
    private _panMaxY: number = null;
    private _panMinY: number = null;
    private _zoomable: boolean = null;
    private _zoomMin: number = null;
    private _zoomMax: number = null;
    private _rotatable: boolean = null;
    private _playerZoom: number = null;
    private _playerRotationX: number = null;
    private _playerRotationY: number = null;
    private _showFocusPoint: boolean = null;
    private _cameraControlsMode: PortalCameraControlsMode = null;
    private _gridScale: number;
    private _disableCanvasTransparency: boolean = null;
    private _grid3D: TileableGrid3D;
    private _defaultGrid3D: BoundedGrid3D;
    private _cameraType: PortalCameraType;
    private _cursor: BotCursorType;

    private _onGridScaleUpdated: Subject<void>;

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

    get backgroundAddress() {
        if (this._backgroundAddress) {
            return this._backgroundAddress;
        } else {
            return null;
        }
    }

    /**
     * Gets the pannability of the miniGridPortal camera that the simulation defines.
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
     * Gets if rotation is allowed in the miniGridPortal that the simulation defines.
     */
    get rotatable() {
        if (this._rotatable != null) {
            return this._rotatable;
        } else {
            return DEFAULT_PORTAL_ROTATABLE;
        }
    }

    /**
     * Gets if zooming is allowed in the miniGridPortal that the simulation defines.
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

    get showFocusPoint() {
        if (this._showFocusPoint !== null) {
            return this._showFocusPoint;
        } else {
            return null;
        }
    }

    /**
     * Gets the camera controls mode that the portal is using.
     */
    get cameraControlsMode() {
        if (this._cameraControlsMode !== null) {
            return this._cameraControlsMode;
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
        this._gridScale = scale;
        this._grid3D.tileScale = scale;
        this._onGridScaleUpdated.next();
    }

    get disableCanvasTransparency() {
        if (this._disableCanvasTransparency != null) {
            return this._disableCanvasTransparency;
        } else {
            return null;
        }
    }

    protected get defaultGrid(): BoundedGrid3D {
        return this._defaultGrid3D;
    }

    get grid3D() {
        return this._grid3D;
    }

    set grid3D(value: TileableGrid3D) {
        this._grid3D = value;
    }

    get cameraType() {
        return this._cameraType;
    }

    get cursor() {
        return this._cursor;
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get portalTag() {
        return this._portalTag;
    }

    get onGridScaleUpdated(): Observable<void> {
        return this._onGridScaleUpdated;
    }

    constructor(portalTag: string, simulation: BrowserSimulation) {
        this._portalTag = portalTag;
        this._onGridScaleUpdated = new Subject();
        this._defaultGrid3D = this._grid3D = new BoundedGrid3D().showGrid(
            false
        );
        this._defaultGrid3D.useAuxCoordinates = true;
        this._sub = watchPortalConfigBot(simulation, portalTag)
            .pipe(
                tap((update) => {
                    const bot = update;

                    if (bot) {
                        const calc = simulation.helper.createContext();
                        this._updatePortalValues(calc, bot, portalTag);
                    } else {
                        this._clearPortalValues();
                    }
                })
            )
            .subscribe();

        let gridScale = this._getDefaultGridScale();
        this.gridScale = gridScale;
    }

    protected _getDefaultGridScale() {
        return calculateGridScale(null, null);
    }

    protected _clearPortalValues() {
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
        this._showFocusPoint = null;
        this._cameraControlsMode = null;
        this._disableCanvasTransparency = null;
        this._cameraType = null;
        this._cursor = null;
        this.gridScale = this._getDefaultGridScale();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        // Update the dimension background color.
        let dimensionBackgroundColor = calculateBotValue(
            calc,
            bot,
            `auxPortalColor`
        );

        this._dimensionBackground = hasValue(dimensionBackgroundColor)
            ? new Color(dimensionBackgroundColor)
            : undefined;

        this._backgroundAddress = calculateStringTagValue(
            calc,
            bot,
            'auxPortalBackgroundAddress',
            null
        );
        this._pannable = calculateBooleanTagValue(
            calc,
            bot,
            `auxPortalPannable`,
            DEFAULT_PORTAL_PANNABLE
        );
        const panMin = getTagPosition(bot, 'auxPortalPannableMin', null);
        const panMax = getTagPosition(bot, 'auxPortalPannableMax', null);
        this._panMinX = panMin.x;
        this._panMaxX = panMax.x;
        this._panMinY = panMin.y;
        this._panMaxY = panMax.y;

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
            `auxPortalCameraZoom`,
            null
        );

        // portalCameraRotation is in polar cordinates, so we don't need a real rotation - we simply need the values from the tags.
        const portalCameraRotation = getTagPosition(
            bot,
            'auxPortalCameraRotation',
            null
        );
        this._playerRotationX = portalCameraRotation.x;
        this._playerRotationY = portalCameraRotation.y;

        this._showFocusPoint = calculateBooleanTagValue(
            calc,
            bot,
            `auxPortalShowFocusPoint`,
            null
        );
        this._cameraControlsMode = calculatePortalCameraControlsMode(calc, bot);
        this._disableCanvasTransparency = calculateBooleanTagValue(
            calc,
            bot,
            'auxPortalDisableCanvasTransparency',
            null
        );
        this._cameraType = getCameraType(calc, bot);
        this._cursor = getPortalCursor(calc, bot);
        this.gridScale = calculateGridScale(calc, bot);

        // TODO:
        // const dimensionLocked = isDimensionLocked(calc, bot);
        // if (dimensionLocked) {
        //     let message: string =
        //         'The ' + this.dimension + ' dimension is locked.';
        //     this.simulation.helper.transaction(toast(message));
        //     this.unsubscribe();
        // }
    }
}
