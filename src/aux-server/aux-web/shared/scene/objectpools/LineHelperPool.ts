import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { LineHelper } from '../helpers/LineHelper';

export class LineHelperPool extends ObjectPool<LineHelper> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: LineHelper): void {
        // Do nothing.
    }

    onRestored(obj: LineHelper): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): LineHelper {
        return new LineHelper();
    }

    getPoolObjectId(obj: LineHelper): string {
        return obj.uuid;
    }

    disposePoolObject(obj: LineHelper): void {
        disposeObject3D(obj);
    }
}
