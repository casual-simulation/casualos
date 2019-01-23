import { HEX_SIZE, hex } from "./Hex";
import { Mesh, BufferGeometry, ExtrudeBufferGeometry, Shape, Material, MeshStandardMaterial, Matrix4, Vector3, MeshBasicMaterial } from "three";
import { Axial } from "./Axial";
import { gridPosToRealPos } from "./HexGrid";

export const HEX_HEIGHT = 1;

/**
 * Defines a class that represents a 3D Hex.
 */
export class HexMesh extends Mesh {

    private _gridPosition: Axial;
    private _size: number;
    private _height: number;

    /**
     * Gets the current grid position of this hex.
     */
    get gridPosition(): Axial {
        return this._gridPosition;
    }

    /**
     * Sets the grid position of this hex.
     */
    set gridPosition(val: Axial) {
        this._gridPosition = val;
        const pos = gridPosToRealPos(this._gridPosition, this._size);
        this.position.set(pos.x, 0, pos.y);
    }

    /**
     * Gets the height of the hex.
     */
    get height() {
        return this._height;
    }

    /**
     * Sets the height of the hex.
     */
    set height(val: number) {
        this._height = val;
        this._updateGeo();
    }

    /**
     * Creates a new hex mesh.
     * @param pos The grid position of the hex.
     * @param size The radius of the hex.
     * @param height The default height of the hex.
     */
    constructor(pos: Axial = new Axial(), size: number = HEX_SIZE, height: number = HEX_HEIGHT, material?: Material) {
        super(createHexMeshGeometry(size, height), createDefaultHexMaterial(material));
        this._size = size;
        this._height = height;
        this.gridPosition = pos;
    }

    private _updateGeo() {
        this.geometry = createHexMeshGeometry(this._size, this._height);
    }
}

export function createDefaultHexMaterial(mat: Material): Material {
    if (mat) {
        return mat;
    }
    return new MeshStandardMaterial({
        color: 0x999999,
        roughness: .7,
    })
}

/**
 * Creates a new buffer geometry for the given hex size and height.
 * @param size The size of the hex.
 * @param height The height of the hex.
 */
export function createHexMeshGeometry(size: number, height: number): BufferGeometry {
    const verts = hex(size);
    const shape = new Shape(verts);
    const geometry = new ExtrudeBufferGeometry(shape, {
        depth: height,
        steps: 1,
        bevelEnabled: false,
    });
    geometry.rotateX(-90 * (Math.PI / 180));

    return geometry;
}