/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Ray } from '@casual-simulation/three';
import {
    Object3D,
    Color,
    Mesh,
    MeshBasicMaterial,
    SphereBufferGeometry,
} from '@casual-simulation/three';
import { disposeObject3D } from '../SceneUtils';
import { Physics } from '../Physics';
import { LineHelper } from '../helpers/LineHelper';

export const PointerRay_DefaultColor: Color = new Color('#ffffff');
export const PointerRay_DefaultStopDistance: number = 0.25;
export const PointerRay_DefaultCursorVisible: boolean = false;

export class PointerRay3D extends Object3D {
    name = 'PointerRay3D';
    
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
