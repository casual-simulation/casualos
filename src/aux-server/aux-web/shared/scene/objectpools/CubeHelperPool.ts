import type { LineSegments } from '../LineSegments';
import { ObjectPool } from './ObjectPool';
import { createCubeStroke } from '../MeshUtils';

export class CubeHelperPool extends ObjectPool<LineSegments> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: LineSegments): void {
        // Do nothing.
    }

    onRestored(obj: LineSegments): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): LineSegments {
        const lines = createCubeStroke();
        lines.setColor(0x000000);
        return lines;
    }

    getPoolObjectId(obj: LineSegments): string {
        return obj.uuid;
    }

    disposePoolObject(obj: LineSegments): void {
        obj.dispose();
    }
}
