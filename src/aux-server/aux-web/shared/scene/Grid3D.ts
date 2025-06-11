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
import type { Ray, Vector3, Vector2 } from '@casual-simulation/three';

/**
 * Defines an interface for a 3D grid.
 */
export interface Grid3D {
    /**
     * Whether the grid is enabled.
     */
    enabled: boolean;

    /**
     * Calculates the grid tile that intersects with the given ray.
     * Will return null if the ray does not interesect with the grid.
     * @param ray The ray to test.
     * @param roundToWholeNumber Whether the grid tile X and Y should be rounded to a whole number.
     */
    getTileFromRay(ray: Ray, roundToWholeNumber: boolean): GridTile;

    /**
     * Calculates the point that the given ray intersects the grid.
     * Will return null if the ray does not intersect with the grid.
     * @param ray The ray to test.
     */
    getPointFromRay(ray: Ray): Vector3;

    /**
     * Gets the grid-local position for the given world position.
     * @param position The world position.
     */
    getGridPosition(position: { x: number; y: number; z: number }): Vector3;

    /**
     * Gets the world position for the given grid-local position.
     * @param gridPosition The grid position.
     */
    getGridWorldPosition(gridPosition: {
        x: number;
        y: number;
        z: number;
    }): Vector3;
}

export interface TileableGrid3D extends Grid3D {
    tileScale: number;
}

/**
 * Defines an interface for a tile in a 3D grid.
 */
export interface GridTile {
    /**
     * The center of the tile in 3d world-space coordinates.
     */
    center: Vector3;

    /**
     * The corners of the tile in 3d world-space coordinates.
     * [0] topLeft [1] topRight [2] bottomRight [3] bottomLeft
     */
    corners: Vector3[];

    /**
     * The 2d coordinate of the tile on the grid.
     */
    tileCoordinate: Vector2;

    /**
     * The grid that the tile is for.
     */
    grid: Grid3D;

    /**
     * Whether the grid tile should be used as a 3D position.
     * Defaults to false.
     */
    is3DTile?: boolean;
}
