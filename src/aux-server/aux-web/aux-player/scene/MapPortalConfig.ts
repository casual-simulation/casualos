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

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MapPortalConfig extends PortalConfig {
    constructor(
        portalTag: string,
        simulation: BrowserSimulation,
        grid3D: TileableGrid3D
    ) {
        super(portalTag, simulation);
        this.grid3D = grid3D;
    }

    protected _clearPortalValues() {
        super._clearPortalValues();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        super._updatePortalValues(calc, bot, portalTag);
        this.gridScale = calculateGridScale(
            calc,
            bot,
            DEFAULT_MAP_PORTAL_SCALE,
            DEFAULT_MAP_PORTAL_GRID_SCALE
        );
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
