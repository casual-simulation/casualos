import { Object3D, Geometry } from 'three';

/**
 * Defines an interface for a game object that contains a set of colliders.
 */
export interface IGameObject {
    /**
     * The colliders that this object has.
     */
    colliders: Object3D[];

    /**
     * Allows object to clean itself up before being removed.
     */
    dispose(): void;
}

/**
 * Defines a class for a game object that can contain a mesh and a collider.
 */
export class GameObject extends Object3D implements IGameObject {
    /**
     * The colliders that this object has.
     */
    colliders: Object3D[];

    /**
     * Whether the object can receive pointer events.
     */
    pointable: boolean;

    constructor() {
        super();
        this.colliders = [];
        this.pointable = true;
    }

    /**
     * Runs any logic that the object needs to do each frame.
     */
    // frameUpdate() {
    // }

    /**
     * Allows object to clean itself up before being removed.
     */
    dispose() {}
}
