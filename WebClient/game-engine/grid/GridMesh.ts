import { Mesh, Object3D, Line, Vector3, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';
import { GridLevel } from './GridLevel';
import { flatMap, groupBy, minBy, maxBy, values } from 'lodash';

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
        [t.worldPoints[0], t.worldPoints[1]], 
        [t.worldPoints[1], t.worldPoints[2]],
        [t.worldPoints[2], t.worldPoints[3]], 
        [t.worldPoints[3], t.worldPoints[0]], 
    ]);

    const verticies = flatMap(allPairs, (pair => [ 
        pair[0].x, pair[0].y, pair[0].z, 
        pair[1].x, pair[1].y, pair[1].z, 
    ]));

    const geometry = new BufferGeometry();
    geometry.addAttribute('position', new Float32BufferAttribute(verticies, 3));

    const material = new LineBasicMaterial();

    return new LineSegments(geometry, material);
}