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

    requestReferenceSpace(
        referenceSpaceType: string
    ): Promise<XRReferenceSpace>;
    end(): Promise<void>;
}

export interface XRInputSource {
    gamepad: Gamepad | null;
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
export type XRTargetRayMode =
    | 'gaze'
    | 'tracked-pointer'
    | 'screen'
    | 'transient-pointer';

export interface XRSpace {}

export interface XRPose {
    transform: XRRigidTransformClass;
    emulatedPosition: boolean;
}

export interface XRJointPose extends XRPose {
    readonly radius: number | undefined;
}

declare class XRRigidTransformClass {
    matrix: Float32Array;
    constructor(
        position?: { x: number; y: number; z: number },
        orientation?: { x: number; y: number; z: number; w: number }
    );
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

export type XRHandJoint = (typeof xrHandJoints)[number];

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

export interface XRReferenceSpace {
    getOffsetReferenceSpace(
        originOffset: XRRigidTransformClass
    ): XRReferenceSpace;
}

export const XRRigidTransform = (globalThis as any)
    .XRRigidTransform as typeof XRRigidTransformClass;
