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
import type { Vector2, Object3D } from '@casual-simulation/three';
import { MouseButtonId } from '../../scene/Input';

export const DragThreshold: number = 0.03;
export const MiddleDragThreshold: number = 0.001;
export const VRDragAngleThreshold: number = 0.06;
export const VRDragPosThreshold: number = 0.03;

export const FingerClickThreshold = 0.01;

export const MaxFingerClickTimeMs = 3000;

export function DragThresholdPassed(
    startScreenPos: Vector2,
    curScreenPos: Vector2,
    buttonId: number
): boolean {
    const distance = curScreenPos.distanceTo(startScreenPos);
    if (buttonId === MouseButtonId.Middle) {
        return distance >= MiddleDragThreshold;
    } else {
        return distance >= DragThreshold;
    }
}

export function VRDragThresholdPassed(
    startPose: Object3D,
    curPose: Object3D
): boolean {
    const angle = curPose.quaternion.angleTo(startPose.quaternion);
    const distance = curPose.position.distanceTo(startPose.position);

    // Use both orientation and/or position of vr controller pose to decide when to start dragging.
    const anglePassed = angle >= VRDragAngleThreshold;
    const distPassed = distance >= VRDragPosThreshold;

    return anglePassed || distPassed;
}

export function posesEqual(first: Object3D, second: Object3D): boolean {
    return (
        first.position.equals(second.position) &&
        first.rotation.equals(second.rotation)
    );
}
