import {
    Object3D,
    Ray,
    Color,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    BufferAttribute,
    Float32BufferAttribute,
    Mesh,
    MeshBasicMaterial,
    SphereBufferGeometry,
} from 'three';
import {
    baseAuxMeshMaterial,
    disposeMesh,
    disposeObject3D,
} from '../SceneUtils';
import { Physics } from '../Physics';
import { LineHelper } from '../helpers/LineHelper';

export const PointerRay_DefaultColor: Color = new Color('#ffffff');
export const PointerRay_DefaultStopDistance: number = 10000;
export const PointerRay_DefaultCursorVisible: boolean = false;

export class PointerRay3D extends Object3D {
    /**
     * The ray that this pointer ray 3d object is representing.
     */
    ray: Ray;

    /**
     * The distance down the ray that the 3d line should stop.
     */
    stopDistance: number;

    /**
     * Wether or not the cursor is visible.
     */
    showCursor: boolean;

    // Pointer line
    private _lineHelper: LineHelper;

    // Pointer cursor
    private _cursor: Mesh;

    constructor() {
        super();

        // Create the line.
        this._lineHelper = new LineHelper(null, null, PointerRay_DefaultColor);
        this._lineHelper.setDynamic(true);
        this.add(this._lineHelper);

        // Create the cursor.
        const cursorMaterial = new MeshBasicMaterial({
            color: PointerRay_DefaultColor,
        });
        const cursorGeometry = new SphereBufferGeometry(0.015, 16, 16);
        this._cursor = new Mesh(cursorGeometry, cursorMaterial);

        this.add(this._cursor);
    }

    update(): void {
        // Update line start and end points.
        const localOrigin = this.worldToLocal(this.ray.origin.clone());
        this._lineHelper.start = localOrigin;

        let stopDist = this.stopDistance;
        if (stopDist === undefined || stopDist === null) {
            stopDist = PointerRay_DefaultStopDistance;
        }

        const stopPoint = Physics.pointOnRay(this.ray, stopDist);
        const localStopPoint = this.worldToLocal(stopPoint.clone());

        this._lineHelper.end = localStopPoint;

        // Update cursor position to end point.
        this._cursor.position.copy(localStopPoint);

        if (this.showCursor === undefined || this.showCursor === null) {
            this._cursor.visible = PointerRay_DefaultCursorVisible;
        } else {
            this._cursor.visible = this.showCursor;
        }
    }

    dispose(): void {
        disposeObject3D(this._lineHelper);
    }
}
