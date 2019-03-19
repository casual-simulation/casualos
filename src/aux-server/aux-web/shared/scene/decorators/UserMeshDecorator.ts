import {
    Object3D,
    Vector3,
    Camera,
    PerspectiveCamera,
    CameraHelper,
} from "three";
import { Text3D } from "../Text3D";
import { FileCalculationContext, AuxObject } from '@yeti-cgi/aux-common'
import { appManager } from '../../AppManager';
import { setLayer, disposeMaterial } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";


/**
 * The amount of time that a user needs to be inactive for
 * in order to hide their file.
 */
export const DEFAULT_USER_INACTIVE_TIME = 1000 * 60;

/**
 * The amount of time between checking a user's mouse for activity.
 */
export const DEFAULT_USER_ACTIVE_CHECK_INTERVAL = 1000 * 10;

/**
 * The distance that the user needs to move before updating their position.
 */
export const DEFAULT_USER_MOVEMENT_INCREMENT = 0.1;

/**
 * The angle that the user needs to rotate before updating their position.
 */
export const DEFAULT_USER_ROTATION_INCREMENT = 1 * (Math.PI / 180);

/**
 * Defines a class that represents a mesh for an "user" file.
 */
export class UserMeshDecorator extends AuxFile3DDecorator {

    private _lastActiveCheckTime: number;

    /**
     * The aux file 3d that this decorator is for.
     */
    file3D: AuxFile3D;

    /**
     * The cube that acts as the visual representation of the file.
     */
    cameraHelper: CameraHelper;

    /**
     * The camera that this mesh is displaying.
     */
    camera: Camera;

    /**
     * The container for the meshes.
     */
    container: Object3D;

    /**
     * The label for the file.
     */
    label: Text3D;

    private _mainCamera: Camera;

    constructor(file3D: AuxFile3D, mainCamera?: Camera) {
        super(file3D);
        this._mainCamera = mainCamera;

        this.container = new Object3D();
        this.camera = new PerspectiveCamera(60, 1, 0.1, 0.5);
        this.cameraHelper = new CameraHelper(this.camera);
        this.cameraHelper.updateMatrixWorld(true);

        // Setup label
        this.label = new Text3D();
        this.label.setText(this.file3D.file.id);
        setLayer(this.label, LayersHelper.Layer_UIWorld);
        this.label.setScale(Text3D.defaultScale * 2);
        this.label.setWorldPosition(new Vector3(0,0,0));
        this.label.setRotation(0, 180, 0);
        this.label.position.add(new Vector3(1.55, 0.25, 0)); // This is hardcoded. To lazy to figure out that math.
        
        this.cameraHelper.add(this.label);
        
        this.container.add(this.cameraHelper);
        this.file3D.display.add(this.camera);
        this.file3D.add(this.container);
    }

    fileUpdated(calc: FileCalculationContext): void {
        this._updateCameraMatrix();
        this.cameraHelper.update();
    }

    frameUpdate(calc: FileCalculationContext) {
        let file = <AuxObject>this.file3D.file;

        const isOwnFile = this.file3D.file.tags._user === appManager.user.username;

        // visible if not destroyed, has a position, and was active in the last minute
        this.container.visible = (!file.tags._destroyed &&
            !isOwnFile &&
            this._isActive());

        if (isOwnFile) {
            const camPosition = this._mainCamera.position;
            const camRotation = this._mainCamera.rotation;
            const camRotationVector = new Vector3(0, 0, 1).applyEuler(camRotation);
            const currentPosition = this.file3D.display.position;
            const currentRotation = this.file3D.display.rotation;

            const currentRotationVector = new Vector3(0, 0, 1).applyEuler(currentRotation);
            const distance = camPosition.distanceTo(new Vector3(currentPosition.x, currentPosition.y, currentPosition.z));
            const angle = camRotationVector.angleTo(currentRotationVector);
            if (distance > DEFAULT_USER_MOVEMENT_INCREMENT || angle > DEFAULT_USER_ROTATION_INCREMENT) {
                appManager.fileManager.updateFile(file, {
                    tags: {
                        [`${this.file3D.context}.x`]: camPosition.x,

                        // Mirror the Y coordinate so it works with ContextPositionDecorator
                        [`${this.file3D.context}.y`]: -camPosition.z,

                        [`${this.file3D.context}.z`]: camPosition.y,
                        [`${this.file3D.context}.rotation.x`]: camRotation.x,
                        [`${this.file3D.context}.rotation.y`]: camRotation.z,
                        [`${this.file3D.context}.rotation.z`]: camRotation.y,
                    }
                });
            }

            this._checkIsActive();
        }
    }

    dispose() {
        this.file3D.remove(this.container);
        this.file3D.display.remove(this.camera);

        this.cameraHelper.geometry.dispose();
        disposeMaterial(this.cameraHelper.material);

        this.camera = null;
        this.cameraHelper = null;
        this.container = null;
    }

    private _checkIsActive() {
        const timeBetweenChecks = Date.now() - this._lastActiveCheckTime;
        if (!this._lastActiveCheckTime || timeBetweenChecks > DEFAULT_USER_ACTIVE_CHECK_INTERVAL) {
            this._lastActiveCheckTime = Date.now();
            appManager.fileManager.updateFile(<AuxObject>this.file3D.file, {
                tags: {
                    _lastActiveTime: Date.now()
                }
            });
        }
    }

    private _isActive(): boolean {
        if (this.file3D.file.tags._lastActiveTime) {
            const milisecondsFromNow = Date.now() - this.file3D.file.tags._lastActiveTime;
            return milisecondsFromNow < DEFAULT_USER_INACTIVE_TIME;
        } else {
            return false;
        }
    }


    private _updateCameraMatrix(): void {
        // We must call this function so that child objects get their positions updated too.
        // Three render function does this automatically but there are functions in here that depend
        // on accurate positioning of child objects.
        this.camera.updateMatrixWorld(false);
    }
}