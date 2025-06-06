/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    BotCalculationContext,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    calculateGridScale,
    DEFAULT_MAP_PORTAL_GRID_SCALE,
    DEFAULT_MAP_PORTAL_SCALE,
} from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import type { TileableGrid3D } from '../../shared/scene/Grid3D';
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

    protected _calculateGridScale(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        return calculateGridScale(
            calc,
            bot,
            DEFAULT_MAP_PORTAL_SCALE,
            DEFAULT_MAP_PORTAL_GRID_SCALE
        );
    }
}
