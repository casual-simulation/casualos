import { Input } from '../game-engine/input';
import { File3D } from '../game-engine/Interfaces';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { Ray, Intersection, Vector2 } from 'three';
import { Physics } from '../game-engine/Physics';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';

/**
 * File Drag Operation handles dragging of files for mouse and touch input.
 */
export class FileDragOperation implements IOperation {

    private _gameView: GameView;
    private _interaction: InteractionManager;
    private _file: File3D;
    private _workspace: File3D;
    private _finished: boolean;
    private _gridWorkspace: WorkspaceMesh;

    private _lastScreenPos: Vector2;


    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, file: File3D, workspace: File3D) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._file = file;
        this._workspace = workspace;

        // if (!this._workspace) {
        //     // we're gonna be dragging the file. turn on the grids.
        //     const mesh = <WorkspaceMesh>this._workspace.mesh;
        //     mesh.gridsVisible = true;
        //     this._gameView.gridsVisible = true;
        // }
        

        this._lastScreenPos = this._gameView.input.getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (this._gameView.input.getMouseButtonHeld(0)) {
            const curScreenPos = this._gameView.input.getMouseScreenPos();

            if (!curScreenPos.equals(this._lastScreenPos)) {

                if (this._workspace) {
                    this._dragWorkspace();
                } else {
                    this._dragFile();
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
    }

    private _dragFile() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
        const { good, point, workspace } = this._interaction.pointOnGrid(mouseDir);

        if (this._file) {
            if (good) {
                if (this._gridWorkspace) {
                    this._gridWorkspace.gridsVisible = false;
                }
                this._gridWorkspace = <WorkspaceMesh>workspace.mesh;
                this._gridWorkspace.gridsVisible = true;
                this._gameView.fileManager.updateFile(this._file.file, {
                    tags: {
                        _workspace: workspace.file.id,
                        _position: {
                            x: point.x,
                            y: point.y,
                            z: point.z
                        }
                    }
                });
            } else {
                const p = Physics.pointOnRay(mouseDir, 2);
                this._gameView.fileManager.updateFile(this._file.file, {
                    tags: {
                        _workspace: null,
                        _position: {
                            x: p.x,
                            y: p.y,
                            z: p.z
                        }
                    }
                });
            }
        }
    }

    private _dragWorkspace() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
        const point = Physics.pointOnPlane(mouseDir, this._gameView.workspacePlane);

        if (point) {
            this._gameView.fileManager.updateFile(this._workspace.file, {
                position: {
                    x: point.x,
                    y: point.y,
                    z: point.z
                }
            });
        }
    }
}