import {
    disposeObject3D,
    disposeMesh,
    createCubeStrokeGeometry,
} from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { Vector3, Mesh, LineSegments, LineBasicMaterial } from 'three';

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
        const geo = createCubeStrokeGeometry();
        const material = new LineBasicMaterial({
            color: 0x000000,
        });

        return new LineSegments(geo, material);
    }

    getPoolObjectId(obj: LineSegments): string {
        return obj.uuid;
    }

    disposePoolObject(obj: LineSegments): void {
        disposeMesh(obj);
    }
}
