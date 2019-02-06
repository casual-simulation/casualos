import { Object3D, Mesh, BoxBufferGeometry, MeshStandardMaterial, Color, Vector3, Box3, Sphere, BufferGeometry, BufferAttribute, LineBasicMaterial, LineSegments, SphereGeometry, MeshBasicMaterial, DoubleSide } from "three";
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
 * Defines a class that represents a mesh for an "user" file.
 */
export class UserMesh extends GameObject {

    private _gameView: GameView;
    private _context: FileCalculationContext;

    /**
     * The data for the mesh.
     */
    file: Object;

    /**
     * The cube that acts as the visual representation of the file.
     */
    cube: Mesh;

    /**
     * The container for the cube.
     */
    cubeContainer: Object3D;

    /**
     * The optional arrows for the file.
     */
    arrows: Arrow3D[];

    /**
     * Event that is fired when this file mesh is updated.
     */
    public onUpdated: ArgEvent<UserMesh> = new ArgEvent<UserMesh>();

    constructor(gameView: GameView) {
        super();
        this._gameView = gameView;
    }

    get boundingBox(): Box3 {
        return new Box3().setFromObject(this.cube);
    }

    get boundingSphere(): Sphere {
        let box = new Box3().setFromObject(this.cube);
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
            this.cubeContainer = new Object3D();
            this.cube = this._createCube(1);
            this.cubeContainer.add(this.cube);
            this.add(this.cubeContainer);
        }
        this.file = (<Object>file) || this.file;

        this._context = appManager.fileManager.createContext();

        // visible if not destroyed, has a position
        this.visible = (!this.file.tags._destroyed && !!this.file.tags._position);

        // Tag: _position && scale
        this._tagUpdatePosition();

        this.onUpdated.invoke(this);
    }

    public frameUpdate() {
        super.frameUpdate();

        if(this.file.id === appManager.fileManager.userFile.id) {
            const camPosition = this._gameView.camera.position;
            const currentPosition = this.file.tags._position;
            // TODO: Check distance
            const distance = camPosition.distanceTo(new Vector3(currentPosition.x, currentPosition.y, currentPosition.z));
            if (distance > 1) {
                appManager.fileManager.updateFile(this.file, {
                    tags: {
                        _position: {
                            x: camPosition.x,
                            y: camPosition.y,
                            z: camPosition.z,
                        }
                    }
                });
            }
        }
    }

    private _createCube(size: number): Mesh {
        let geometry = new BoxBufferGeometry(size, size, size);
        let material = new MeshStandardMaterial({
            color: 0x00ff00,
            metalness: .1,
            roughness: 0.6
        });
        const cube = new Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = false;
        return cube;
    }

    private _tagUpdatePosition(): void {

        if (this.file.tags._position) {
            this.position.set(
                this.file.tags._position.x,
                this.file.tags._position.y,
                this.file.tags._position.z);
        } else {
            // Default position
            this.position.set(0, 1, 0);
        }

        // We must call this function so that child objects get their positions updated too.
        // Three render function does this automatically but there are functions in here that depend
        // on accurate positioning of child objects.
        this.updateMatrixWorld(false);
    }

}
