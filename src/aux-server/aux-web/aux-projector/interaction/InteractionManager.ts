import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { ContextMenuEvent, ContextMenuAction } from './ContextMenuEvent';
import { 
    File, 
    Object, 
    DEFAULT_WORKSPACE_SCALE, 
    Workspace, 
    DEFAULT_WORKSPACE_HEIGHT_INCREMENT, 
    DEFAULT_WORKSPACE_MIN_HEIGHT, 
    DEFAULT_USER_MODE, 
    UserMode, 
    FileEvent, 
    DEFAULT_WORKSPACE_HEIGHT, 
    DEFAULT_SCENE_BACKGROUND_COLOR,
    objectsAtWorkspace,
    tagsMatchingFilter,
    isMinimized,
    AuxObject,
    AuxFile,
    objectsAtContextGridPosition,
    getFileIndex,
    FileCalculationContext,
    getFilePosition,
    getContextMinimized,
    getContextGrid,
    getContextSize,
    getContextScale,
    isFileStackable
} from '@yeti-cgi/aux-common';
import { FileClickOperation } from './ClickOperation/FileClickOperation';
import GameView from '../GameView/GameView';
import { Physics } from '../../shared/scene/Physics';
import { find, flatMap, minBy, keys, maxBy, union, some, sortBy, differenceBy } from 'lodash';
import { CameraControls } from './CameraControls';
import { Axial, realPosToGridPos, gridDistance, keyToPos, posToKey } from '../../shared/scene/hex';
import { MouseButtonId, Input } from '../../shared/scene/Input';
import { isBuffer } from 'util';
import { ColorPickerEvent } from './ColorPickerEvent';
import { EventBus } from '../../shared/EventBus';
import { appManager } from '../../shared/AppManager';
import { IOperation } from './IOperation';
import { EmptyClickOperation } from './ClickOperation/EmptyClickOperation';
import { NewFileClickOperation } from './ClickOperation/NewFileClickOperation';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';

export class InteractionManager {

    private _gameView: GameView;
    private _raycaster: Raycaster;
    private _draggableColliders: Object3D[];
    private _surfaceColliders: Object3D[];
    private _draggableObjectsDirty: boolean;
    private _surfaceObjectsDirty: boolean;

    private _cameraControls: CameraControls;
    private _operations: IOperation[];

    mode: UserMode = DEFAULT_USER_MODE;

