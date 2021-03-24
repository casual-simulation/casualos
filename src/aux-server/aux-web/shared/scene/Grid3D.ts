import { SnapPoint } from '@casual-simulation/aux-common';
import { Ray, Vector3, Vector2 } from '@casual-simulation/three';

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
    getTileFromRay(ray: Ray, roundToWholeNumber?: boolean): GridTile;

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
    getWorldPosition(gridPosition: {
        x: number;
        y: number;
        z: number;
    }): Vector3;
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
}
