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
    private _lineGeometry: BufferGeometry;
    private _linePositionsArray: Float32Array;
    private _lineBufferAttribute: BufferAttribute;
    private _line: Line;

    // Pointer cursor
    private _cursor: Mesh;

    constructor() {
        super();

        // Create the line.
        this._linePositionsArray = new Float32Array(2 * 3); // 2 points, 3 values each (x, y, z).

        this._lineGeometry = new BufferGeometry();
        this._lineBufferAttribute = new BufferAttribute(
            this._linePositionsArray,
            3
        ).setDynamic(true);
        this._lineGeometry.addAttribute('position', this._lineBufferAttribute);

        const lineMaterial = new LineBasicMaterial({
            color: PointerRay_DefaultColor,
        });
        this._line = new Line(this._lineGeometry, lineMaterial);

        this.add(this._line);

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
        this._linePositionsArray[0] = localOrigin.x;
        this._linePositionsArray[1] = localOrigin.y;
        this._linePositionsArray[2] = localOrigin.z;

        let stopDist = this.stopDistance;
        if (stopDist === undefined || stopDist === null) {
            stopDist = PointerRay_DefaultStopDistance;
        }

        const stopPoint = Physics.pointOnRay(this.ray, stopDist);
        const localStopPoint = this.worldToLocal(stopPoint.clone());

        this._linePositionsArray[3] = localStopPoint.x;
        this._linePositionsArray[4] = localStopPoint.y;
        this._linePositionsArray[5] = localStopPoint.z;

        this._lineBufferAttribute.needsUpdate = true;

        // Update cursor position to end point.
        this._cursor.position.copy(localStopPoint);

        if (this.showCursor === undefined || this.showCursor === null) {
            this._cursor.visible = PointerRay_DefaultCursorVisible;
        } else {
            this._cursor.visible = this.showCursor;
        }
    }

    dispose(): void {
        disposeObject3D(this._line);
        this._lineGeometry = null;
        this._linePositionsArray = null;
        this._lineBufferAttribute = null;
    }
}
