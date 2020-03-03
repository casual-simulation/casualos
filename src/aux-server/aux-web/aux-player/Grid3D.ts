import { Ray, Vector3, Vector2 } from 'three';

/**
 * Defines an interface for a 3D grid.
 */
export interface Grid3D {
    /**
     * Calculates the grid tile that intersects with the given ray.
     * Will return null if the ray does not interesect with the grid.
     * @param ray The ray to test.
     */
    getTileFromRay(ray: Ray): GridTile;
}

/**
 * Defines an interface for a tile in a 3D grid.
 */
export interface GridTile {
    /**
     * The center of the tile in 3d coordinates.
     */
    center: Vector3;

    /**
     * The corners of the tile in 3d coordinates.
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
