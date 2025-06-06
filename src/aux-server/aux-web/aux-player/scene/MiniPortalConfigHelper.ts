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
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    DEFAULT_MINI_PORTAL_RESIZABLE,
    DEFAULT_MINI_PORTAL_HEIGHT,
} from '@casual-simulation/aux-common';

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
