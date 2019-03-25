import { Vector3, Vector2 } from 'three';
import { getOptionalValue } from '../shared/SharedUtils';
/**
 * A grid for Aux Player to help position objects in a context.
 */
export class PlayerGrid {

    tileScale: number;

    /**
     * Create new player grid.
     * @param tileScale The scale of each grid tile. Default is 1.
     */
    constructor(tileScale?: number) {
        this.tileScale = getOptionalValue(tileScale, 1);
    }

    /**
     * Retrive the grid tile that contains the given position.
     * @param position The position.
     */
    getTileFromPosition(position: Vector3): GridTile {
        let tile: GridTile = {
            position: position.clone(),
            tileCoordinate: undefined
        };

        // Snap position to a grid center.
        let tileX = this._snapToTileCoord(position.x);
        let tileY = this._snapToTileCoord(position.z);

        tile.tileCoordinate = new Vector2(tileX, tileY);
        return tile;
    }

    /**
     * Retrieve the grid tile that matches the given coordinate.
     * @param tileCoordinate The tile coordinate.
     */
    getTileFromCoordinate(tileCoordinate: Vector2): GridTile {
        let tile: GridTile = {
            position: undefined,
            tileCoordinate: tileCoordinate.clone()
        };

        return tile;
    }

    private _snapToTileCoord(num: number): number {
        // We need to snap the number to a tile coordinate.
        let normalized = num / this.tileScale;
        let remaining = (normalized % 1);
        let whole = normalized - remaining;

        if (remaining >= 0) {
            // Positive side
            if (remaining <= 0.5) {
                num = whole;
            } else {
                num = whole + 1;
            }
        } else {
            // Negative side
            if (remaining >= -0.5) {
                num = whole;
            } else {
                num = whole - 1;
            }
        }
        return num;
    }
}

export interface GridTile {
    /**
     * The center of the tile in 3d coordinates.
     */
    position: Vector3;

    /**
     * The 2d coordinate of the tile on the grid.
     */
    tileCoordinate: Vector2;
}

/**
 * Calculates the corner points for a tile of the given scale.
 * The returned values are in tile-relative coordinates.
 * @param scale The scale of the grid tile.
 */
export function calculateTileCornerPoints(scale: number) {
    const bottomLeft = new Vector3(-0.5 * scale, 0, -0.5 * scale);
    const bottomRight = new Vector3(0.5 * scale, 0, -0.5 * scale);
    const topLeft = new Vector3(-0.5 * scale, 0, 0.5 * scale);
    const topRight = new Vector3(0.5 * scale, 0, 0.5 * scale);
    const points = [topLeft, topRight, bottomRight, bottomLeft];
    return points;
}

/**
 * Calculates the center and corner points of the tile at the given grid position.
 * The returned values are in grid-relative coordinates.
 * @param x The X position of the grid tile.
 * @param y The Y position of the grid tile.
 * @param scale The size of the tiles.
 */
export function calculateGridTile(x: number, y: number, scale: number) {
    const points = calculateTileCornerPoints(scale);
    const localCenter = calculateGridTileLocalCenter(x, y, scale);

    return {
        center: localCenter,
        points: points.map(p => {
            return new Vector3().copy(p).add(localCenter);
        })
    };
}

/**
 * Calculates the center position of the tile at the given X and Y grid coordinates.
 * @param gridX The grid X coordinate.
 * @param gridY The grid Y coordinate.
 * @param z The height of the tile.
 * @param scale The size of the tiles.
 */
export function calculateGridTileLocalCenter(gridX: number, gridY: number, scale: number) {
    const x = (gridX * scale);
    const z = (gridY * scale); // for some reason the Y coordinate needs mirroring
    return new Vector3(x, 0, z)
}