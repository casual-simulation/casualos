import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenu';
import { File3D } from '../game-engine/File3D';
import { File, Object, DEFAULT_WORKSPACE_SCALE, Workspace, DEFAULT_WORKSPACE_HEIGHT_INCREMENT, DEFAULT_WORKSPACE_MIN_HEIGHT, DEFAULT_USER_MODE, UserMode, FileEvent } from '../../common/Files';
import { FileClickOperation } from './FileClickOperation';
import GameView from '../GameView/GameView';
import { Physics } from '../game-engine/Physics';
import { find, flatMap, minBy, keys, maxBy, union } from 'lodash';
import { CameraControls } from './CameraControls';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { FileMesh } from '../game-engine/FileMesh';
import { Axial, realPosToGridPos, gridDistance, keyToPos, posToKey } from '../game-engine/hex';
import { MouseButtonId } from '../game-engine/input';
import { isBuffer } from 'util';
import { objectsAtGridPosition, tagsMatchingFilter } from 'common/Files/FileCalculations';

export class InteractionManager {

    private _gameView: GameView;
    private _raycaster: Raycaster;
    private _draggableColliders: Object3D[];
    private _surfaceColliders: Object3D[];
    private _draggableObjectsDirty: boolean;
    private _surfaceObjectsDirty: boolean;

    private _cameraControls: CameraControls;
    private _fileClickOperation: FileClickOperation;

    mode: UserMode = DEFAULT_USER_MODE;

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

