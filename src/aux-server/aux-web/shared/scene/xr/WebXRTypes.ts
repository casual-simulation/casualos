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
}

export interface XRFrame {
    getPose(space: XRSpace, baseSpace: XRSpace): XRPose;
}

export type XRHandedness = 'none' | 'left' | 'right';
export type XRTargetRayMode = 'gaze' | 'tracked-pointer' | 'screen';

export interface XRSpace {}
export interface XRPose {
    transform: XRRigidTransform;
    emulatedPosition: boolean;
}

export interface XRRigidTransform {
    matrix: Float32Array;
}
