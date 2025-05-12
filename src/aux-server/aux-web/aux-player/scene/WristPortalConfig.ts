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
    calculateNumericalTagValue,
    DEFAULT_WRIST_PORTAL_WIDTH,
    DEFAULT_WRIST_PORTAL_HEIGHT,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WRIST_PORTAL_GRID_SCALE,
    calculateGridScaleFromConstants,
} from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
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
        this.defaultGrid.showGrid(true);
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

    protected _calculateGridScale(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        return calculateGridScale(
            calc,
            bot,
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
        this.defaultGrid.minX = -(this.width / 2);
        this.defaultGrid.maxX = this.width / 2;
        this.defaultGrid.minY = -(this.height / 2);
        this.defaultGrid.maxY = this.height / 2;
        this.defaultGrid.showGrid(true, true);
    }
}
