import { Input } from '../game-engine/input';
import { File3D } from '../game-engine/Interfaces';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../game-engine/Physics';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { Workspace, DEFAULT_WORKSPACE_SCALE } from 'common/Files';
import { keys, minBy, flatMap } from 'lodash';
import { keyToPos, gridPosToRealPos, realPosToGridPos, Axial, gridDistance, posToKey } from '../game-engine/hex';
import { isFormula } from 'common/Files/FileCalculations';

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
    private _attachWorkspace: File3D;
    private _attachPoint: Axial;
    private _lastScreenPos: Vector2;

    private _workspaceDelta: Vector3;

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

        if (this._workspace) {
            // calculate the delta needed to be applied to the pointer
            // positions to have the pointer drag around the center of the workspace
            // instead of where the anchor is.
            const bounds = new Box3().setFromObject(this._workspace.mesh);
            const center = new Vector3();
            bounds.getCenter(center);
            this._workspaceDelta = new Vector3().copy(this._workspace.mesh.position).sub(center);
        }
        

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

        if (this._attachWorkspace) {
            const mesh = <WorkspaceMesh>this._workspace.mesh;
            const height = mesh.hexGrid.hexes[0].height;
            this._gameView.fileManager.removeFile(this._workspace.file);
            this._gameView.fileManager.updateFile(this._attachWorkspace.file, {
                grid: {
                    [posToKey(this._attachPoint)]: {
                        height: height
                    }
                }
            });
        }
    }

    private _dragFile() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
        const { good, gridPosition, height, workspace } = this._interaction.pointOnGrid(mouseDir);

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
                            x: gridPosition.x,
                            y: gridPosition.y,
                            z: height
                            // TODO: Make index
                            // z: gridPosition.z
                        }
                    }
                });
            } else {
                // Don't move the file if it's not on a workspace
                // const p = Physics.pointOnRay(mouseDir, 2);
                // this._gameView.fileManager.updateFile(this._file.file, {
                //     tags: {
                //         _workspace: null,
                //         _position: {
                //             x: p.x,
                //             y: p.y,
                //             z: p.z
                //         }
                //     }
                // });
            }
        }
    }

    private _dragWorkspace() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
        const point = Physics.pointOnPlane(mouseDir, this._gameView.workspacePlane);

        if (point) {

            // if the workspace is only 1 tile large
            const workspace = <Workspace>this._workspace.file;
            if (workspace.size === 1 && keys(workspace.grid).length === 0) {
                // check if it is close to another workspace.
                const closest = this._interaction.closestWorkspace(point, this._workspace);

                if (closest) {
                    console.log(closest.distance, closest.mesh.mesh.id);
                    
                    if (closest.distance <= 1) {
                        this._attachWorkspace = closest.mesh;
                        this._attachPoint = closest.gridPosition;
                    } else {
                        this._attachWorkspace = null;
                        this._attachPoint = null;
                    }
                }
            }

            if (this._attachWorkspace) {
                const w = <Workspace>this._attachWorkspace.file;
                const scale = w.scale || DEFAULT_WORKSPACE_SCALE;
                const realPos = gridPosToRealPos(this._attachPoint, scale);
                point.copy(new Vector3(realPos.x, 0, realPos.y)).add(this._attachWorkspace.mesh.position);
            }

            // move the center of the workspace to the point
            const final = new Vector3().copy(point).add(this._workspaceDelta);

            this._gameView.fileManager.updateFile(this._workspace.file, {
                position: {
                    x: final.x,
                    y: final.y,
                    z: final.z
                }
            });
        }
    }
}