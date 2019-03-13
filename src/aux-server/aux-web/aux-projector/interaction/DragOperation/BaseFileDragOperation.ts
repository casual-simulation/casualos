import { Input } from '../../../shared/scene/Input';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3, AxesHelper, Group, Object3D } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import { 
    File, 
    Workspace, 
    Object, 
    DEFAULT_WORKSPACE_SCALE, 
    fileRemoved, 
    fileUpdated, 
    PartialFile, 
    FileEvent,
    updateFile,
    AuxFile,
    FileCalculationContext
} from '@yeti-cgi/aux-common';

import { setParent } from '../../../shared/scene/SceneUtils';
import { ContextGroup3D } from 'aux-web/shared/scene/ContextGroup3D';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { AuxFile3DDecoratorFactory } from '../../../shared/scene/decorators/AuxFile3DDecoratorFactory';

/**
 * Shared class for both FileDragOperation and NewFileDragOperation.
 */
export abstract class BaseFileDragOperation implements IOperation {

    protected _gameView: GameView;
    protected _interaction: InteractionManager;
    protected _gridWorkspace: WorkspaceMesh;
    protected _files: File[];
    protected _file: File;
    protected _finished: boolean;
    protected _lastScreenPos: Vector2;
    protected _combine: boolean;
    protected _other: File;
    protected _context: string;
    private _previousContext: string;

