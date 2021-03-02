import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { PlaneHelper, Vector3, Plane } from '@casual-simulation/three';

export class PlaneHelperPool extends ObjectPool<PlaneHelper> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: PlaneHelper): void {
        // Do nothing.
    }

    onRestored(obj: PlaneHelper): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): PlaneHelper {
        return new PlaneHelper(new Plane());
    }

    getPoolObjectId(obj: PlaneHelper): string {
        return obj.uuid;
    }

    disposePoolObject(obj: PlaneHelper): void {
        disposeObject3D(obj);
    }
}
