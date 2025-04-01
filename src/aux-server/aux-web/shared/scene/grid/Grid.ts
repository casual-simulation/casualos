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
import { Vector3 } from '@casual-simulation/three';

/**
 * Calculates the corner points for a tile of the given scale.
 * The returned values are in tile-relative coordinates.
 * @param scale The scale of the grid tile.
 */
export function calculateTilePoints(scale: number) {
    const bottomLeft = new Vector3(-0.5 * scale, 0, -0.5 * scale);
    const bottomRight = new Vector3(0.5 * scale, 0, -0.5 * scale);
    const topLeft = new Vector3(-0.5 * scale, 0, 0.5 * scale);
    const topRight = new Vector3(0.5 * scale, 0, 0.5 * scale);
    const points = [topLeft, topRight, bottomRight, bottomLeft];
    return points;
}

/**
 * Calculates the center and corner points of the tile at the given grid position
 * and returns them in GridLevel-relative coordinates.
 * @param x The X position of the grid tile.
 * @param y The Y position of the grid tile.
 * @param z The height of the tile.
 * @param scale The size of the tiles.
 * @param points The tile points that the grid level relative coordinates should be calculated for.
 */
export function calculateGridTileLocalPositions(
    x: number,
    y: number,
    z: number,
    scale: number,
    points: Vector3[]
) {
    const localCenter = calculateGridTileLocalCenter(x, y, z, scale);

    return {
        center: localCenter,
        points: points.map((p) => {
            return new Vector3().copy(p).add(localCenter);
        }),
    };
}

/**
 * Calculates the center position of the tile at the given X and Y grid coordinates.
 * @param gridX The grid X coordinate.
 * @param gridY The grid Y coordinate.
 * @param z The height of the tile.
 * @param scale The size of the tiles.
 */
export function calculateGridTileLocalCenter(
    gridX: number,
    gridY: number,
    z: number,
    scale: number
) {
    return convertCasualOSPositionToThreePosition(gridX, gridY, z, scale);
}

/**
 * Calculates the center position of the tile at the given X and Y grid coordinates.
 * @param gridX The grid X coordinate.
 * @param gridY The grid Y coordinate.
 * @param z The height of the tile.
 * @param scale The size of the tiles.
 */
export function convertCasualOSPositionToThreePosition(
    gridX: number,
    gridY: number,
    z: number,
    scale: number
) {
    const x = gridX * scale;
    const y = gridY * scale; // for some reason the Y coordinate needs mirroring
    z = z * scale;
    return new Vector3(x, y, z);
}
