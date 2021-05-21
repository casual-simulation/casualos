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
export class MiniPortalConfig extends PortalConfig {
    private _resizable: boolean;
    private _height: number;

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        if (this._resizable != null) {
            return this._resizable;
        } else {
            return DEFAULT_MINI_PORTAL_RESIZABLE;
        }
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        if (this._height != null) {
            return this._height;
        } else {
            return DEFAULT_MINI_PORTAL_HEIGHT;
        }
    }

    constructor(portalTag: string, simulation: BrowserSimulation) {
        super(portalTag, simulation);
    }

    protected _clearPortalValues() {
        super._clearPortalValues();
        this._resizable = null;
        this._height = null;
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        super._updatePortalValues(calc, bot, portalTag);
        this._resizable = calculateBooleanTagValue(
            calc,
            bot,
            `auxMiniPortalResizable`,
            DEFAULT_MINI_PORTAL_RESIZABLE
        );
        this._height = calculateNumericalTagValue(
            calc,
            bot,
            `auxMiniPortalHeight`,
            DEFAULT_MINI_PORTAL_HEIGHT
        );
    }
}
