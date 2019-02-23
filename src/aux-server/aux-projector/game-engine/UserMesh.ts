import { 
    Object3D, 
    Vector3,
    Box3,
    Sphere,
    Camera,
    PerspectiveCamera,
    CameraHelper,
    Euler
} from "three";
import { GameObject } from "./GameObject";
import GameView from '../GameView/GameView';
import { Text3D } from "./Text3D";
import { isFormula, FileCalculationContext, Object, File } from '@yeti-cgi/aux-common'
import { ArgEvent } from '@yeti-cgi/aux-common/Events';
import { appManager } from '../AppManager';
import { createLabel } from "./utils";


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
export const DEFAULT_USER_ROTATION_INCREMENT = 1 * (Math.PI/180);

/**
 * Defines a class that represents a mesh for an "user" file.
 */
export class UserMesh extends GameObject {

    private _gameView: GameView;
    private _context: FileCalculationContext;
    private _lastActiveCheckTime: number;

    /**
     * The data for the mesh.
     */
    file: Object;

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

    /**
     * Event that is fired when this file mesh is updated.
     */
    public onUpdated: ArgEvent<UserMesh> = new ArgEvent<UserMesh>();

    constructor(gameView: GameView) {
        super();
        this._gameView = gameView;
    }

    get boundingBox(): Box3 {
        return new Box3().setFromObject(this.container);
    }

    get boundingSphere(): Sphere {
        let box = new Box3().setFromObject(this.container);
        let sphere = new Sphere();
        sphere = box.getBoundingSphere(sphere);

        return sphere;
    }

    /**
     * Sets whether the debug information for the file should be shown.
     * @param debug Whether to show debug information.
     */
    showDebugInfo(debug: boolean) {
    }

    /**
     * Updates the mesh to correctly visualize the given file.
     * @param file The file. If not provided the mesh will re-update to match its existing data.
     * @param force Whether to force the mesh to update everything, not just the parts that have changed.
     */
    update(file?: File, force?: boolean) {
        if (file && file.type !== 'object') {
            return;
        }
        if (!this.file) {
            this.container = new Object3D();
            this.camera = new PerspectiveCamera(60, 1, 0.1, 0.5);
            this.cameraHelper = new CameraHelper(this.camera);
            this.label = createLabel(this._gameView, this.cameraHelper);
            this.label.setLayer(GameView.Layer_UIWorld);
            this.label.setScale(Text3D.defaultScale * 2);
            this.label.setRotation(0, 180, 0);
            this.container.add(this.cameraHelper);
            this.add(this.camera);
            this.add(this.container);
        }
        this.file = (<Object>file) || this.file;

        this._context = appManager.fileManager.createContext();

        // Tag: _position && scale
        this._tagUpdatePosition();

        this._tagUpdateLabel();

        this.cameraHelper.update();

        this.onUpdated.invoke(this);
    }

    public frameUpdate() {
        super.frameUpdate();

        const isOwnFile = this.file.id === appManager.fileManager.userFile.id;
        // visible if not destroyed, has a position, and was active in the last minute
        this.visible = (!this.file.tags._destroyed && 
            !!this.file.tags._position &&
            !isOwnFile &&
            this._isActive());

        if(isOwnFile) {
            const camPosition = this._gameView.mainCamera.position;
            const camRotation = this._gameView.mainCamera.rotation;
            const camRotationVector = new Vector3(0, 0, 1).applyEuler(camRotation);
            const currentPosition = this.file.tags._position;
            
            const currentRotation = this.file.tags._rotation ? new Euler(
                this.file.tags._rotation.x,
                this.file.tags._rotation.y,
                this.file.tags._rotation.z,
            ) : new Euler();

            const currentRotationVector = new Vector3(0, 0, 1).applyEuler(currentRotation);
            const distance = camPosition.distanceTo(new Vector3(currentPosition.x, currentPosition.y, currentPosition.z));
            const angle = camRotationVector.angleTo(currentRotationVector);
            if (distance > DEFAULT_USER_MOVEMENT_INCREMENT || angle > DEFAULT_USER_ROTATION_INCREMENT) {
                appManager.fileManager.updateFile(this.file, {
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

    public dispose() {
        super.dispose();
    }

    private _checkIsActive() {
        const timeBetweenChecks = Date.now() - this._lastActiveCheckTime;
        if (!this._lastActiveCheckTime || timeBetweenChecks > DEFAULT_USER_ACTIVE_CHECK_INTERVAL) {
            this._lastActiveCheckTime = Date.now();
            appManager.fileManager.updateFile(this.file, {
                tags: {
                    _lastActiveTime: Date.now()
                }
            });
        }
    }

    private _isActive(): boolean {
        if (this.file.tags._lastActiveTime) {
            const milisecondsFromNow = Date.now() - this.file.tags._lastActiveTime;
            return milisecondsFromNow < DEFAULT_USER_INACTIVE_TIME;
        } else {
            return false;
        }
    }


    private _tagUpdatePosition(): void {

        if (this.file.tags._position) {
            this.camera.position.set(
                this.file.tags._position.x,
                this.file.tags._position.y,
                this.file.tags._position.z);
        }

        if (this.file.tags._rotation) {
            this.camera.rotation.set(
                this.file.tags._rotation.x,
                this.file.tags._rotation.y,
                this.file.tags._rotation.z);
        }

        // We must call this function so that child objects get their positions updated too.
        // Three render function does this automatically but there are functions in here that depend
        // on accurate positioning of child objects.
        this.camera.updateMatrixWorld(false);
    }

    private _tagUpdateLabel(): void {

        let label = this.file.tags.label || this.file.id;

        if (label) {

            if (isFormula(label)) {
                let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'label');
                this.label.setText(calculatedValue);
            } else {
                this.label.setText(label);
            }

            this.label.setPositionForObject(this.camera);

            // let labelColor = this.file.tags['label.color'];
            // if (labelColor) {

            //     if (isFormula(labelColor)) {
            //         let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'label.color');
            //         this.label.setColor(this._getColor(calculatedValue));
            //     } else {
            //         this.label.setColor(this._getColor(labelColor));
            //     }
            // }

        } else {
            this.label.setText("");
        }
    }

}
