import {
    Object3D,
    Vector3,
    Camera,
    PerspectiveCamera,
    CameraHelper,
    Euler
} from "three";
import { Text3D } from "../Text3D";
import { isFormula, FileCalculationContext, Object, File, AuxObject, AuxFile } from '@yeti-cgi/aux-common'
import { appManager } from '../../AppManager';
import { createLabel, setLayer } from "../SceneUtils";
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
export class UserMeshDecorator implements AuxFile3DDecorator {

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

    constructor(mainCamera?: Camera) {
        this._mainCamera = mainCamera;
    }

    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
        if (!this.file3D) {
            this.container = new Object3D();
            this.camera = new PerspectiveCamera(60, 1, 0.1, 0.5);
            this.cameraHelper = new CameraHelper(this.camera);
            this.label = createLabel();
            this.cameraHelper.add(this.label);
            setLayer(this.label, LayersHelper.Layer_UIWorld);
            this.label.setScale(Text3D.defaultScale * 2);
            this.label.setRotation(0, 180, 0);
            this.container.add(this.cameraHelper);
            file3D.display.add(this.camera);
            file3D.display.add(this.container);
        }

        this.file3D = file3D;

        this._updateCameraMatrix();
        this._updateLabel();

        this.cameraHelper.update();
    }

    frameUpdate() {
        if (!this.file3D)
            return;

        let file = <AuxObject>this.file3D.file;

        const isOwnFile = !!this._mainCamera;
        // visible if not destroyed, has a position, and was active in the last minute
        this.container.visible = (!file.tags._destroyed &&
            !!file.tags._position &&
            !isOwnFile &&
            this._isActive());

        if (isOwnFile) {
            const camPosition = this._mainCamera.position;
            const camRotation = this._mainCamera.rotation;
            const camRotationVector = new Vector3(0, 0, 1).applyEuler(camRotation);
            const currentPosition = file.tags._position;

            const currentRotation = file.tags._rotation ? new Euler(
                file.tags._rotation.x,
                file.tags._rotation.y,
                file.tags._rotation.z,
            ) : new Euler();

            const currentRotationVector = new Vector3(0, 0, 1).applyEuler(currentRotation);
            const distance = camPosition.distanceTo(new Vector3(currentPosition.x, currentPosition.y, currentPosition.z));
            const angle = camRotationVector.angleTo(currentRotationVector);
            if (distance > DEFAULT_USER_MOVEMENT_INCREMENT || angle > DEFAULT_USER_ROTATION_INCREMENT) {
                appManager.fileManager.updateFile(file, {
                    tags: {
                        _position: {
                            x: camPosition.x,
                            y: camPosition.y,
                            z: camPosition.z,
                        },
                        _rotation: {
                            x: camRotation.x,
                            y: camRotation.y,
                            z: camRotation.z,
                        }
                    }
                });
            }

            this._checkIsActive();
        }
    }

    dispose() {
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
        let file = this.file3D.file;

        if (file.tags._position) {
            this.camera.position.set(
                file.tags._position.x,
                file.tags._position.y,
                file.tags._position.z);
        }

        if (file.tags._rotation) {
            this.camera.rotation.set(
                file.tags._rotation.x,
                file.tags._rotation.y,
                file.tags._rotation.z);
        }

        // We must call this function so that child objects get their positions updated too.
        // Three render function does this automatically but there are functions in here that depend
        // on accurate positioning of child objects.
        this.camera.updateMatrixWorld(false);
    }

    private _updateLabel(): void {
        let label = this.file3D.file.tags.label || this.file3D.file.id;

        if (label) {
            if (isFormula(label)) {
                let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file3D.file, 'label');
                this.label.setText(calculatedValue);
            } else {
                this.label.setText(label);
            }

            this.label.setPositionForObject(this.camera);
        } else {
            this.label.setText("");
        }
    }
}