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
    BufferGeometry,
    LineBasicMaterial,
    Color,
    BufferAttribute,
    Vector3,
    Line,
    DynamicDrawUsage,
    StaticDrawUsage,
} from '@casual-simulation/three';

/**
 * Creates a line from the start to end position.
 */
export class LineHelper extends Line {
    /**
     * Start position of the line.
     */
    start: Vector3;

    /**
     * End position of the line.
     */
    end: Vector3;

    private _positionArray: Float32Array;
    private _positionAttribute: BufferAttribute;

    constructor(start?: Vector3, end?: Vector3, color?: Color) {
        start = start || new Vector3();
        end = start || new Vector3();
        color = color || new Color('#ffff00');

        const geometry = new BufferGeometry();
        const positionArray = new Float32Array(2 * 3); // 2 points, 3 values each (x, y, z);

        const positionAttribute = new BufferAttribute(positionArray, 3);
        geometry.setAttribute('position', positionAttribute);

        const material = new LineBasicMaterial({
            color: color,
        });

        super(geometry, material);

        this.start = start;
        this.end = end;
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
        this._positionArray[0] = this.start.x;
        this._positionArray[1] = this.start.y;
        this._positionArray[2] = this.start.z;

        this._positionArray[3] = this.end.x;
        this._positionArray[4] = this.end.y;
        this._positionArray[5] = this.end.z;

        this._positionAttribute.needsUpdate = true;
    }
}
