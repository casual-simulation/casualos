import {
    Mesh,
    Object3D,
    Line,
    Vector3,
    Vector2,
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    LineSegments,
} from '@casual-simulation/three';
import { GridLevel } from './GridLevel';
import { Dictionary, flatMap, groupBy, minBy, sortBy } from 'lodash';
import { disposeMesh } from '../SceneUtils';

export const Y_OFFSET = 0.01;

/**
 * Defines a mesh that can draw a grid.
 */
export class GridMesh extends Object3D {
    tiles: {
        localPosition: Vector3;
        gridPosition: Vector2;
    }[];

    constructor(level: GridLevel) {
        super();
        this.tiles = level.tiles
            .filter((t) => t.valid)
            .map((t) => ({
                localPosition: t.localPosition,
                gridPosition: t.gridPosition,
            }));
        this.add(constructGridLines(level));
    }

    /**
     * Calculates the tile that is closest to the given point.
     * @param point The world position to test.
     */
    closestTileToPoint(point: Vector3) {
        const p = new Vector3().copy(point);
        this.worldToLocal(p);

        const validTiles = this.tiles;
        const mapped = validTiles.map((t) => ({
            tile: t,
            distance: p.distanceTo(t.localPosition),
        }));
        const closestTile = minBy(mapped, (t) => t.distance);
        return closestTile;
    }

    dispose() {
        this.children.forEach((c) => {
            if (c instanceof Line) {
                disposeMesh(c);
            }
        });
    }
}

export function constructGridLines(level: GridLevel): Line {
    const validTiles = level.tiles.filter((t) => t.valid);

    const allPoints = flatMap(validTiles, (t) => t.localPoints);

    const verticalPoints = groupBy(allPoints, (p) => p.x);
    const horizontalPoints = groupBy(allPoints, (p) => p.z);

    let verticies: number[] = [];
    let horizontalKeys = Object.keys(horizontalPoints);
    let verticalKeys = Object.keys(verticalPoints);

    function calcVerticies(
        keys: string[],
        map: Dictionary<Vector3[]>,
        prop: 'x' | 'z'
    ) {
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
                    verticies.push(
                        minPoint.x,
                        minPoint.y + Y_OFFSET,
                        minPoint.z
                    );
                    verticies.push(
                        maxPoint.x,
                        maxPoint.y + Y_OFFSET,
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

            verticies.push(minPoint.x, minPoint.y + Y_OFFSET, minPoint.z);
            verticies.push(maxPoint.x, maxPoint.y + Y_OFFSET, maxPoint.z);
        }
    }

    calcVerticies(horizontalKeys, horizontalPoints, 'x');
    calcVerticies(verticalKeys, verticalPoints, 'z');

    // const allPairs = flatMap(validTiles, t => [
    //     [t.localPoints[0], t.localPoints[1]],
    //     [t.localPoints[1], t.localPoints[2]],
    //     [t.localPoints[2], t.localPoints[3]],
    //     [t.localPoints[3], t.localPoints[0]],
    // ]);

    // const verticies = flatMap(allPairs, (pair => [
    //     pair[0].x, pair[0].y + Y_OFFSET, pair[0].z,
    //     pair[1].x, pair[1].y + Y_OFFSET, pair[1].z,
    // ]));

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(verticies, 3));

    const material = new LineBasicMaterial();

    const lines = new LineSegments(geometry, material);
    return lines;
}
