import { Mesh, Object3D, Line, Vector3, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';
import { GridLevel } from './GridLevel';
import { flatMap, groupBy, minBy, maxBy, values } from 'lodash';
import { GridTile } from './GridTile';

export const Y_OFFSET = 0.01;

/**
 * Defines a mesh that can draw a grid.
 */
export class GridMesh extends Object3D {
    level: GridLevel;

    constructor(level: GridLevel) {
        super();
        this.level = level;
        this.add(constructGridLines(level));
    }

    /**
     * Calculates the tile that is closest to the given point.
     * @param point The world position to test.
     */
    closestTileToPoint(point: Vector3) {
        const p = new Vector3().copy(point);
        this.worldToLocal(p);
        
        const validTiles = this.level.tiles.filter(t => t.valid);
        const mapped = validTiles.map(t => ({
            tile: t,
            distance: p.distanceTo(t.localPosition)
        }))
        const closestTile = minBy(mapped, t => t.distance);
        return  closestTile;
    }
}

export function constructGridLines(level: GridLevel): Line {
    const validTiles = level.tiles.filter(t => t.valid);
    const allPairs = flatMap(validTiles, t => [
        [t.localPoints[0], t.localPoints[1]], 
        [t.localPoints[1], t.localPoints[2]],
        [t.localPoints[2], t.localPoints[3]], 
        [t.localPoints[3], t.localPoints[0]], 
    ]);

    const verticies = flatMap(allPairs, (pair => [ 
        pair[0].x, pair[0].y + Y_OFFSET, pair[0].z, 
        pair[1].x, pair[1].y + Y_OFFSET, pair[1].z, 
    ]));

    const geometry = new BufferGeometry();
    geometry.addAttribute('position', new Float32BufferAttribute(verticies, 3));

    const material = new LineBasicMaterial();

    const lines = new LineSegments(geometry, material);
    return lines;
}