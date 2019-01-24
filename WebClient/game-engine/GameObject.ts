import { Object3D, Geometry } from "three";

/**
 * Defines a class for a game object that can contain a mesh and a collider.
 */
export class GameObject extends Object3D {

    /**
     * The colliders that this object has.
     */
    colliders: Object3D[];

    constructor() {
        super();
        this.colliders = [];
    }
}