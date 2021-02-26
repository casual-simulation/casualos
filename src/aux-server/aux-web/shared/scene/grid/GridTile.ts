import { Vector3, Vector2 } from '@casual-simulation/three';

/**
 * Defines an interface that represents a single grid tile.
 */
export interface GridTile {
    /**
     * Whether or not the tile is in a valid position.
     */
    valid: boolean;

    /**
     * The center of the tile in workspace-relative coordinates.
     */
    localPosition: Vector3;

    /**
     * The square grid position of the tile.
     */
    gridPosition: Vector2;

    /**
     * The workspace relative corner points of the tile.
     */
    localPoints: Vector3[];
}
