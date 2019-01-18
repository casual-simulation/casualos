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

    /**
     * Creates a new hex grid mesh that starts with the given radius
     * of hexes filled in.
     * @param radius The radius to fill.
     */
    constructor(radius: number) {
        super();
        this._grid = new HexGrid();
        this._radius = radius;

        this._fillHexesInRadius();
    }

    /**
     * Adds a new hex at the given position.
     * @param pos The position to add the hex at.
     */
    addAt(pos: Axial) {
        const existing = this._grid.getDataAt(pos);
        if (!existing) {
            const hex = new HexMesh(pos);
            this._grid.setDataAt(pos, hex);
            this.add(hex);
        }
    }

    /**
     * Removes the hex at the given grid position.
     * @param pos The grid position of the hex to remove.
     */
    removeAt(pos: Axial) {
        const hex = this._grid.getDataAt(pos);
        if (hex) {
            this._grid.setDataAt(pos, null);
            this.remove(hex);
        }
    }

    private _fillHexesInRadius() {
        const hexPositions = hexesInRadius(this._radius);
        hexPositions.forEach(p => {
            const val = this._grid.getDataAt(p);
            if (!val) {
                const mesh = new HexMesh(p);
                this._grid.setDataAt(p, mesh);
                this.add(mesh);
            }
        });
    }
}