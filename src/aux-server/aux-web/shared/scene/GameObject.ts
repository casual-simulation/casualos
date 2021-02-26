import { Object3D } from '@casual-simulation/three';

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
    private _colliders: Object3D[];

    /**
     * The colliders that this object has.
     */
    get colliders(): Object3D[] {
        return this._colliders;
    }

    /**
     * The colliders that this object has.
     */
    set colliders(value: Object3D[]) {
        this._colliders = value;
    }

    /**
     * Whether the object can receive pointer events.
     */
    pointable: boolean;

    /**
     * Whether the object can receive focus events.
     */
    focusable: boolean;

    constructor() {
        super();
        this.colliders = [];
        this.pointable = true;
        this.focusable = true;
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
