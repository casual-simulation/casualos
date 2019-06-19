import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';
import { Game } from 'aux-web/shared/scene/Game';

export const DragThreshold: number = 0.03;
export const VRDragAngleThreshold: number = 0.06;
export const VRDragPosThreshold: number = 0.03;

export function DragThresholdPassed(
    startScreenPos: Vector2,
    curScreenPos: Vector2
): boolean {
    const distance = curScreenPos.distanceTo(startScreenPos);
    return distance >= DragThreshold;
}

export function VRDragThresholdPassed(startPose: Pose, curPose: Pose): boolean {
    const angle = curPose.quaternion.angleTo(startPose.quaternion);
    const distance = curPose.position.distanceTo(startPose.position);

    // Use both orientation and/or position of vr controller pose to decide when to start dragging.
    const anglePassed = angle >= VRDragAngleThreshold;
    const distPassed = distance >= VRDragPosThreshold;

    return anglePassed || distPassed;
}
