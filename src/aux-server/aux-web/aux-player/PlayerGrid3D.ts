import {
    Vector3,
    Vector2,
    Color,
    Object3D,
    Ray,
    LineSegments,
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    MathUtils as ThreeMath,
    Plane,
    PlaneHelper,
    Quaternion,
} from 'three';
import { getOptionalValue } from '../shared/SharedUtils';
import { DebugObjectManager } from '../shared/scene/debugobjectmanager/DebugObjectManager';
import { Physics } from '../shared/scene/Physics';
import { Dictionary } from 'lodash';
import groupBy from 'lodash/groupBy';
import flatMap from 'lodash/flatMap';
import sortBy from 'lodash/sortBy';

export const GRIDLINES_Y_OFFSET = 0.01;
export const GRIDLINES_X_START = -5;
export const GRIDLINES_X_END = 5;
export const GRIDLINES_Y_START = -5;
export const GRIDLINES_Y_END = 5;

/**
 * A grid for Aux Player to help position objects in a dimension.
 */
export class PlayerGrid3D extends Object3D {
    tileScale: number;
    useAuxCoordinates: boolean = false;

    private _gridLines: LineSegments;

    get plane(): Plane {
        const worldQuaternion = this.getWorldQuaternion(new Quaternion());
        const worldUp = this.up.clone().applyQuaternion(worldQuaternion);

        const worldPosition = this.getWorldPosition(new Vector3());
        return new Plane().setFromNormalAndCoplanarPoint(
            worldUp,
            worldPosition
        );
    }

    /**
     * Create new player grid.
     * @param tileScale The scale of each grid tile. Default is 1.
     */
    constructor(tileScale?: number) {
        super();
        this.tileScale = getOptionalValue(tileScale, 1);
    }

    /**
     * Scales the given position by the tile scale and returns the result.
     * @param position The input position.
     */
    getGridPosition(position: Vector3): Vector3 {
        const result = new Vector3()
            .copy(position)
            .divideScalar(this.tileScale);
        return new Vector3(
            result.x,
            this.useAuxCoordinates ? -result.z : result.z,
            result.y
        );
    }

    /**
     * Retrive the grid tile that contains the given position.
     * @param position The world space position.
     */
    getTileFromPosition(position: Vector3): GridTile {
        const localPos = position.clone();
        this.worldToLocal(localPos);

        if (this.useAuxCoordinates) {
            // Flip the z axis to line up with AUX coordinates.
            localPos.z = -localPos.z;
        }

        // Snap position to a grid center.
        let tileX = this._snapToTileCoord(localPos.x);
        let tileY = this._snapToTileCoord(localPos.z);
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
     * Calculates the grid tile that intersects with the given ray.
     * Will return null if the ray does not interesect with the grid.
     * @param ray The ray to test.
     */
    getTileFromRay(ray: Ray): GridTile {
        let planeHit = Physics.pointOnPlane(ray, this.plane);

        if (planeHit) {
            let gridTile = this.getTileFromPosition(planeHit);
            return gridTile;
        }

        return null;
    }

    update(): void {}

    /**
     * Draw corners and centers for tiles in given coordinate range for duration.
     */
    debugDrawTilePoints(
        xStart: number,
        xEnd: number,
        yStart: number,
        yEnd: number,
        duration: number
    ) {
        // Debug all tile corner points.
        for (let x = xStart; x <= xEnd; x++) {
            for (let y = yStart; y <= yEnd; y++) {
                let tile = this.getTileFromCoordinate(x, y);
                DebugObjectManager.drawPoint(
                    tile.corners[0],
                    0.05,
                    new Color('green'),
                    duration
                );
                DebugObjectManager.drawPoint(
                    tile.corners[1],
                    0.05,
                    new Color('green'),
                    duration
                );
                DebugObjectManager.drawPoint(
                    tile.corners[2],
                    0.05,
                    new Color('green'),
                    duration
                );
                DebugObjectManager.drawPoint(
                    tile.corners[3],
                    0.05,
                    new Color('green'),
                    duration
                );
                DebugObjectManager.drawPoint(
                    tile.center,
                    0.05,
                    new Color('yellow'),
                    duration
                );
            }
        }
    }

    showGrid(show: boolean): PlayerGrid3D {
        if (show === undefined || show === null) {
            return;
        }

        if (this._gridLines) {
            this._gridLines.visible = show;
        } else {
            if (show) {
                // Create the grid lines.
                let tiles: GridTile[] = [];
                for (let x = GRIDLINES_X_START; x <= GRIDLINES_X_END; x++) {
                    for (let y = GRIDLINES_Y_START; y <= GRIDLINES_Y_END; y++) {
                        tiles.push(this.getTileFromCoordinate(x, y));
                    }
                }

                this._gridLines = constructGridLines(tiles);
                this.add(this._gridLines);
            }
        }

        return this;
    }

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

function constructGridLines(tiles: GridTile[]): LineSegments {
    const allPoints: Vector3[] = flatMap(tiles, t => t.corners);
    const verticalPoints = groupBy(allPoints, p => p.x);
    const horizontalPoints = groupBy(allPoints, p => p.z);

    let vertices: number[] = [];

    function calcVertices(map: Dictionary<Vector3[]>, prop: 'x' | 'z') {
        const keys = Object.keys(map);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const points = sortBy(map[key], prop);

            if (points.length < 2) {
                continue;
            }

            let minPoint: Vector3 = points[0];
            let maxPoint: Vector3 = points[0];

            let sumDist = 0;
            let count = 0;
            for (let b = 1; b < points.length; b++) {
                let newMax = points[b];

                let dist = newMax[prop] - maxPoint[prop];

                if (dist < 0.01) {
                    continue;
                }

                let avgDist = sumDist / count;
                if (!isNaN(avgDist) && dist > avgDist + 0.01) {
                    vertices.push(
                        minPoint.x,
                        minPoint.y + GRIDLINES_Y_OFFSET,
                        minPoint.z
                    );
                    vertices.push(
                        maxPoint.x,
                        maxPoint.y + GRIDLINES_Y_OFFSET,
                        maxPoint.z
                    );
                    maxPoint = newMax;
                    minPoint = newMax;
                    continue;
                }

                maxPoint = newMax;
                sumDist += dist;
                count += 1;
            }

            vertices.push(
                minPoint.x,
                minPoint.y + GRIDLINES_Y_OFFSET,
                minPoint.z
            );
            vertices.push(
                maxPoint.x,
                maxPoint.y + GRIDLINES_Y_OFFSET,
                maxPoint.z
            );
        }
    }

    calcVertices(horizontalPoints, 'x');
    calcVertices(verticalPoints, 'z');

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));

    const material = new LineBasicMaterial({
        transparent: true,
        color: new Color('#fff'),
        opacity: 0.25,
    });
    const lines = new LineSegments(geometry, material);

    return lines;
}
