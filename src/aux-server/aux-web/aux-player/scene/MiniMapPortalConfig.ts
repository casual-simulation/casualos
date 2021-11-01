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
    DEFAULT_MINI_PORTAL_RESIZABLE,
    DEFAULT_MINI_PORTAL_HEIGHT,
    DEFAULT_MAP_PORTAL_GRID_SCALE,
    DEFAULT_MAP_PORTAL_SCALE,
    DEFAULT_MAP_PORTAL_BASEMAP,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription } from 'rxjs';
import { PortalConfig } from './PortalConfig';
import { TileableGrid3D } from '../../shared/scene/Grid3D';
import { MapPortalConfig } from './MapPortalConfig';
import { MiniPortalConfigHelper } from './MiniPortalConfigHelper';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MiniMapPortalConfig extends MapPortalConfig {
    private _helper = new MiniPortalConfigHelper();

    private get helper() {
        if (!this._helper) {
            this._helper = new MiniPortalConfigHelper();
        }
        return this._helper;
    }

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        return this.helper.resizable;
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        return this.helper.height;
    }

    /**
     * Gets the width of the portal.
     */
    get width() {
        return this.helper.width;
    }

    constructor(
        portalTag: string,
        simulation: BrowserSimulation,
        grid3D: TileableGrid3D
    ) {
        super(portalTag, simulation, grid3D);
    }

    protected _clearPortalValues() {
        super._clearPortalValues();
        this.helper.clearPortalValues();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        super._updatePortalValues(calc, bot, portalTag);
        this.helper.updatePortalValues(calc, bot, portalTag);
    }

    protected _getDefaultGridScale() {
        return calculateGridScale(
            null,
            null,
            DEFAULT_MAP_PORTAL_SCALE,
            DEFAULT_MAP_PORTAL_GRID_SCALE
        );
    }
}
