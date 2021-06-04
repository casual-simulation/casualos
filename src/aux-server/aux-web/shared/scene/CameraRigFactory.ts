import { FocusOnOptions } from '@casual-simulation/aux-common';
import {
    PerspectiveCamera,
    OrthographicCamera,
    Scene,
    Vector3,
    Group,
} from '@casual-simulation/three';
import { Viewport } from './Viewport';

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
     *
     * Used to override builtin camera focus operations for rigs that do not use the default camera controls.
     */
    focusOnPosition?: (
        position: Vector3,
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
            Orthographic_FrustrumSize,
            Orthographic_FrustrumSize
        );
        rig.mainCamera.zoom = Orthographic_DefaultZoom;
    } else {
        rig.mainCamera.position.set(
            Perspective_DefaultPosition.x,
            Perspective_DefaultPosition.y,
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
