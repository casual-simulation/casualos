import { Grid3D, GridTile } from './Grid3D';
import { Ray, Vector3 } from '@casual-simulation/three';

/**
 * Defines a class that represents multiple grids.
 */
export class CompoundGrid3D implements Grid3D {
    grids: Grid3D[] = [];

    get enabled() {
        return true;
    }

    get primaryGrid() {
        return this.grids[0];
    }

    getPointFromRay(ray: Ray): Vector3 {
        let closestPoint: Vector3 = null;
        let closestDist: number = Infinity;
        for (let grid of this.grids) {
            if (!grid.enabled) {
                continue;
            }
            const point = grid.getPointFromRay(ray);
            if (point) {
                const dist = ray.origin.distanceTo(point);
                if (dist < closestDist) {
                    closestPoint = point;
                    closestDist = dist;
                }
            }
        }

        return closestPoint;
    }

    getTileFromRay(ray: Ray, roundToWholeNumber?: boolean): GridTile {
        let closestTile: GridTile = null;
        let closestDist: number = Infinity;
        for (let grid of this.grids) {
            if (!grid.enabled) {
                continue;
            }
            const tile = grid.getTileFromRay(ray, roundToWholeNumber);
            if (tile) {
                const dist = ray.origin.distanceTo(tile.center);
                if (dist < closestDist) {
                    closestTile = tile;
                    closestDist = dist;
                }
            }
        }

        return closestTile;
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
