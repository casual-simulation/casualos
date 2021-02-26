import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { ArrowHelper, Vector3 } from '@casual-simulation/three';

export class ArrowHelperPool extends ObjectPool<ArrowHelper> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: ArrowHelper): void {
        // Do nothing.
    }

    onRestored(obj: ArrowHelper): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): ArrowHelper {
        return new ArrowHelper(new Vector3(0, 0, 0));
    }

    getPoolObjectId(obj: ArrowHelper): string {
        return obj.uuid;
    }

    disposePoolObject(obj: ArrowHelper): void {
        disposeObject3D(obj);
    }
}
