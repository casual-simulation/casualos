import { Mesh, Object3D, Line, Vector3, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';
import { GridLevel } from './GridLevel';
import { flatMap, groupBy, minBy, maxBy, values } from 'lodash';

export const Y_OFFSET = 0.01;

/**
 * Defines a mesh that can draw a grid.
 */
export class GridMesh extends Object3D {
    constructor(level: GridLevel) {
        super();
        this.add(constructGridLines(level));
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

    return new LineSegments(geometry, material);
}