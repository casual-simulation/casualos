import { Vector2, Object3D, Sphere } from '@casual-simulation/three';

export const DragThreshold: number = 0.03;
export const VRDragAngleThreshold: number = 0.06;
export const VRDragPosThreshold: number = 0.03;

export const FingerClickThreshold = 0.01;

export const MaxFingerClickTimeMs = 3000;

export function DragThresholdPassed(
    startScreenPos: Vector2,
    curScreenPos: Vector2
): boolean {
    const distance = curScreenPos.distanceTo(startScreenPos);
    return distance >= DragThreshold;
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
