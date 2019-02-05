import { Input } from '../game-engine/input';
import { File3D } from '../game-engine/File3D';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';
import { InteractionManager } from './InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../game-engine/Physics';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { Workspace, Object, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated } from 'common/Files';
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
    private _combine: boolean;
    private _other: Object;

    private _workspaceDelta: Vector3;
    private _dragDelta: Vector3;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, hit: Intersection, file: File3D, workspace: File3D) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._file = file;
        this._workspace = workspace;

        if (this._workspace) {
            // calculate the delta needed to be applied to the pointer
            // positions to have the pointer drag around the originally tapped point
            // instead of where the anchor is.
            this._workspaceDelta = new Vector3().copy(this._workspace.mesh.position).sub(hit.point);
            this._workspaceDelta.setY(0);
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

            this._gameView.fileManager.transaction(
                fileRemoved(this._workspace.file.id),
                fileUpdated(this._attachWorkspace.file.id, {
                    grid: {
                        [posToKey(this._attachPoint)]: {
                            height: height
                        }
                    }
                })
            );
        } else if(this._combine) {
            this._gameView.fileManager.action(this._file.file, this._other, '+');
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

                // calculate index for file
                const result = this._interaction.calculateFileDragPosition(workspace, gridPosition, <Object>this._file.file);
                
                this._combine = result.combine;
                this._other = result.other;
                if (!result.combine) {
                    this._gameView.fileManager.updateFile(this._file.file, {
                        tags: {
                            _workspace: workspace.file.id,
                            _position: {
                                x: gridPosition.x,
                                y: gridPosition.y,
                                z: height
                            },
                            _index: result.index
                        }
                    });
                } else {
                    // this._gameView.fileManager.updateFile(this._file.file, {
                    //     tags: {
                    //         _workspace: workspace.file.id,
                    //         _position: {
                    //             x: result.other.tags._position.x,
                    //             y: result.other.tags._position.y,
                    //             z: result.other.tags._position.z
                    //         },
                    //         _index: result.other.tags._index
                    //     }
                    // });
                }
            } else {
                // Don't move the file if it's not on a workspace
            }
        }
    }

    private _dragWorkspace() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.camera);
        const point = Physics.pointOnPlane(mouseDir, this._gameView.workspacePlane);

        if (point) {

            // if the workspace is only 1 tile large
            const workspace = <Workspace>this._workspace.file;
            if (workspace.size === 1 && (!workspace.grid || keys(workspace.grid).length === 0)) {
                // check if it is close to another workspace.
                const closest = this._interaction.closestWorkspace(point, this._workspace);

                if (closest) {                    
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
                point.setY(0);
            }

            // move the center of the workspace to the point
            let final = new Vector3().copy(point);
            if (!this._attachWorkspace) {
                final.add(this._workspaceDelta);
            }

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