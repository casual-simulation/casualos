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
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { watchPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription } from 'rxjs';
import { PortalConfig } from './PortalConfig';
import { MiniPortalConfigHelper } from './MiniPortalConfigHelper';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MiniPortalConfig extends PortalConfig {
    private _helper: MiniPortalConfigHelper;

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

    constructor(portalTag: string, simulation: BrowserSimulation) {
        super(portalTag, simulation);
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
}
