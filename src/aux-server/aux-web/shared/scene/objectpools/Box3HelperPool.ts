import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { Box3Helper, Vector3, Box3 } from '@casual-simulation/three';

export class Box3HelperPool extends ObjectPool<Box3Helper> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: Box3Helper): void {
        // Do nothing.
    }

    onRestored(obj: Box3Helper): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): Box3Helper {
        const boxHelper = new Box3Helper(
            new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1))
        );
        return boxHelper;
    }

    getPoolObjectId(obj: Box3Helper): string {
        return obj.uuid;
    }

    disposePoolObject(obj: Box3Helper): void {
        disposeObject3D(obj);
    }
}
