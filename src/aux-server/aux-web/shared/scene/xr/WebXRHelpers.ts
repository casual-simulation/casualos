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
import {
    fetchProfile,
    MotionController,
} from '@webxr-input-profiles/motion-controllers';
import type { XRInputSource, XRPose, XRHandedness } from './WebXRTypes';
import type { Object3D } from '@casual-simulation/three';
import { Matrix4, Quaternion, Vector3 } from '@casual-simulation/three';

const uri = '/webxr-profiles';

export async function createMotionController(inputSource: XRInputSource) {
    const promise: Promise<{ profile: any; assetPath: string }> = <any>(
        fetchProfile(inputSource, uri)
    );
    const { profile, assetPath } = await promise.catch((err: any) => {
        console.log('[WebXRHelpers]', err);
        return { profile: null as any, assetPath: null as string };
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
    obj.matrix.decompose(obj.position, <any>obj.rotation, obj.scale);

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
