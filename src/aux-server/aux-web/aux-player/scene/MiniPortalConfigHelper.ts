import type {
    BotCalculationContext,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    isDimensionLocked,
    DEFAULT_PORTAL_ZOOMABLE,
    DEFAULT_PORTAL_PANNABLE,
    hasValue,
    calculateBotValue,
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
export class MiniPortalConfigHelper {
    private _resizable: boolean;
    private _height: number;
    private _width: number;

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

    /**
     * Gets the width of the portal.
     */
    get width() {
        if (this._width != null) {
            return this._width;
        } else {
            return null;
        }
    }

    clearPortalValues() {
        this._resizable = null;
        this._height = null;
        this._width = null;
    }

    updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
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
        this._width = calculateNumericalTagValue(
            calc,
            bot,
            `auxMiniPortalWidth`,
            null
        );
    }
}
