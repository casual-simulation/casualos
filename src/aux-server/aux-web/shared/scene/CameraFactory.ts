import { PerspectiveCamera, OrthographicCamera, Scene, Vector3 } from "three";
import { LayersHelper } from "./LayersHelper";

export const Orthographic_FrustrumSize: number = 100;
export const Orthographic_DefaultZoom: number = 8;
export const Orthographic_NearClip: number = 0.1;
export const Orthographic_FarClip: number = 20000;

export const Perspective_FOV: number = 60;
export const Perspective_NearClip: number = 0.1;
export const Perspective_FarClip: number = 20000;
export const Perspective_DefaultPosition = { x: 5, y: 5, z: 5 };

export declare type CameraType = 'perspective' | 'orthographic';

export interface CameraRig {
    mainCamera: PerspectiveCamera | OrthographicCamera;
    uiWorldCamera: PerspectiveCamera | OrthographicCamera;
}

export function createCameraRig(type: CameraType, scene: Scene, windowWidth: number, windowHeight: number): CameraRig {
    let rig: CameraRig = {
        mainCamera: null,
        uiWorldCamera: null
    }

    // Setup main camera
    if (type === 'orthographic') {
        rig.mainCamera = new OrthographicCamera(-1, 1, 1, -1, Orthographic_NearClip, Orthographic_FarClip);
        rig.mainCamera.position.set(Orthographic_FrustrumSize, Orthographic_FrustrumSize, Orthographic_FrustrumSize);
        rig.mainCamera.zoom = Orthographic_DefaultZoom;
    } else {
        rig.mainCamera = new PerspectiveCamera(Perspective_FOV, window.innerWidth / window.innerHeight, Perspective_NearClip, Perspective_FarClip);
        rig.mainCamera.position.set(Perspective_DefaultPosition.x, Perspective_DefaultPosition.y, Perspective_DefaultPosition.z);
    }

    rig.mainCamera.lookAt(new Vector3(0,0,0));
    rig.mainCamera.layers.enable(LayersHelper.Layer_Default);
    scene.add(rig.mainCamera);

    // Setup UI World camera.
    // This camera is parented to the main camera.
    if (rig.mainCamera instanceof OrthographicCamera) {
        rig.uiWorldCamera = new OrthographicCamera(rig.mainCamera.left, rig.mainCamera.right, rig.mainCamera.top, rig.mainCamera.bottom, rig.mainCamera.near, rig.mainCamera.far);
    } else {
        rig.uiWorldCamera = new PerspectiveCamera(rig.mainCamera.fov, rig.mainCamera.aspect, rig.mainCamera.near, rig.mainCamera.far);
    }
    rig.mainCamera.add(rig.uiWorldCamera);
    rig.uiWorldCamera.position.set(0, 0, 0);
    rig.uiWorldCamera.rotation.set(0, 0, 0);

    // Ui World camera only draws objects on the 'UI World Layer'.
    rig.uiWorldCamera.layers.set(LayersHelper.Layer_UIWorld);

    rig.mainCamera.updateMatrixWorld(true);
    
    resizeCameraRig(rig, windowWidth, windowHeight);

    return rig;
}

export function resizeCameraRig(rig: CameraRig, windowWidth: number, windowHeight: number): void {
    let aspect = windowWidth / windowHeight;

    if (rig.mainCamera instanceof OrthographicCamera) {
        rig.mainCamera.left = -Orthographic_FrustrumSize * aspect / 2;
        rig.mainCamera.right = Orthographic_FrustrumSize * aspect / 2;
        rig.mainCamera.top = Orthographic_FrustrumSize / 2;
        rig.mainCamera.bottom = -Orthographic_FrustrumSize / 2;
    } else {
        rig.mainCamera.aspect = aspect;
    }
    rig.mainCamera.updateProjectionMatrix();

    if (rig.uiWorldCamera instanceof OrthographicCamera) {
        let mainOrtho = <OrthographicCamera>rig.mainCamera;
        rig.uiWorldCamera.left = mainOrtho.left;
        rig.uiWorldCamera.right = mainOrtho.right;
        rig.uiWorldCamera.top = mainOrtho.top;
        rig.uiWorldCamera.bottom = mainOrtho.bottom;
    } else {
        rig.uiWorldCamera.aspect = aspect;
    }
    rig.uiWorldCamera.updateProjectionMatrix();
}