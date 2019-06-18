import { Vector3, Vector2, Color } from 'three';
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

        // this.debugDrawTiles(-10, 10, -10, 10, Number.MAX_VALUE);
    }

    /**
     * Retrive the grid tile that contains the given position.
     * @param position The position.
     */
    getTileFromPosition(position: Vector3): GridTile {
        // Snap position to a grid center.
        let tileX = this._snapToTileCoord(position.x);
        let tileY = this._snapToTileCoord(position.z);
        let tilePoints = calculateGridTilePoints(tileX, tileY, this.tileScale);

        let tile: GridTile = {
            center: tilePoints.center,
            corners: tilePoints.corners,
            tileCoordinate: new Vector2(tileX, tileY),
        };

        tile.tileCoordinate = new Vector2(tileX, tileY);
        return tile;
    }

    /**
     * Retrieve the grid tile that matches the given coordinate.
     * @param tileCoordinate The tile coordinate.
     */
    getTileFromCoordinate(x: number, y: number): GridTile {
        let tilePoints = calculateGridTilePoints(x, y, this.tileScale);

        return {
            center: tilePoints.center,
            corners: tilePoints.corners,
            tileCoordinate: new Vector2(x, y),
        };
    }

    /**
     * Draw corners for tiles in given coordinate range for duration.
     */
    // debugDrawTiles(
    //     xStart: number,
    //     xEnd: number,
    //     yStart: number,
    //     yEnd: number,
    //     duration: number
    // ) {
    //     // Debug all tile corner points.
    //     for (let x = xStart; x <= xEnd; x++) {
    //         for (let y = yStart; y <= yEnd; y++) {
    //             let tile = this.getTileFromCoordinate(x, y);
    //             DebugObjectManager.debugPoint(
    //                 tile.corners[0],
    //                 null,
    //                 0.05,
    //                 false,
    //                 new Color('green'),
    //                 duration
    //             );
    //             DebugObjectManager.debugPoint(
    //                 tile.corners[1],
    //                 null,
    //                 0.05,
    //                 false,
    //                 new Color('green'),
    //                 duration
    //             );
    //             DebugObjectManager.debugPoint(
    //                 tile.corners[2],
    //                 null,
    //                 0.05,
    //                 false,
    //                 new Color('green'),
    //                 duration
    //             );
    //             DebugObjectManager.debugPoint(
    //                 tile.corners[3],
    //                 null,
    //                 0.05,
    //                 false,
    //                 new Color('green'),
    //                 duration
    //             );
    //             DebugObjectManager.debugPoint(
    //                 tile.center,
    //                 null,
    //                 0.05,
    //                 false,
    //                 new Color('yellow'),
    //                 duration
    //             );
    //         }
    //     }
    // }

    private _snapToTileCoord(num: number): number {
        // We need to snap the number to a tile coordinate.
        let normalized = num / this.tileScale;
        let remaining = normalized % 1;
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
}

/**
 * Calculates the corner points for a tile of the given scale.
 * The returned values are in tile-relative coordinates.
 * [0] topLeft [1] topRight [2] bottomRight [3] bottomLeft
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
export function calculateGridTilePoints(x: number, y: number, scale: number) {
    const corners = calculateTileCornerPoints(scale);
    const localCenter = calculateGridTileLocalCenter(x, y, scale);

    return {
        center: localCenter,
        corners: corners.map(p => {
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
    scale: number
) {
    const x = gridX * scale;
    const z = gridY * scale; // for some reason the Y coordinate needs mirroring
    return new Vector3(x, 0, z);
}