                    // Can only click things if in the correct mode
                    if (this.isInCorrectMode(file.file)) {

                        // Start file click operation on file.
                        this._fileClickOperation = new FileClickOperation(this.mode, this._gameView, this, file, clickedObject);
                    }
                }

            }

            // If file click operation wasnt started, make sure camera controls are enabled.
            if (!this._fileClickOperation) {

                this._cameraControls.enabled = true;

            }
        }

        // Middle click or Right click.
        if (input.getMouseButtonDown(MouseButtonId.Middle) || input.getMouseButtonDown(MouseButtonId.Right)) {

            // Always allow camera control with middle clicks.
            this._cameraControls.enabled = true;

        }

    }

    public showContextMenu() {
        const input = this._gameView.input;
        const pagePos = input.getMousePagePos();
        const screenPos = input.getMouseScreenPos();
        const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this._getDraggableObjects(), this._gameView.camera);
        const hit = Physics.firstRaycastHit(raycastResult);

        this._cameraControls.enabled = false;
        const file = this.fileForIntersection(hit);
        if (file && file.file && file.file.type === 'workspace') {
            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = { pagePos: pagePos, actions: this._contextMenuActions(file, hit.point) };
            this._gameView.$emit('onContextMenu', menuEvent);
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
        
        return this.findObjectForMesh(obj.object);
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

    public findObjectForMesh(mesh: Object3D): File3D | null {
        if (!mesh) {
            return null;
        }

        const fileId = this._gameView.getFileId(mesh.id);
        const file = fileId ? this._gameView.getFile(fileId) : null;
        if (file && file.file.type === 'object') {
            return file;
        } else {
            return this.findObjectForMesh(mesh.parent);
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
    
    /**
     * Raises the tile at the given point by the given amount.
     * @param file The file.
     * @param position The tile position.
     * @param height The new height.
     */
    public updateTileHeightAtGridPosition(file: File3D, position: Axial, height: number) {
        const key = posToKey(position);
        this._gameView.fileManager.updateFile(file.file, {
            grid: {
                [key]: {
                    height: height
                }
            }
        });
    }

    public shrinkWorkspace(file: File3D) {
        if (file && file.file.type === 'workspace') {
            const size = file.file.size;
            this._gameView.fileManager.updateFile(file.file, {
                size: (size || 0) - 1
            });
        }
    }

    /**
     * Calculates the grid location and workspace that the given ray intersects with.
     * @param ray The ray to test.
     */
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
                        gridPosition: closest.tile.gridPosition,
                        height: closest.tile.localPosition.y,
                        workspace
                    };
                }
            }
        }
        return {
            good: false
        };
    }

    /**
     * Finds the closest workspace to the given point.
     * Returns undefined if there is no workspace.
     * @param point The point.
     * @param exclude The optional workspace to exclude from the search.
     */
    public closestWorkspace(point: Vector3, exclude?: File3D) {
        const workspaceMeshes = this._gameView.getWorkspaces().filter(mesh => mesh !== exclude);
        const center = new Axial();

        const gridPositions = workspaceMeshes.map(mesh => {
            const w = <Workspace>mesh.file;
            const gridPos = this._worldPosToGridPos(mesh, point);
            const tilePositions = w.grid ? keys(w.grid).map(keyToPos) : [];
            const distToCenter = gridDistance(center, gridPos);
            const scaledDistance = distToCenter - (w.size - 1);
            const distances = [
                { position: center, distance: scaledDistance },
                ...tilePositions.map(pos => ({
                    position: pos,
                    distance: gridDistance(pos, gridPos) 
                }))
            ];

            // never null because distances always has at least one element.
            const closest = minBy(distances, d => d.distance);

            return {
                mesh, 
                gridPosition: gridPos, 
                distance: closest.distance
            };
        });

        const closest = minBy(gridPositions, g => g.distance);
        return closest;
    }

    public selectFile(file: File3D) {
        this._gameView.fileManager.selectFile(<Object>file.file);
    }

    /**
     * Calculates whether the given file should be stacked onto another file or if
     * it should be combined with another file.
     * @param workspace The workspace.
     * @param gridPosition The grid position that the file is being dragged to.
     * @param file The file that is being dragged.
     */
    public calculateFileDragPosition(workspace: File3D, gridPosition: Vector2, file: Object) {
        const objs = this.objectsAtGridPosition(workspace, gridPosition);

        if (objs.length === 1) {
            // check if the files can be combined
            const canCombine = this.canCombineFiles(file, objs[0]);

            if (canCombine) {
                return {
                    combine: true,
                    other: objs[0]
                };
            }
        }

        return {
            combine: false,
            index: this._nextAvailableObjectIndex(workspace, gridPosition, file, objs)
        };
    }

    /**
     * Calculates the next available index that an object can be placed at on the given workspace at the
     * given grid position.
     * @param workspace The workspace.
     * @param gridPosition The grid position that the next available index should be found for.
     * @param file The file that we're trying to find the next index for.
     */
    private _nextAvailableObjectIndex(workspace: File3D, gridPosition: Vector2, file: Object, objs: Object[]): number {
        const indexes = objs.map(o => ({
            object: o,
            index: o.tags._index || 0
        }));

        // TODO: Improve to handle other scenarios like:
        // - Reordering objects
        // - Filling in gaps that can be made by moving files from the center of the list
        const maxIndex = maxBy(indexes, i => i.index);
        let nextIndex = 0;
        if (maxIndex) {
            if (maxIndex.object.id === file.id) {
                nextIndex = maxIndex.index;
            } else {
                nextIndex = maxIndex.index + 1;
            }
        }

        return nextIndex;
    }

    /**
     * Finds the files on the given workspace and at the given grid position.
     * @param workspace The workspace.
     * @param gridPosition The grid position that the files should be retrieved for.
     */
    public objectsAtGridPosition(workspace: File3D, gridPosition: Vector2) {
        return objectsAtGridPosition(this._gameView.getObjects().map(o => <Object>o.file), workspace.file.id, {
            x: gridPosition.x,
            y: gridPosition.y,
            z: 0
        });
    }

    /**
     * Determines if the two files can be combined and includes the resolved events if so.
     * @param file The first file.
     * @param other The second file.
     */
    public canCombineFiles(file: Object, other: Object): boolean {
        if (file && other && file.type === 'object' && other.type === 'object' && file !== other) {
            const tags = union(tagsMatchingFilter(file, other, '+'), tagsMatchingFilter(other, file, '+'));
            return tags.length > 0;
        }
        return false;
    }

    public isFile(hit: Intersection): boolean {
        return this.findWorkspaceForIntersection(hit) === null;
    }

    /**
     * Determines if we're in the correct mode to manipulate the given file.
     * @param file The file.
     */
    public isInCorrectMode(file: File) {
        return (file.type === 'workspace' && this.mode === 'worksurfaces') || (file.type === 'object' && this.mode === 'files');
    }

    private _contextMenuActions(file: File3D, point: Vector3): ContextMenuAction[] {
        let actions: ContextMenuAction[] = [];
        if (file.mesh instanceof WorkspaceMesh && file.file.type === 'workspace') {
            const tile = this._worldPosToGridPos(file, point);
            const currentTile = file.file.grid ? file.file.grid[posToKey(tile)] : null;
            const currentHeight = (!!currentTile ? currentTile.height : file.file.defaultHeight);
            const increment = DEFAULT_WORKSPACE_HEIGHT_INCREMENT; // TODO: Replace with a configurable value.
            const minHeight = DEFAULT_WORKSPACE_MIN_HEIGHT; // TODO: This too
            actions.push({ label: 'Raise', onClick: () => this.updateTileHeightAtGridPosition(file, tile, currentHeight + increment) });
            if (currentTile && currentHeight - increment >= minHeight) {
                actions.push({ label: 'Lower', onClick: () => this.updateTileHeightAtGridPosition(file, tile, currentHeight - increment) });
            }
        }
        actions.push({ label: 'Expand', onClick: () => this.expandWorkspace(file) });
        if (this.canShrinkWorkspace(file)) {
            actions.push({ label: 'Shrink', onClick: () => this.shrinkWorkspace(file) });
        }
        return actions;
    }

    private _worldPosToGridPos(file: File3D, pos: Vector3) {
        const w = <Workspace>file.file;
        const scale = w.scale || DEFAULT_WORKSPACE_SCALE;
        const localPos = new Vector3().copy(pos).sub(file.mesh.position);
        return realPosToGridPos(new Vector2(localPos.x, localPos.z), scale);
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
            this._draggableColliders = flatMap(this._gameView.getFiles(), f => f.mesh.colliders);
            this._draggableObjectsDirty = false;
        }
        return this._draggableColliders;
    }

    private _getSurfaceObjects() {
        if (this._surfaceObjectsDirty) {
            this._surfaceColliders = flatMap(this._gameView.getFiles().filter(f => f.file.type === 'workspace'), f => f.mesh.colliders);
            this._surfaceObjectsDirty = false;
        }
        return this._surfaceColliders;
    }
}