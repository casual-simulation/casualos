import { GridTile } from "./GridTile";

/**
 * Defines an interface that represents a single level of a square grid.
 */
export interface GridLevel {

    /**
     * The tiles.
     */
    tiles: GridTile[];

    /**
     * The height for this level.
     */
    height: number;

    /**
     * The data url for the image.
     */
    _image: string;
}
