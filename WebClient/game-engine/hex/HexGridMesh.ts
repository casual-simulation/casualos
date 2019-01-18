import { Mesh, Object3D } from 'three';
import { HexGrid, hexesInRadius } from './HexGrid';
import { HexMesh } from './HexMesh';
import { Axial } from './Axial';

/**
 * Defines a mesh that represents a HexGrid containing a bunch of HexMesh meshes.
 */
export class HexGridMesh extends Object3D {
    private _grid: HexGrid<HexMesh>;
    private _radius: number;

    constructor(radius: number) {
        super();
        this._grid = new HexGrid();
        this._radius = radius;

        this._fillHexesInRadius();
    }

    private _fillHexesInRadius() {
        const hexPositions = hexesInRadius(this._radius);
        hexPositions.forEach(p => {
            const val = this._grid.getDataAt(p);
            if (!val) {
                const mesh = new HexMesh(p);
                this._grid.setDataAt(p, mesh);
                this.children.push(mesh);
            }
        });
    }
}