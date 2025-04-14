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
import type { Ray, Vector3 } from '@casual-simulation/three';
import type { Grid3D, GridTile } from './Grid3D';

/**
 * Defines a class that provides an implementation of Grid3D that is able to represent multiple grids based on their given priority.
 */
export class PriorityGrid3D implements Grid3D {
    /**
     * The list of grids that this priority grid represents.
     */
    grids: Grid3D[] = [];

    get enabled() {
        return true;
    }

    get primaryGrid() {
        return this.grids[0];
    }

    getPointFromRay(ray: Ray): Vector3 {
        for (let grid of this.grids) {
            if (!grid.enabled) {
                continue;
            }
            const point = grid.getPointFromRay(ray);
            if (point) {
                return point;
            }
        }

        return null;
    }

    getTileFromRay(ray: Ray, roundToWholeNumber: boolean): GridTile {
        for (let grid of this.grids) {
            if (!grid.enabled) {
                continue;
            }
            const tile = grid.getTileFromRay(ray, roundToWholeNumber);
            if (tile) {
                return tile;
            }
        }

        return null;
    }

    /**
     * Scales the given position by the tile scale and returns the result.
     * @param position The input position.
     */
    getGridPosition(position: { x: number; y: number; z: number }): Vector3 {
        const grid = this.primaryGrid;
        if (!grid) {
            throw new Error(
                'Cannot scale the position because no primrary grid exists!'
            );
        }

        return grid.getGridPosition(position);
    }

    /**
     * Scales the given position by the tile scale and returns the result.
     * @param position The input position.
     */
    getGridWorldPosition(position: {
        x: number;
        y: number;
        z: number;
    }): Vector3 {
        const grid = this.primaryGrid;
        if (!grid) {
            throw new Error(
                'Cannot scale the position because no primrary grid exists!'
            );
        }

        return grid.getGridWorldPosition(position);
    }
}
