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
import type { Object3D } from '@casual-simulation/three';
import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';

export class Object3DPool extends ObjectPool<Object3D> {
    private _sourceObject: Object3D;

    constructor(
        sourceObject: Object3D,
        name?: string,
        poolEmptyWarn?: boolean
    ) {
        super(name, poolEmptyWarn);

        this._sourceObject = sourceObject.clone(true);
        this._sourceObject.parent = null;
    }

    onRetrieved(obj: Object3D): void {
        // Do nothing.
    }

    onRestored(obj: Object3D): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): Object3D {
        return this._sourceObject.clone(true);
    }

    getPoolObjectId(obj: Object3D): string {
        return obj.uuid;
    }

    disposePoolObject(obj: Object3D): void {
        disposeObject3D(obj);
    }
}
