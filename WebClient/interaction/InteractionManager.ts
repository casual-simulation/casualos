import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { Input, InputType, MouseButtonId } from '../game-engine/input';
import { File3D, ContextMenuEvent, ContextMenuAction, DragOperation } from '../game-engine/Interfaces';
import { Object } from '../../common/Files';
import { FileClickOperation } from './FileClickOperation';
import GameView from '../GameView/GameView';
import { Physics } from '../game-engine/Physics';
import { find, flatMap } from 'lodash';
import { CameraControls } from './CameraControls';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { FileMesh } from '../game-engine/FileMesh';

export class InteractionManager {

    private _gameView: GameView;
    private _raycaster: Raycaster;
    private _draggableColliders: Object3D[];
    private _surfaceColliders: Object3D[];
    private _draggableObjectsDirty: boolean;
    private _surfaceObjectsDirty: boolean;

    private _cameraControls: CameraControls;
    private _fileClickOperation: FileClickOperation;

    constructor(gameView: GameView) {
        this._draggableObjectsDirty = true;
        this._surfaceObjectsDirty = true;
        this._gameView = gameView;
        this._raycaster = new Raycaster();
        // this._raycaster.linePrecision = .001;
        this._cameraControls = new CameraControls(this._gameView.camera, this._gameView);

        // Bind event handlers to this instance of the class.
        this._handleFileAdded = this._handleFileAdded.bind(this);
        this._handleFileUpdated = this._handleFileUpdated.bind(this);
        this._handleFileRemoved = this._handleFileRemoved.bind(this);

        // Listen to file events from game view.
        this._gameView.onFileAdded.addListener(this._handleFileAdded);
        this._gameView.onFileUpdated.addListener(this._handleFileUpdated);
        this._gameView.onFileRemoved.addListener(this._handleFileRemoved);
    }

    public update(): void {
        this._cameraControls.update();

        if (this._fileClickOperation) {

            this._fileClickOperation.update();

            // Dispose of operations that have finished.
            if (this._fileClickOperation.isFinished()) {

                console.log("Dispose of file click operation.");
                this._fileClickOperation.dispose();
                this._fileClickOperation = null;

            }
        }

        const input = this._gameView.input;

        // Detect left click.
        if (input.getMouseButtonDown(MouseButtonId.Left)) {

            const screenPos = input.getMouseScreenPos();
            const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this._getDraggableObjects(), this._gameView.camera);
            const clickedObject = Physics.firstRaycastHit(raycastResult);

            if (clickedObject) {

                this._cameraControls.enabled = false;
                const file = this.fileForIntersection(clickedObject);

                if (file) {

                    // Start file click operation on file.
                    console.log("Create file click operation.");
                    this._fileClickOperation = new FileClickOperation(this._gameView, this, file, clickedObject);

                }

            }

            // If file click operation wasnt started, make sure camera controls are enabled.
            if (!this._fileClickOperation) {

                this._cameraControls.enabled = true;

            }
        }

        // Middle click.
        if (input.getMouseButtonDown(MouseButtonId.Middle)) {

            // Always allow camera control with middle clicks.
            this._cameraControls.enabled = true;

        }

        // Show the context menu.
        if (input.getMouseButtonDown(MouseButtonId.Right)) {
            
            const pagePos = input.getMousePagePos();
            const screenPos = input.getMouseScreenPos();
            const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this._getDraggableObjects(), this._gameView.camera);
            const hit = Physics.firstRaycastHit(raycastResult);

