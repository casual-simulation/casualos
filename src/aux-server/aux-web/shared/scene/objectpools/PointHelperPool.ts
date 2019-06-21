import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { PointHelper } from '../helpers/PointHelper';

export class PointHelperPool extends ObjectPool<PointHelper> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: PointHelper): void {
        // Do nothing.
    }

    onRestored(obj: PointHelper): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): PointHelper {
        return new PointHelper();
    }

    getPoolObjectId(obj: PointHelper): string {
        return obj.uuid;
    }

    disposePoolObject(obj: PointHelper): void {
        disposeObject3D(obj);
    }
}
