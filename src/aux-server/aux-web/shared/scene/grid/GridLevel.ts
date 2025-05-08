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
import type { GridTile } from './GridTile';
import type { Vector3 } from '@casual-simulation/three';

/**
 * Defines an interface that represents a single level of a square grid.
 */
export interface GridLevel {
    /**
     * The tiles.
     */
    tiles: GridTile[];

    /**
     * The number of tiles on this level in the horizontal direction.
     */
    width: number;

    /**
     * The number of tiles on this level in the vertical direction.
     */
    height: number;

    /**
     * The height for this level.
     */
    tileHeight: number;

    /**
     * The real-world size of the level.
     */
    size: Vector3;

    /**
     * The real-world center of the level.
     */
    center: Vector3;

    /**
     * The data url for the image.
     */
    _image: string;
}
