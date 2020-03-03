import { Grid3D, GridTile } from './Grid3D';
import { Ray } from 'three';

/**
 * Defines a class that represents multiple grids.
 */
export class CompoundGrid3D implements Grid3D {
    grids: Grid3D[];

    getTileFromRay(ray: Ray): GridTile {}
}
