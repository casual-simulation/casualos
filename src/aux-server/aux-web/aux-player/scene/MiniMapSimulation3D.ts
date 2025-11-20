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
import type { Bot } from '@casual-simulation/aux-common';
import { MINI_MAP_PORTAL } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import type { CameraRig } from '../../shared/scene/CameraRigFactory';
import type { Game } from '../../shared/scene/Game';
import { MapSimulation3D } from './MapSimulation3D';
import { MiniMapPortalDimensionGroup3D } from './MiniMapPortalDimensionGroup3D';
import { MiniMapPortalConfig } from './MiniMapPortalConfig';
import type { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';

export class MiniMapSimulation3D extends MapSimulation3D {
    name = 'MiniMapSimulation3D';

    get miniConfig() {
        return <MiniMapPortalConfig>this.getPortalConfig(this._portalTag);
    }

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        return this.miniConfig.resizable;
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        return this.miniConfig.height;
    }

    /**
     * Gets the width of the portal.
     */
    get width() {
        return this.miniConfig.width;
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        return this.miniConfig.zoomMin;
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        return this.miniConfig.zoomMax;
    }

    constructor(game: Game, simulation: BrowserSimulation) {
        super(MINI_MAP_PORTAL, game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMiniMapPortalCameraRig();
    }

    protected _createPortalConfig(portalTag: string) {
        if (portalTag === this._portalTag) {
            return new MiniMapPortalConfig(
                portalTag,
                this.simulation,
                this.grid3D
            );
        } else {
            return super._createPortalConfig(portalTag);
        }
    }

    protected _constructDimensionGroup(
        portalTag: string,
        bot: Bot
    ): DimensionGroup3D {
        return new MiniMapPortalDimensionGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }
}
