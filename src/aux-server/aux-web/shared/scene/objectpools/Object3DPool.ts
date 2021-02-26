import { Object3D } from '@casual-simulation/three';
import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';

export class Object3DPool extends ObjectPool<Object3D> {
    private _sourceObject: Object3D;

    constructor(
        sourceObject: Object3D,
        name?: string,
        poolEmptyWarn?: boolean
    ) {
        super(name, poolEmptyWarn);

        this._sourceObject = sourceObject.clone(true);
        this._sourceObject.parent = null;
    }

    onRetrieved(obj: Object3D): void {
        // Do nothing.
    }

    onRestored(obj: Object3D): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): Object3D {
        return this._sourceObject.clone(true);
    }

    getPoolObjectId(obj: Object3D): string {
        return obj.uuid;
    }

    disposePoolObject(obj: Object3D): void {
        disposeObject3D(obj);
    }
}
