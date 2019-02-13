import { Input } from '../game-engine/Input';
import { File3D } from '../game-engine/File3D';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../game-engine/Physics';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { File, Workspace, Object, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated, PartialFile, FileEvent } from 'common/Files';
import { keys, minBy, flatMap } from 'lodash';
import { keyToPos, gridPosToRealPos, realPosToGridPos, Axial, gridDistance, posToKey } from '../game-engine/hex';
import { isFormula, updateFile } from 'common/Files/FileCalculations';
import { FileManager } from 'WebClient/FileManager';

/**
 * Shared class for both FileDragOperation and NewFileDragOperation.
 */
export class SharedFileDragOperation implements IOperation {

    protected _gameView: GameView;
    protected _interaction: InteractionManager;
    protected _gridWorkspace: WorkspaceMesh;
    protected _files: File[];
    protected _file: File;
    protected _finished: boolean;
    protected _lastScreenPos: Vector2;
    protected _combine: boolean;
    protected _other: Object;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, files: File[]) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._files = files;
        if (this._files.length == 1) {
            this._file = this._files[0];
        }
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

            // Button has been released. This drag operation is finished.
            this._finished = true;

        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {
        this._gameView.setGridsVisible(false);

        this._disposeCore();
    }

    protected _disposeCore() {
        if (this._combine) {
            this._combineFiles(this._file, this._other, '+');
        }
    }

    private _dragFiles() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
        const { good, gridPosition, height, workspace } = this._interaction.pointOnGrid(mouseDir);

        if (this._files.length > 0) {
            if (good) {
                this._showGrid(workspace);

                // calculate index for file
                const result = this._calcuateDragPosition(workspace, gridPosition);
                
                this._combine = result.combine;
                this._other = result.other;
                if (!result.combine) {
                    this._updateFiles(workspace, gridPosition, height, result.index);
                } else {
                }
            } else {
                // Don't move the file if it's not on a workspace
            }
        }
    }

    protected _dragWorkspace() {}

    protected _combineFiles(first: File, second: File, eventName: string) {
        this._gameView.fileManager.action(this._file, this._other, '+');
    }

    protected _updateFiles(workspace: File3D, gridPosition: Vector2, height: number, index: number) {
        let events: FileEvent[] = [];
        for (let i = 0; i < this._files.length; i++) {
             events.push(this._updateFile(this._files[i], {
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

    protected _calcuateDragPosition(workspace: File3D, gridPosition: Vector2) {
        return this._interaction.calculateFileDragPosition(workspace, gridPosition, ...(<Object[]>this._files));
    }

    private _showGrid(workspace: File3D) {
        if (this._gridWorkspace) {
            this._gridWorkspace.gridsVisible = false;
        }
        this._gridWorkspace = <WorkspaceMesh>workspace.mesh;
        this._gridWorkspace.gridsVisible = true;
    }
}