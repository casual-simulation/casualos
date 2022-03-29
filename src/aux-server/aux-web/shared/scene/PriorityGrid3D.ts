import { Ray, Vector3 } from '@casual-simulation/three';
import { Grid3D, GridTile } from './Grid3D';

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
    getWorldPosition(position: { x: number; y: number; z: number }): Vector3 {
        const grid = this.primaryGrid;
        if (!grid) {
            throw new Error(
                'Cannot scale the position because no primrary grid exists!'
            );
        }

        return grid.getWorldPosition(position);
    }

}