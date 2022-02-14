import {
    fetchProfile,
    MotionController,
} from '@webxr-input-profiles/motion-controllers';
import { XRInputSource, XRPose, XRHandedness } from './WebXRTypes';
import {
    Matrix4,
    Object3D,
    Quaternion,
    Vector3,
} from '@casual-simulation/three';

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
    if (!pose) {
        return;
    }

    obj.matrix.fromArray(pose.transform.matrix);
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);

    obj.updateMatrixWorld();
}

export function decomposePose(pose: XRPose) {
    const matrix = new Matrix4().fromArray(pose.transform.matrix);
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();

    matrix.decompose(position, rotation, scale);

    return {
        position,
        rotation,
        scale,
    };
}

export function handToPortal(hand: XRHandedness) {
    return hand === 'left'
        ? 'leftWristPortal'
        : hand === 'right'
        ? 'rightWristPortal'
        : null;
}

export function portalToHand(portalTag: string): XRHandedness {
    return portalTag === 'leftWristPortal'
        ? 'left'
        : portalTag === 'rightWristPortal'
        ? 'right'
        : null;
}
