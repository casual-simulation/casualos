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
import {
    LineSegments,
    BufferGeometry,
    LineBasicMaterial,
    Color,
    BufferAttribute,
    Vector3,
    DynamicDrawUsage,
    StaticDrawUsage,
} from '@casual-simulation/three';

/**
 * Creates intersecting lines to visualize a point in space.
 */
export class PointHelper extends LineSegments {
    /**
     * Point that this helper is visualizing.
     */
    point: Vector3;

    /**
     * The size of the interesecting lines of the point.
     */
    size: number;

    private _positionArray: Float32Array;
    private _positionAttribute: BufferAttribute;

    constructor(point?: Vector3, size?: number, color?: Color) {
        point = point || new Vector3();
        size = size || 1;
        color = color || new Color('#ffff00');

        const geometry = new BufferGeometry();
        const positionArray = new Float32Array(6 * 3); // 3 points, 3 values each (x, y, z);

        const positionAttribute = new BufferAttribute(positionArray, 3);
        geometry.setAttribute('position', positionAttribute);

        const indices = new Uint16Array([0, 1, 2, 3, 4, 5]);
        geometry.setIndex(new BufferAttribute(indices, 1));

        const material = new LineBasicMaterial({
            color: color,
        });

        super(geometry, material);

        this.point = point;
        this.size = size;
        this._positionArray = positionArray;
        this._positionAttribute = positionAttribute;
        this._updateGeometry();
    }

    setDynamic(dynamic: boolean): void {
        this._positionAttribute.setUsage(
            dynamic ? DynamicDrawUsage : StaticDrawUsage
        );
    }

    updateMatrixWorld(force?: boolean): void {
        this._updateGeometry();
        super.updateMatrixWorld(force);
    }

    private _updateGeometry(): void {
        const halfSize = this.size / 2;
        let start = new Vector3();
        let end = new Vector3();

        // X line.
        start.set(-halfSize, 0, 0);
        end.set(halfSize, 0, 0);
        this._positionArray[0] = start.x;
        this._positionArray[1] = start.y;
        this._positionArray[2] = start.z;
        this._positionArray[3] = end.x;
        this._positionArray[4] = end.y;
        this._positionArray[5] = end.z;

        // Y line.
        start.set(0, -halfSize, 0);
        end.set(0, halfSize, 0);
        this._positionArray[6] = start.x;
        this._positionArray[7] = start.y;
        this._positionArray[8] = start.z;
        this._positionArray[9] = end.x;
        this._positionArray[10] = end.y;
        this._positionArray[11] = end.z;

        // Z line.
        start.set(0, 0, -halfSize);
        end.set(0, 0, halfSize);
        this._positionArray[12] = start.x;
        this._positionArray[13] = start.y;
        this._positionArray[14] = start.z;
        this._positionArray[15] = end.x;
        this._positionArray[16] = end.y;
        this._positionArray[17] = end.z;

        this._positionAttribute.needsUpdate = true;

        this.position.copy(this.point);
    }
}