    private _freeDragGroup: Group;
    private _freeDragMeshes: AuxFile3D[];
    private _freeDragDistance: number;
    private _freeDragPrevParent: Object3D;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, files: File[], context: string) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._setFiles(files);
        this._lastScreenPos = this._gameView.input.getMouseScreenPos();
        this._context = context;
        this._previousContext = null;
    }

    public update(calc: FileCalculationContext): void {
        if (this._finished) return;

        if (this._gameView.input.getMouseButtonHeld(0)) {
            const curScreenPos = this._gameView.input.getMouseScreenPos();

            if (!curScreenPos.equals(this._lastScreenPos)) {

                this._drag(calc);

                this._lastScreenPos = curScreenPos;
            }

        } else {

            this._onDragReleased();

            // This drag operation is finished.
            this._finished = true;

        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {
        this._disposeCore();
        this._gameView.setGridsVisible(false);
        this._files = null;
        this._file = null;
    }

    protected _onDragReleased(): void {
        // Button has been released.
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
            
            // Destroy files if free dragging them (trash can)!
            this._destroyFiles(this._files);
        }
    }

    protected _disposeCore() {
        if (this._combine) {
            this._combineFiles('+');
        }
    }

    protected _setFiles(files: File[]) {
        this._files = files;
        if (this._files.length == 1) {
            this._file = this._files[0];
        }
    }

    protected _drag(calc: FileCalculationContext) {
        this._dragFiles(calc);
    }

    protected _dragFiles(calc: FileCalculationContext) {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const { good, gridPosition, height, workspace } = this._interaction.pointOnGrid(calc, mouseDir);

        if (this._files.length > 0) {
            if (good) {
                this._dragFilesOnWorkspace(calc, workspace, gridPosition, height);
            } else {
                this._dragFilesFree(calc);
            }
        }
    }

    protected _dragFilesOnWorkspace(calc: FileCalculationContext, workspace: BuilderGroup3D, gridPosition: Vector2, height: number): void {
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
        }

        this._showGrid(workspace);

        this._previousContext= null;
        if (!workspace.contexts.get(this._context)) {
            const next = this._interaction.firstContextInWorkspace(workspace);
            this._previousContext = this._context;
            this._context = next;
        }

        // calculate index for file
        const result = this._calcWorkspaceDragPosition(calc, gridPosition);

        this._combine = result.combine;
        this._other = result.other;
        this._updateFilesPositions(this._files, gridPosition, height, result.index);
    }

    protected _dragFilesFree(calc: FileCalculationContext): void {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const firstFileExists = true;
        
        if (firstFileExists) {
            // Move the file freely in space at the distance the file is currently from the camera.
            if (!this._freeDragGroup) {
                this._freeDragMeshes = this._files.map(f => this._createDragMesh(calc, f));
                this._freeDragGroup = this._createFreeDragGroup(this._freeDragMeshes);

                this._updateFileContexts(this._files, false);

                // Calculate the distance to perform free drag at.
                const fileWorldPos = this._freeDragMeshes[0].getWorldPosition(new Vector3());
                const cameraWorldPos = this._gameView.mainCamera.getWorldPosition(new Vector3());
                this._freeDragDistance = cameraWorldPos.distanceTo(fileWorldPos);
            }

            this._freeDragMeshes.forEach(m => {
                m.fileUpdated(m.file, [], calc);
                // m.frameUpdate(calc);
            });

            let worldPos = Physics.pointOnRay(mouseDir, this._freeDragDistance);
            this._freeDragGroup.position.copy(worldPos);
            this._freeDragGroup.updateMatrixWorld(true);
        }
    }

    protected _combineFiles(eventName: string) {
        this._gameView.fileManager.action(this._file, this._other, eventName);
    }

    protected _destroyFiles(files: File[]) {
        let events: FileEvent[] = [];
        // Mark the files as destroyed.
        for (let i = 0; i < files.length; i++) {
            events.push(this._updateFile(files[i], {
                tags: {
                    _destroyed: true
                }
            }));
        }

        this._gameView.fileManager.transaction(...events);
    }

    protected _updateFilesPositions(files: File[], gridPosition: Vector2, height: number, index: number) {

        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: true,
                    [`${this._context}.x`]: gridPosition.x,
                    [`${this._context}.y`]: gridPosition.y,
                    [`${this._context}.z`]: height,
                    [`${this._context}.index`]: index + i
                }
            };
            if (this._previousContext) {
                tags.tags[this._previousContext] = null;
            }
             events.push(this._updateFile(files[i], tags));
        }

        this._gameView.fileManager.transaction(...events);
    }

    protected _updateFileContexts(files: File[], inContext: boolean) {
        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: inContext,
                }
            };
             events.push(this._updateFile(files[i], tags));
        }

        this._gameView.fileManager.transaction(...events);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        updateFile(file, this._gameView.fileManager.userFile.id, data, () => this._gameView.fileManager.createContext());
        return fileUpdated(file.id, data);
    }

    protected _calcWorkspaceDragPosition(calc: FileCalculationContext, gridPosition: Vector2) {
        return this._interaction.calculateFileDragPosition(calc, this._context, gridPosition, ...this._files);
    }

    protected _showGrid(workspace: BuilderGroup3D): void {
        if (this._gridWorkspace) {
            this._gridWorkspace.gridsVisible = false;
        }
        this._gridWorkspace = <WorkspaceMesh>workspace.surface;
        this._gridWorkspace.gridsVisible = true;
    }

    /**
     * Create a Group (Three Object3D) that the files can reside in during free dragging.
     * @param files The file to include in the group.
     */
    private _createFreeDragGroup(fileMeshes: AuxFile3D[]): Group {
        let firstFileMesh = fileMeshes[0];
        this._freeDragPrevParent = firstFileMesh.parent;
        
        // Set the group to the position of the first file. Doing this allows us to more easily
        // inherit the height offsets of any other files in the stack.
        let group = new Group();
        group.position.copy(firstFileMesh.getWorldPosition(new Vector3()));
        group.updateMatrixWorld(true);

        // Parent all the files to the group.
        for (let i = 0; i < fileMeshes.length; i++) {
            setParent(fileMeshes[i], group, this._gameView.scene);
        }

        // Add the group the scene.
        this._gameView.scene.add(group);

        return group;
    }

    /**
     * Put the the files pack in the workspace and remove the group.
     */
    private _releaseFreeDragGroup(group: Group): void {
        this._freeDragMeshes.forEach(m => {
            m.dispose();
        });
        // Remove the group object from the scene.
        this._gameView.scene.remove(group);
    }

    /**
     * Creates a mesh that visually represents the given file.
     * @param calc The file calculation context.
     * @param file The file.
     */
    protected _createDragMesh(calc: FileCalculationContext, file: File): AuxFile3D {
        // Instance a file mesh to represent the file in its intial drag state before being added to the world.
        let mesh = new AuxFile3D(file, null, null, null, [], new AuxFile3DDecoratorFactory(this._gameView));
        
        mesh.fileUpdated(file, [], calc);

        if (!mesh.parent) {
            this._gameView.scene.add(mesh);
        } else {
            // KLUDGE: FileMesh will reparent the object to a workspace if the the file has a workspace assigned.
            // Setting the parent here will force the FileMesh to be in world space again.
            setParent(mesh, this._gameView.scene, this._gameView.scene);
        }

        return mesh;
    }
}