    constructor(gameView: GameView) {
        this._draggableObjectsDirty = true;
        this._surfaceObjectsDirty = true;
        this._gameView = gameView;
        this._raycaster = new Raycaster();
        // this._raycaster.linePrecision = .001;
        this._cameraControls = new CameraControls(this._gameView.mainCamera, this._gameView);
        this._operations = [];

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

        const calc = this._gameView.fileManager.createContext();
        // Update active operations and dispose of any that are finished.
        this._operations = this._operations.filter((o) => {
            o.update(calc);

            if (o.isFinished()) {
                o.dispose();
                return false;
            }

            return true;
        });

        if (this._gameView.vrDisplay && this._gameView.vrDisplay.isPresenting) {
            
            const inputVR = this._gameView.inputVR;

            // VR Mode interaction.
            for (let i = 0; i < 5; i++) {
                if (inputVR.getButtonDown(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' down. frame: ' + this._gameView.time.frameCount);
                }

                if (inputVR.getButtonHeld(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' held. frame: ' + this._gameView.time.frameCount);
                }

                if (inputVR.getButtonUp(0, i)) {
                    console.log('[InteractionManager] VR button ' + i + ' up. frame: ' + this._gameView.time.frameCount);
                }
            }

        } else {

            // Normal browser interaction.

            // Enable camera controls when there are no more operations.
            if (this._operations.length === 0) {
                this._cameraControls.enabled = true;
            }
            
            this._cameraControls.update();

            const input = this._gameView.input;

            // Detect left click.
            if (input.getMouseButtonDown(MouseButtonId.Left)) {

                if (input.isMouseButtonDownOn(this._gameView.gameView)){

                    const screenPos = input.getMouseScreenPos();
                    const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this.getDraggableObjects(), this._gameView.mainCamera);
                    const clickedObject = Physics.firstRaycastHit(raycastResult);

                    if (clickedObject) {

                        const file = this.fileForIntersection(clickedObject);

                        if (file) {

                            // Start file click operation on file.
                            let fileClickOperation = new FileClickOperation(this.mode, this._gameView, this, file, clickedObject);
                            this._operations.push(fileClickOperation);

                            if (this.isInCorrectMode(file)) {
                                this._cameraControls.enabled = false;
                            } else {
                                this._cameraControls.enabled = true;
                            }
                        }

                    } else {

                        let emptyClickOperation = new EmptyClickOperation(this._gameView, this);
                        this._operations.push(emptyClickOperation);
                        this._cameraControls.enabled = true;

                    }
                } else if(input.isMouseButtonDownOn(this._gameView.fileQueue)) {

                    const element = input.getTargetData().inputDown;
                    const vueElement: any = Input.getVueParent(element);
                    
                    if (vueElement.file) {
                        const file = <File>vueElement.file;
                        let newFileClickOperation = new NewFileClickOperation(this.mode, this._gameView, this, file);
                        this._operations.push(newFileClickOperation);
                        this._cameraControls.enabled = false;
                    }
                    
                }
            }

            // Middle click or Right click.
            if (input.getMouseButtonDown(MouseButtonId.Middle) || input.getMouseButtonDown(MouseButtonId.Right)) {

                if (input.isMouseButtonDownOn(this._gameView.gameView)) {
                    // Always allow camera control with middle clicks.
                    this._cameraControls.enabled = true;
                }

            }

        }

    }

    public showContextMenu(calc: FileCalculationContext) {
        const input = this._gameView.input;
        const pagePos = input.getMousePagePos();
        const screenPos = input.getMouseScreenPos();
        const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this.getDraggableObjects(), this._gameView.mainCamera);
        const hit = Physics.firstRaycastHit(raycastResult);

        this._cameraControls.enabled = false;
        const file = this.fileForIntersection(hit);
        const actions = this._contextMenuActions(calc, file, hit.point, pagePos);

        if (actions) {
            // Now send the actual context menu event.
            let menuEvent: ContextMenuEvent = { pagePos: pagePos, actions: actions };
            this._gameView.$emit('onContextMenu', menuEvent);
        }
    }

    public fileForIntersection(hit: Intersection): AuxFile3D | BuilderGroup3D {
        const obj = this.findObjectForIntersection(hit);
        if (obj) {
            return obj;
        } else {
            return this.findWorkspaceForIntersection(hit);
        }
    }

    public findObjectForIntersection(obj: Intersection): AuxFile3D | null {
        if (!obj) {
            return null;
        }
        
        return this.findObjectForMesh(obj.object);
    }

    public findWorkspaceForIntersection(obj: Intersection): BuilderGroup3D | null {
        if (!obj) {
            return null;
        }
        
        return this.findWorkspaceForMesh(obj.object);
    }

    public findObjectForMesh(mesh: Object3D): AuxFile3D | null {
        if (!mesh) {
            return null;
        }

        if (mesh instanceof AuxFile3D) {
            return mesh;
        } else {
            return this.findObjectForMesh(mesh.parent);
        }
        // const fileId = this._gameView.getFileId(mesh.id);
        // const file = fileId ? this._gameView.getFile(fileId) : null;
        // if (file) {
        //     return file;
        // } else {
        // }
    }

    public findWorkspaceForMesh(mesh: Object3D): BuilderGroup3D | null {
        if (!mesh) {
            return null;
        }

        if (mesh instanceof BuilderGroup3D) {
            return mesh;
        } else if (mesh instanceof AuxFile3D) {
            return <BuilderGroup3D>mesh.contextGroup;
        } else {
            return this.findWorkspaceForMesh(mesh.parent);
        }
        // const fileId = this._gameView.getFileId(mesh.id);
        // const file = fileId ? this._gameView.getFile(fileId) : null;
        // if (file) {
        //     return file;
        // } else {
        // }
    }
 
    public canShrinkWorkspace(file: ContextGroup3D) {
        if (file && file.file.tags.size >= 1) {
            if (file.file.tags.size === 1) {
                // Can only shrink to zero size if there are no objects on the workspace.
                const allObjects = this._gameView.getContexts().map((o) => { return o.file });
                const workspaceObjects = objectsAtWorkspace(allObjects, file.file.id);
                if (workspaceObjects && workspaceObjects.length > 0) {
                    return false;
                }
            }
            return true;
        }
    }

    private expandWorkspace(calc: FileCalculationContext, file: ContextGroup3D) {
        if (file) {
            const size = getContextSize(calc, file.file, file.domain);
            this._gameView.fileManager.updateFile(file.file, {
                tags: {
                    [`aux.${file.domain}.context.size`]: (size || 0) + 1
                }
            });
        }
    }

    /**
     * Determines if we're in the correct mode to manipulate the given file.
     * @param file The file.
     */
    public isInCorrectMode(file: AuxFile3D | ContextGroup3D) {
        if (!file) {
            return true;
        }
        if (file instanceof ContextGroup3D) {
            return this.mode === 'worksurfaces';
        } else {
            return this.mode === 'files';
        }
    }
    
    /**
     * Raises the tile at the given point by the given amount.
     * @param file The file.
     * @param position The tile position.
     * @param height The new height.
     */
    public updateTileHeightAtGridPosition(file: ContextGroup3D, position: Axial, height: number) {
        const key = posToKey(position);
        this._gameView.fileManager.updateFile(file.file, {
            tags: {
                grid: {
                    [key]: {
                        height: height
                    }
                }
            }
        });
    }

    private shrinkWorkspace(calc: FileCalculationContext, file: ContextGroup3D) {
        if (file && file.file.tags[`aux.${file.domain}.context`]) {
            const size = getContextSize(calc, file.file, file.domain);
            this._gameView.fileManager.updateFile(file.file, {
                tags: {
                    [`aux.${file.domain}.context.size`]: (size || 0) - 1
                }
            });
        }
    }

    /**
     * Minimizes or maximizes the given workspace.
     * @param file 
     */
    private toggleWorkspace(calc: FileCalculationContext, file: ContextGroup3D) {
        if (file && file.file.tags[`aux.${file.domain}.context`]) {
            const minimized = !isMinimized(calc, file.file, file.domain);
            this._gameView.fileManager.updateFile(file.file, {
                tags: {
                    [`aux.${file.domain}.context.minimized`]: minimized
                }
            });
        }
    }

    /**
     * Calculates the grid location and workspace that the given ray intersects with.
     * @param ray The ray to test.
     */
    public pointOnGrid(calc: FileCalculationContext, ray: Ray) {
        const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
        const workspaces = this.getSurfaceObjects();
        const hits = raycaster.intersectObjects(workspaces, true);
        const hit = hits[0];
        if (hit) {
            const point = hit.point;
            const workspace = this.findWorkspaceForIntersection(hit);
            if (workspace && workspace.file.tags[`aux.${workspace.domain}.context`] && !getContextMinimized(calc, workspace.file, workspace.domain)) {
                const workspaceMesh = workspace.surface;
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
     * Finds the closest non-minimized workspace to the given point.
     * Returns undefined if there is no workspace.
     * @param point The point.
     * @param exclude The optional workspace to exclude from the search.
     */
    public closestWorkspace(calc: FileCalculationContext, point: Vector3, exclude?: AuxFile3D | ContextGroup3D) {
        const workspaceMeshes = this._gameView.getContexts().filter(context => context !== exclude && !getContextMinimized(calc, context.file, context.domain));
        const center = new Axial();

        const gridPositions = workspaceMeshes.map(mesh => {
            const w = <Workspace>mesh.file;
            const gridPos = this._worldPosToGridPos(calc, mesh, point);
            const grid = getContextGrid(calc, w, mesh.domain);
            const tilePositions = grid ? keys(grid).map(keyToPos) : [];
            const distToCenter = gridDistance(center, gridPos);
            const size = getContextSize(calc, w, mesh.domain);
            const scaledDistance = distToCenter - (size - 1);
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

    public selectFile(file: AuxFile3D) {
        this._gameView.fileManager.selectFile(<AuxFile>file.file);
    }

    /**
     * Calculates whether the given file should be stacked onto another file or if
     * it should be combined with another file.
     * @param calc The file calculation context.
     * @param context The context.
     * @param gridPosition The grid position that the file is being dragged to.
     * @param file The file that is being dragged.
     */
    public calculateFileDragPosition(calc: FileCalculationContext, context: string, gridPosition: Vector2, ...files: File[]) {
        const objs = differenceBy(objectsAtContextGridPosition(calc, context, gridPosition), files, f => f.id);

        const canCombine = objs.length === 1 && 
            files.length === 1 &&
            this.canCombineFiles(files[0], objs[0]);

        // Can stack if we're dragging more than one file,
        // or (if the single file we're dragging is stackable and 
        // the stack we're dragging onto is stackable)
        const canStack = files.length !== 1 || 
            (isFileStackable(calc, files[0]) &&
             (objs.length === 0 || isFileStackable(calc, objs[0])));

        const index = this._nextAvailableObjectIndex(calc, context, gridPosition, files, objs);

        return {
            combine: canCombine,
            stackable: canStack,
            other: canCombine ? objs[0] : null,
            index: index
        };
    }

    /**
     * Calculates the next available index that an object can be placed at on the given workspace at the
     * given grid position.
     * @param context The context.
     * @param gridPosition The grid position that the next available index should be found for.
     * @param files The files that we're trying to find the next index for.
     * @param objs The objects at the same grid position.
     */
    private _nextAvailableObjectIndex(calc: FileCalculationContext, context: string, gridPosition: Vector2, files: File[], objs: File[]): number {
        const except = differenceBy(objs, files, f => f instanceof AuxFile3D ? f.file.id : f.id);

        const indexes = except.map(o => ({
            object: o,
            // TODO: Replace with context index
            index: getFileIndex(calc, o, context)
        }));

        // TODO: Improve to handle other scenarios like:
        // - Reordering objects
        // - Filling in gaps that can be made by moving files from the center of the list
        const maxIndex = maxBy(indexes, i => i.index);
        let nextIndex = 0;
        if (maxIndex) {
            // if (some(files, f => f.id === maxIndex.object.id)) {
            //     nextIndex = maxIndex.index;
            // } else {
            //     nextIndex = maxIndex.index + 1;
            // }
            nextIndex = maxIndex.index + 1;
        }

        return nextIndex;
    }

    /**
     * Determines if the two files can be combined and includes the resolved events if so.
     * @param file The first file.
     * @param other The second file.
     */
    public canCombineFiles(file: Object, other: Object): boolean {
        // TODO: Make this work even if the file is a "workspace"
        if (file && other && !file.tags['aux.builder.context'] && !other.tags['aux.builder.context'] && file.id !== other.id) {
            const context = this._gameView.fileManager.createContext();
            const tags = union(tagsMatchingFilter(file, other, '+', context), tagsMatchingFilter(other, file, '+', context));
            return tags.length > 0;
        }
        return false;
    }

    /**
     * Gets the first context that the given workspace has.
     */
    public firstContextInWorkspace(workspace: ContextGroup3D): string {
        const contexts = [...workspace.contexts.keys()];
        if (contexts.length > 0) {
            return contexts[0];
        }
        return null;
    }

    public isFile(hit: Intersection): boolean {
        return this.findWorkspaceForIntersection(hit) === null;
    }

    public getDraggableObjects() {
        if (this._draggableObjectsDirty) {
            this._draggableColliders = flatMap(this._gameView.getContexts(), f => f.colliders).filter(c => this._isVisible(c));
            this._draggableObjectsDirty = false;
        }
        return this._draggableColliders;
    }

    public getSurfaceObjects() {
        if (this._surfaceObjectsDirty) {
            this._surfaceColliders = flatMap(this._gameView.getContexts().filter(f => f.file.tags[`aux.${f.domain}.context`]), f => f.surface.colliders);
            this._surfaceObjectsDirty = false;
        }
        return this._surfaceColliders;
    }

    public isEmptySpace(screenPos: Vector2): boolean {
        const raycastResult = Physics.raycastAtScreenPos(screenPos, new Raycaster(), this.getDraggableObjects(), this._gameView.mainCamera);
        const clickedObject = Physics.firstRaycastHit(raycastResult);

        return clickedObject === undefined || clickedObject === null;
    }

    private _isVisible(obj: Object3D) {
        while(obj) {
            if (!obj.visible) {
                return false;
            }
            obj = obj.parent;
        }
        return true;
    }

    private _contextMenuActions(calc: FileCalculationContext, file: AuxFile3D | ContextGroup3D, point: Vector3, pagePos: Vector2): ContextMenuAction[] {
        
        let actions: ContextMenuAction[] = [];

        if (file) {

            if (file instanceof ContextGroup3D && file.file.tags[`aux.${file.domain}.context`]) {
                
                const tile = this._worldPosToGridPos(calc, file, point);
                const currentTile = file.file.tags.grid ? file.file.tags.grid[posToKey(tile)] : null;
                const currentHeight = (!!currentTile ? currentTile.height : (file.file.tags.defaultHeight || DEFAULT_WORKSPACE_HEIGHT)) || DEFAULT_WORKSPACE_HEIGHT;
                const increment = DEFAULT_WORKSPACE_HEIGHT_INCREMENT; // TODO: Replace with a configurable value.
                const minHeight = DEFAULT_WORKSPACE_MIN_HEIGHT; // TODO: This too
                const minimized = isMinimized(calc, file.file, file.domain);
                
                if (this.isInCorrectMode(file)) {
                    if (!minimized) {
                        actions.push({ label: 'Raise', onClick: () => this.updateTileHeightAtGridPosition(file, tile, currentHeight + increment) });
                        if (currentTile && currentHeight - increment >= minHeight) {
                            actions.push({ label: 'Lower', onClick: () => this.updateTileHeightAtGridPosition(file, tile, currentHeight - increment) });
                        }
                        
                        actions.push({ label: 'Expand', onClick: () => this.expandWorkspace(calc, file) });
                        if (this.canShrinkWorkspace(file)) {
                            actions.push({ label: 'Shrink', onClick: () => this.shrinkWorkspace(calc, file) });
                        }
                    }

                    actions.push({ label: 'Change Color', onClick: () => {    
                        
                        // This function is invoked as the color picker changes the color value.
                        let colorUpdated = (hexColor: string) => {
                            appManager.fileManager.updateFile(file.file, { tags: {color: hexColor }});
                        };
                        
                        let workspace = <Workspace>file.file;
                        let colorPickerEvent: ColorPickerEvent = { pagePos: pagePos, initialColor: workspace.tags.color, colorUpdated: colorUpdated };
                        
                        EventBus.$emit('onColorPicker', colorPickerEvent);
                    }});
                }
    
                const minimizedLabel = minimized ? 'Maximize' : 'Minimize';
                actions.push({ label: minimizedLabel, onClick: () => this.toggleWorkspace(calc, file) });
            }

        }
    
        return actions;
    }

    private _worldPosToGridPos(calc: FileCalculationContext, file: ContextGroup3D, pos: Vector3) {
        const w = file.file;
        const scale = getContextScale(calc, file.file, file.domain);
        const localPos = new Vector3().copy(pos).sub(file.position);
        return realPosToGridPos(new Vector2(localPos.x, localPos.z), scale);
    }

    private _handleFileAdded(file: AuxFile): void {
        this._markDirty();
    }

    private _handleFileUpdated(file: AuxFile): void {
        this._markDirty();
    }

    private _handleFileRemoved(file: AuxFile): void {
        this._markDirty();
    }

    private _markDirty() {
        this._draggableObjectsDirty = true;
        this._surfaceObjectsDirty = true;
    }
}
