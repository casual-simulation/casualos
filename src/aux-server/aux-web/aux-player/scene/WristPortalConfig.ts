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
    DEFAULT_INVENTORY_PORTAL_RESIZABLE,
    DEFAULT_INVENTORY_PORTAL_HEIGHT,
    DEFAULT_WRIST_PORTAL_WIDTH,
    DEFAULT_WRIST_PORTAL_HEIGHT,
    DEFAULT_WORKSPACE_GRID_SCALE,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WRIST_PORTAL_GRID_SCALE,
    calculateGridScaleFromConstants,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription } from 'rxjs';
import { PortalConfig } from './PortalConfig';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class WristPortalConfig extends PortalConfig {
    private _width: number;
    private _height: number;

    /**
     * Gets whether the portal is resizable.
     */
    get width() {
        if (this._width != null) {
            return this._width;
        } else {
            return DEFAULT_WRIST_PORTAL_WIDTH;
        }
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        if (this._height != null) {
            return this._height;
        } else {
            return DEFAULT_WRIST_PORTAL_HEIGHT;
        }
    }

    constructor(portalTag: string, simulation: BrowserSimulation) {
        super(portalTag, simulation);
        this.grid3D.showGrid(true);
        this._updateGridBounds();
    }

    protected _clearPortalValues() {
        super._clearPortalValues();
        this._width = null;
        this._height = null;
        this._updateGridBounds();
    }

    protected _getDefaultGridScale() {
        return calculateGridScaleFromConstants(
            DEFAULT_WORKSPACE_SCALE,
            DEFAULT_WRIST_PORTAL_GRID_SCALE
        );
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        super._updatePortalValues(calc, bot, portalTag);
        this._width = calculateNumericalTagValue(
            calc,
            bot,
            `auxWristPortalWidth`,
            DEFAULT_WRIST_PORTAL_WIDTH
        );
        this._height = calculateNumericalTagValue(
            calc,
            bot,
            `auxWristPortalHeight`,
            DEFAULT_WRIST_PORTAL_HEIGHT
        );
        this._updateGridBounds();
    }

    private _updateGridBounds() {
        this.grid3D.minX = -(this.width / 2);
        this.grid3D.maxX = this.width / 2;
        this.grid3D.minY = -(this.height / 2);
        this.grid3D.maxY = this.height / 2;
        this.grid3D.showGrid(true, true);
    }
}
