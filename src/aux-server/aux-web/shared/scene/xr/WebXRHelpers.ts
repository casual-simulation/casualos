import {
    fetchProfile,
    MotionController,
} from '@webxr-input-profiles/motion-controllers';
import { XRInputSource, XRPose, XRHandedness } from './WebXRTypes';
import { Object3D } from 'three';

const uri = '/webxr-profiles';

export async function createMotionController(inputSource: XRInputSource) {
    const promise: Promise<{ profile: any; assetPath: string }> = <any>(
        fetchProfile(inputSource, uri)
    );
    const { profile, assetPath } = await promise.catch((err: any) => {
        console.log('[WebXRHelpers]', err);
        return { profile: null, assetPath: null };
    });
    if (!profile) {
        console.log('[WebXRHelpers] No profile found for input source!');
        return null;
    }
    const motionController = new MotionController(
        inputSource,
        profile,
        assetPath
    );
    return motionController;
}

export function copyPose(pose: XRPose, obj: Object3D) {
    obj.matrix.fromArray(pose.transform.matrix);
    obj.matrix.decompose(obj.position, <any>obj.rotation, obj.scale);
    obj.updateMatrixWorld();
}

export function handToPortal(hand: XRHandedness) {
    return hand === 'left'
        ? 'auxLeftWristPortal'
        : hand === 'right'
        ? 'auxRightWristPortal'
        : null;
}

export function portalToHand(portalTag: string): XRHandedness {
    return portalTag === 'auxLeftWristPortal'
        ? 'left'
        : portalTag === 'auxRightWristPortal'
        ? 'right'
        : null;
}
