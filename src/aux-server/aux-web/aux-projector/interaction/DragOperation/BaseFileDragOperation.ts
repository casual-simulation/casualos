import { Input } from '../../../aux-scene/Input';
import { File3D } from '../../../aux-scene/File3D';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3, AxesHelper, Group, Object3D } from 'three';
import { Physics } from '../../../aux-scene/Physics';
import { WorkspaceMesh } from '../../../aux-scene/WorkspaceMesh';
import { 
    File, 
    Workspace, 
    Object, 
    DEFAULT_WORKSPACE_SCALE, 
    fileRemoved, 
    fileUpdated, 
    PartialFile, 
    FileEvent,
    updateFile
} from '@yeti-cgi/aux-common';

import { setParent } from '../../../aux-scene/utils';
import { FileMesh } from '../../../aux-scene/FileMesh';

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
    protected _other: Object;

    private _freeDragGroup: Group;
    private _freeDragDistance: number;
    private _freeDragPrevParent: Object3D;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, files: File[]) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._setFiles(files);
        this._lastScreenPos = this._gameView.input.getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (this._gameView.input.getMouseButtonHeld(0)) {
            const curScreenPos = this._gameView.input.getMouseScreenPos();

            if (!curScreenPos.equals(this._lastScreenPos)) {

                if (this._file && this._file.type === 'workspace') {
                    this._dragWorkspace();
                } else {
                    this._dragFiles();
                }

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
        if (this._freeDragGroup && this._files[0].type === 'object') {
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

    protected _dragFiles() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const { good, gridPosition, height, workspace } = this._interaction.pointOnGrid(mouseDir);

        if (this._files.length > 0) {
            if (good) {
                this._dragFilesOnWorkspace(workspace, gridPosition, height);
            } else {
                this._dragFilesFree();
            }
        }
    }

    protected _dragFilesOnWorkspace(workspace: File3D, gridPosition: Vector2, height: number): void {
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
        }

        this._showGrid(workspace);

        // calculate index for file
        const result = this._calcWorkspaceDragPosition(workspace, gridPosition);

        this._combine = result.combine;
        this._other = result.other;
        this._updateFilesPositions(this._files, workspace, gridPosition, height, result.index);
    }

    protected _dragFilesFree(): void {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const firstFileExists = this._gameView.getFile(this._files[0].id) !== undefined;
        
        if (firstFileExists) {
            // Move the file freely in space at the distance the file is currently from the camera.
            if (!this._freeDragGroup) {
                const fileMeshes = this._files.map((f) => { return <FileMesh>this._gameView.getFile(f.id).mesh; });
                this._freeDragGroup = this._createFreeDragGroup(fileMeshes);

                // Calculate the distance to perform free drag at.
                const fileWorldPos = fileMeshes[0].getWorldPosition(new Vector3());
                const cameraWorldPos = this._gameView.mainCamera.getWorldPosition(new Vector3());
                this._freeDragDistance = cameraWorldPos.distanceTo(fileWorldPos);
            }

            let worldPos = Physics.pointOnRay(mouseDir, this._freeDragDistance);
            this._freeDragGroup.position.copy(worldPos);
            this._freeDragGroup.updateMatrixWorld(true);
        }
    }

    protected _dragWorkspace(): void {}

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

    protected _updateFilesPositions(files: File[], workspace: File3D, gridPosition: Vector2, height: number, index: number) {
        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
             events.push(this._updateFile(files[i], {
                tags: {
                    _workspace: workspace.file.id,
                    _position: {
                        x: gridPosition.x,
                        y: gridPosition.y,
                        z: height
                    },
                    _index: index + i
                }
            }));
        }

        this._gameView.fileManager.transaction(...events);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        updateFile(file, this._gameView.fileManager.userFile.id, data, () => this._gameView.fileManager.createContext());
        return fileUpdated(file.id, data);
    }

    protected _calcWorkspaceDragPosition(workspace: File3D, gridPosition: Vector2) {
        return this._interaction.calculateFileDragPosition(workspace, gridPosition, ...(<Object[]>this._files));
    }

    protected _showGrid(workspace: File3D): void {
        if (this._gridWorkspace) {
            this._gridWorkspace.gridsVisible = false;
        }
        this._gridWorkspace = <WorkspaceMesh>workspace.mesh;
        this._gridWorkspace.gridsVisible = true;
    }

    /**
     * Create a Group (Three Object3D) that the files can reside in during free dragging.
     * @param files The file to include in the group.
     */
    private _createFreeDragGroup(fileMeshes: FileMesh[]): Group {

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
        // Reparent all children of the group to the previous parent.
        let children = group.children;
        for (let i = 0; i < children.length; i++) {
            setParent(children[i], this._freeDragPrevParent, this._gameView.scene);
        }

        // Remove the group object from the scene.
        this._gameView.scene.remove(group);
    }
}
