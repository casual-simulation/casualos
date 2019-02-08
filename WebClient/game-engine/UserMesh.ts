import { Object3D, Mesh, BoxBufferGeometry, MeshStandardMaterial, Color, Vector3, Box3, Sphere, BufferGeometry, BufferAttribute, LineBasicMaterial, LineSegments, SphereGeometry, MeshBasicMaterial, DoubleSide, Vector2, Camera, PerspectiveCamera, CameraHelper } from "three";
import { Object, File, DEFAULT_WORKSPACE_SCALE, DEFAULT_WORKSPACE_GRID_SCALE } from 'common/Files';
import { GameObject } from "./GameObject";
import GameView from '../GameView/GameView';
import { calculateGridTileLocalCenter } from "./grid/Grid";
import { Text3D } from "./Text3D";
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import { File3D } from "./File3D";
import { ArgEvent } from '../../common/Events';
import { Arrow3D } from "./Arrow3D";
import { find, flatMap, sumBy, sortBy } from "lodash";
import { isArray, parseArray, isFormula, getShortId, fileFromShortId, objectsAtGridPosition, FileCalculationContext, calculateFileValue, calculateNumericalTagValue } from 'common/Files/FileCalculations'
import { appManager } from '../AppManager';
import { FileManager } from "WebClient/FileManager";


/**
 * The amount of time that a user needs to be inactive for
 * in order to hide their file.
 */
export const DEFAULT_USER_INACTIVE_TIME = 1000 * 60;

/**
 * The amount of time between checking a user's mouse for activity.
 */
export const DEFAULT_USER_MOUSE_CHECK_TIME = 1000 * 10;

/**
 * The distance that the user needs to move before updating their position.
 */
export const DEFAULT_USER_MOVEMENT_INCREMENT = 0.1;

/**
 * Defines a class that represents a mesh for an "user" file.
 */
export class UserMesh extends GameObject {

    private _gameView: GameView;
    private _context: FileCalculationContext;
    private _lastMouseCheckTime: number;
    private _lastMousePosition: Vector2;
    

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
            this.container.add(this.cameraHelper);
            this.add(this.camera);
            this.add(this.container);
        }
        this.file = (<Object>file) || this.file;

        this._context = appManager.fileManager.createContext();

        // Tag: _position && scale
        this._tagUpdatePosition();

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
            const camPosition = this._gameView.camera.position;
            const camRotation = this._gameView.camera.rotation;
            const currentPosition = this.file.tags._position;
            // TODO: Check distance
            const distance = camPosition.distanceTo(new Vector3(currentPosition.x, currentPosition.y, currentPosition.z));
            if (distance > DEFAULT_USER_MOVEMENT_INCREMENT) {
                appManager.fileManager.updateUserFile(this.file, {
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

    private _checkIsActive() {
        const timeBetweenChecks = Date.now() - this._lastMouseCheckTime;
        if (!this._lastMouseCheckTime || timeBetweenChecks > DEFAULT_USER_MOUSE_CHECK_TIME) {
            this._lastMouseCheckTime = Date.now();
            if (this._checkMousePosition()) {
                appManager.fileManager.updateUserFile(this.file, {});
            }
        }
    }

    private _checkMousePosition() {
        const mousePos = this._gameView.input.getMouseScreenPos();
        if (this._lastMousePosition) {
            const dist = mousePos.distanceTo(this._lastMousePosition);
            return dist > 0.01;
        }
        this._lastMousePosition = mousePos;
        return false;
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

}