            if (hit) {

                this._cameraControls.enabled = false;
                const file = this.fileForIntersection(hit);
                if (file && file.file && file.file.type === 'workspace') {
                    // Now send the actual context menu event.
                    let menuEvent: ContextMenuEvent = { pagePos: pagePos, actions: this._contextMenuActions(file) };
                    this._gameView.$emit('onContextMenu', menuEvent);
                }

            }
            else {

                this._cameraControls.enabled = true;

            }
        }

    }

    public fileForIntersection(hit: Intersection): File3D {
        const obj = this.findObjectForIntersection(hit);
        if (obj) {
            return obj;
        } else {
            return this.findWorkspaceForIntersection(hit);
        }
    }

    public findObjectForIntersection(obj: Intersection): File3D | null {
        if (!obj) {
            return null;
        }
        const hasParent = !!obj.object.parent;
        const fileId = hasParent ? this._gameView.getFileId(obj.object.parent.id) : null;
        const file = fileId ? this._gameView.getFile(fileId) : null;
        if (file && file.file.type === 'object') {
            return file;
        } else {
            return null;
        }
    }

    public findWorkspaceForIntersection(obj: Intersection): File3D | null {
        if (!obj) {
            return null;
        }
        const hasParent = !!obj.object.parent && !!obj.object.parent.parent;
        const isObject = hasParent && obj.object.parent instanceof FileMesh;
        const fileId = (hasParent && !isObject) ? this._gameView.getFileId(obj.object.parent.parent.id) : null;
        const file = fileId ? this._gameView.getFile(fileId) : null;
        if (file && file.file.type === 'workspace') {
            return file;
        } else {
            return null;
        }
    }

    public canShrinkWorkspace(file: File3D) {
        return file && file.file.type === 'workspace' && file.file.size >= 1;
    }

    public expandWorkspace(file: File3D) {
        if (file && file.file.type === 'workspace') {
            const size = file.file.size;
            this._gameView.fileManager.updateFile(file.file, {
                size: (size || 0) + 1
            });
        }
    }

    public shrinkWorkspace(file: File3D) {
        if (file && file.file.type === 'workspace') {
            const size = file.file.size;
            this._gameView.fileManager.updateFile(file.file, {
                size: (size || 0) - 1
            });
        }
    }

    public pointOnGrid(ray: Ray) {
        const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
        const workspaces = this._getSurfaceObjects();
        const hits = raycaster.intersectObjects(workspaces, true);
        const hit = hits[0];
        if (hit) {
            const point = hit.point;
            const workspace = this.findWorkspaceForIntersection(hit);
            if (workspace) {
                const workspaceMesh = <WorkspaceMesh>workspace.mesh;
                const closest = workspaceMesh.closestTileToPoint(point);

                if (closest) {
                    return {
                        good: true,
                        point: closest.tile.localPosition,
                        workspace
                    };
                }
            }
        }
        return {
            good: false
        };
    }

    public selectFile(file: File3D) {
        this._gameView.fileManager.selectFile(<Object>file.file);
    }

    public tryCombineFiles(drag: DragOperation) {
        const raycast = Physics.raycastAtScreenPos(drag.screenPos, this._raycaster, this._getDraggableObjects(), this._gameView.camera);
        const other = find(raycast.intersects, (val, index, col) => val.object !== drag.hit.object);
        if (other) {
            const file = this.fileForIntersection(drag.hit);
            const otherFile = this.fileForIntersection(other);
            if (file && otherFile && file.file.type === 'object' && otherFile.file.type === 'object') {
                this._gameView.fileManager.action(file.file, otherFile.file, '+');
            }
        }
    }

    public isFile(hit: Intersection): boolean {
        return this.findWorkspaceForIntersection(hit) === null;
    }

    private _contextMenuActions(file: File3D): ContextMenuAction[] {
        let actions = [
            { label: 'Expand', onClick: () => this.expandWorkspace(file) },
        ];
        if (this.canShrinkWorkspace(file)) {
            actions.push({ label: 'Shrink', onClick: () => this.shrinkWorkspace(file) });
        }
        return actions;
    }

    private _handleFileAdded(file: File3D): void {
        this._markDirty();
    }

    private _handleFileUpdated(file: File3D): void {
        this._markDirty();
    }

    private _handleFileRemoved(file: File3D): void {
        this._markDirty();
    }

    private _markDirty() {
        this._draggableObjectsDirty = true;
        this._surfaceObjectsDirty = true;
    }

    private _getDraggableObjects() {
        if (this._draggableObjectsDirty) {
            this._draggableColliders = flatMap(this._gameView.files, f => f.mesh.colliders);
            this._draggableObjectsDirty = false;
        }
        return this._draggableColliders;
    }

    private _getSurfaceObjects() {
        if (this._surfaceObjectsDirty) {
            this._surfaceColliders = flatMap(this._gameView.files.filter(f => f.file.type === 'workspace'), f => f.mesh.colliders);
            this._surfaceObjectsDirty = false;
        }
        return this._surfaceColliders;
    }
}