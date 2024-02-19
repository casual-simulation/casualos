import { hex } from './Hex';
import {
    Mesh,
    BufferGeometry,
    ExtrudeBufferGeometry,
    Shape,
    Material,
    MeshStandardMaterial,
    Matrix4,
    Vector3,
    MeshBasicMaterial,
    Color,
    Box3,
    Sphere,
    MeshToonMaterial,
} from '@casual-simulation/three';
import { Axial } from './Axial';
import { gridPosToRealPos } from './HexGrid';
import { baseAuxMeshMaterial } from '../SceneUtils';

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

    get color(): Color {
        let material = <MeshStandardMaterial | MeshToonMaterial>this.material;
        return material.color;
    }

    set color(val: Color) {
        if (!val) return;
        let material = <MeshStandardMaterial | MeshToonMaterial>this.material;
        material.color = val;
    }

    get boundingBox(): Box3 {
        return new Box3().setFromObject(this);
    }

    get boundingSphere(): Sphere {
        let box = new Box3().setFromObject(this);
        let sphere = new Sphere();
        sphere = box.getBoundingSphere(sphere);

        return sphere;
    }

    /**
     * Creates a new hex mesh.
     * @param pos The grid position of the hex.
     * @param size The radius of the hex.
     * @param height The default height of the hex.
     */
    constructor(
        pos: Axial = new Axial(),
        size: number,
        height: number,
        material?: Material
    ) {
        super(
            createHexMeshGeometry(size, height),
            createDefaultHexMaterial(material)
        );
        this.receiveShadow = true;
        // TODO: Find a way to fix three.js's shadows so that they don't cause
        // fake 'shadow borders' when hexes the same height are next to each other.
        // this.castShadow = true;
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

    let defaultMat = baseAuxMeshMaterial();
    defaultMat.color.set(0x99999);

    return defaultMat;
}

/**
 * Creates a new buffer geometry for the given hex size and height.
 * @param size The size of the hex.
 * @param height The height of the hex.
 */
export function createHexMeshGeometry(
    size: number,
    height: number
): BufferGeometry {
    const verts = hex(size / Math.sqrt(3));
    const shape = new Shape(verts);
    const geometry = new ExtrudeBufferGeometry(shape, {
        depth: height,
        steps: 1,
        bevelEnabled: false,
    });
    geometry.translate(0, 0, -height * 0.5);

    return geometry;
}
