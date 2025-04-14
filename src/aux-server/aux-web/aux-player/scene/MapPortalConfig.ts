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
    DEFAULT_MAP_PORTAL_GRID_SCALE,
    DEFAULT_MAP_PORTAL_SCALE,
    DEFAULT_MAP_PORTAL_BASEMAP,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { watchPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription } from 'rxjs';
import { PortalConfig } from './PortalConfig';
import type { TileableGrid3D } from '../../shared/scene/Grid3D';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MapPortalConfig extends PortalConfig {
    private _basemap: string;

    get basemap() {
        return this._basemap ?? DEFAULT_MAP_PORTAL_BASEMAP;
    }

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
        this._basemap = null;
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
        this._basemap = calculateStringTagValue(
            calc,
            bot,
            'auxMapPortalBasemap',
            null
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
