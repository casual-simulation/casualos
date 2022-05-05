export interface XRInputSourcesChangeEvent extends Event {
    added: XRInputSource[];
    removed: XRInputSource[];
}

export interface XRInputSourceEvent extends Event {
    frame: XRFrame;
    inputSource: XRInputSource;
}

export interface XRSession extends EventTarget {
    inputSources: XRInputSource[];
}

export interface XRInputSource {
    handedness: XRHandedness;
    targetRayMode: XRTargetRayMode;
    targetRaySpace: XRSpace;
    gripSpace: XRSpace;
    hand: XRHand | null;
    profiles: string[];
}

export interface XRFrame {
    getPose(space: XRSpace, baseSpace: XRSpace): XRPose;
    getJointPose(joint: XRJointSpace, baseSpace: XRSpace): XRJointPose;
}

export type XRHandedness = 'none' | 'left' | 'right';
export type XRTargetRayMode = 'gaze' | 'tracked-pointer' | 'screen';

export interface XRSpace {}

export interface XRPose {
    transform: XRRigidTransform;
    emulatedPosition: boolean;
}

export interface XRJointPose extends XRPose {
    readonly radius: number | undefined;
}

export interface XRRigidTransform {
    matrix: Float32Array;
}

export interface XRJointSpace {
    readonly jointName: string;
}

export const xrHandJoints = [
    'wrist',
    'thumb-metacarpal',
    'thumb-phalanx-proximal',
    'thumb-phalanx-distal',
    'thumb-tip',
    'index-finger-metacarpal',
    'index-finger-phalanx-proximal',
    'index-finger-phalanx-intermediate',
    'index-finger-phalanx-distal',
    'index-finger-tip',
    'middle-finger-metacarpal',
    'middle-finger-phalanx-proximal',
    'middle-finger-phalanx-intermediate',
    'middle-finger-phalanx-distal',
    'middle-finger-tip',
    'ring-finger-metacarpal',
    'ring-finger-phalanx-proximal',
    'ring-finger-phalanx-intermediate',
    'ring-finger-phalanx-distal',
    'ring-finger-tip',
    'pinky-finger-metacarpal',
    'pinky-finger-phalanx-proximal',
    'pinky-finger-phalanx-intermediate',
    'pinky-finger-phalanx-distal',
    'pinky-finger-tip',
] as const;

export type XRHandJoint = typeof xrHandJoints[number];

export interface XRHand extends Iterable<[XRHandJoint, XRJointSpace]> {
    readonly size: number;

    entries(): IterableIterator<[XRHandJoint, XRJointSpace]>;
    forEach(
        callbackfn: (
            value: XRJointSpace,
            key: XRHandJoint,
            map: Map<XRHandJoint, XRJointSpace>
        ) => void,
        thisArg?: any
    ): void;
    get(key: XRHandJoint): XRJointSpace | undefined;
    keys(): IterableIterator<XRHandJoint>;
    values(): IterableIterator<XRJointSpace>;
}
