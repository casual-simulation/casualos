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
import { disposeObject3D } from '../SceneUtils';
import { ObjectPool } from './ObjectPool';
import { Box3Helper, Vector3, Box3 } from '@casual-simulation/three';

export class Box3HelperPool extends ObjectPool<Box3Helper> {
    constructor(name?: string, poolEmptyWarn?: boolean) {
        super(name, poolEmptyWarn);
    }

    onRetrieved(obj: Box3Helper): void {
        // Do nothing.
    }

    onRestored(obj: Box3Helper): void {
        if (obj.parent) {
            // Remove from its current parent.
            obj.parent.remove(obj);
            obj.parent = null;
        }
    }

    createPoolObject(): Box3Helper {
        const boxHelper = new Box3Helper(
            new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1))
        );
        return boxHelper;
    }

    getPoolObjectId(obj: Box3Helper): string {
        return obj.uuid;
    }

    disposePoolObject(obj: Box3Helper): void {
        disposeObject3D(obj);
    }
}
