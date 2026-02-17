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
import type { FocusOnOptions } from '@casual-simulation/aux-common';
import type { Scene } from '@casual-simulation/three';
import {
    PerspectiveCamera,
    OrthographicCamera,
    Vector3,
    Group,
} from '@casual-simulation/three';
import type { TweenCameraPosition } from './SceneUtils';
import type { Viewport } from './Viewport';

export const Orthographic_FrustrumSize: number = 100;
export const Orthographic_DefaultZoom: number = 8;
export const Orthographic_NearClip: number = 0.1;
export const Orthographic_FarClip: number = 20000;
export const Orthographic_MinZoom: number = 0.4;
export const Orthographic_MaxZoom: number = 80;

export const Perspective_FOV: number = 60;
export const Perspective_NearClip: number = 0.1;
export const Perspective_FarClip: number = 20000;
export const Perspective_DefaultPosition = { x: 5, y: 5, z: 5 };
export const Perspective_MinZoom: number = 0;
export const Perspective_MaxZoom: number = Infinity;

export declare type CameraType = 'perspective' | 'orthographic';

export interface CameraRig {
    name: string;
    viewport: Viewport;
    mainCamera: PerspectiveCamera | OrthographicCamera;
    cameraParent: Group;

    /**
     * Cancels any pending focus operations.
     */
    cancelFocus?: () => void;

    /**
     * Focuses on the given 3D position and uses the given options to animate the camera.
     * Returns a promise that resolves when the camera is done animating.
     * Returns null when focusing is supported but the camera rig is not ready to start the operation.
     *
     * Used to override builtin camera focus operations for rigs that do not use the default camera controls.
     */
    focusOnPosition?: (
        position: TweenCameraPosition,
        options: FocusOnOptions
    ) => Promise<void>;
}

export function createCameraRig(
    name: string,
    type: CameraType,
    scene: Scene,
    viewport: Viewport
): CameraRig {
    let rig: CameraRig = {
        name: name,
        viewport: viewport,
        mainCamera: null,
        cameraParent: new Group(),
    };

    // Setup main camera
    if (type === 'orthographic') {
        rig.mainCamera = new OrthographicCamera(
            -1,
            1,
            1,
            -1,
            Orthographic_NearClip,
            Orthographic_FarClip
        );
    } else {
        rig.mainCamera = new PerspectiveCamera(
            Perspective_FOV,
            window.innerWidth / window.innerHeight,
            Perspective_NearClip,
            Perspective_FarClip
        );
    }

    rig.cameraParent.add(rig.mainCamera);

    scene.add(rig.cameraParent);

    resetCameraRigToDefaultPosition(rig);
    resizeCameraRig(rig);

    return rig;
}

export function resetCameraRigToDefaultPosition(rig: CameraRig): void {
    if (rig.mainCamera instanceof OrthographicCamera) {
        rig.mainCamera.position.set(
            Orthographic_FrustrumSize,
            -Orthographic_FrustrumSize,
            Orthographic_FrustrumSize
        );
        rig.mainCamera.zoom = Orthographic_DefaultZoom;
    } else {
        rig.mainCamera.position.set(
            Perspective_DefaultPosition.x,
            -Perspective_DefaultPosition.y,
            Perspective_DefaultPosition.z
        );
    }

    rig.mainCamera.lookAt(new Vector3(0, 0, 0));
    rig.mainCamera.updateMatrixWorld(true);
}

export function resizeCameraRig(rig: CameraRig): void {
    let aspect = rig.viewport.width / rig.viewport.height;

    if (rig.mainCamera instanceof OrthographicCamera) {
        rig.mainCamera.left = (-Orthographic_FrustrumSize * aspect) / 2;
        rig.mainCamera.right = (Orthographic_FrustrumSize * aspect) / 2;
        rig.mainCamera.top = Orthographic_FrustrumSize / 2;
        rig.mainCamera.bottom = -Orthographic_FrustrumSize / 2;
    } else {
        rig.mainCamera.aspect = aspect;
    }
    rig.mainCamera.updateProjectionMatrix();
}
