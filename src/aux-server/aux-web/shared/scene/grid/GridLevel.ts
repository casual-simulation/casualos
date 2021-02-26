import { GridTile } from './GridTile';
import { Vector3, Box3 } from '@casual-simulation/three';

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
