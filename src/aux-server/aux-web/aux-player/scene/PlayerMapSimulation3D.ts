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
import { MAP_PORTAL } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import type { CameraRig } from '../../shared/scene/CameraRigFactory';
import type { Game } from '../../shared/scene/Game';
import { MapSimulation3D } from './MapSimulation3D';

export class PlayerMapSimulation3D extends MapSimulation3D {
    name = 'PlayerMapSimulation3D';

    constructor(game: Game, simulation: BrowserSimulation) {
        super(MAP_PORTAL, game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMapPortalCameraRig();
    }
}
