import { Input } from '../../../shared/scene/Input';
import { File3D } from '../../../shared/scene/File3D';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import { File, Workspace, Object, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated } from '@yeti-cgi/aux-common/Files';
import { keys, minBy, flatMap } from 'lodash';
import { keyToPos, gridPosToRealPos, realPosToGridPos, Axial, gridDistance, posToKey } from '../../../shared/scene/hex';
import { isFormula } from '@yeti-cgi/aux-common/Files/FileCalculations';
import { BaseFileDragOperation } from './BaseFileDragOperation';

/**
 * File Drag Operation handles dragging of files for mouse and touch input.
 */
export class FileDragOperation extends BaseFileDragOperation {

    private _workspace: File3D;
    private _attachWorkspace: File3D;
    private _attachPoint: Axial;

    private _workspaceDelta: Vector3;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, hit: Intersection, files: File[], workspace: File3D) {
        super(gameView, interaction, files);

        this._workspace = workspace;

        if (this._workspace) {
            // calculate the delta needed to be applied to the pointer
            // positions to have the pointer drag around the originally tapped point
            // instead of where the anchor is.
            this._workspaceDelta = new Vector3().copy(this._workspace.mesh.position).sub(hit.point);
            this._workspaceDelta.setY(0);
        }
    }

    protected _disposeCore() {
        if (this._attachWorkspace) {
            this._attachWorkspaces();
        } else {
            super._disposeCore();
        }
    }

    protected _dragWorkspace() {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const point = Physics.pointOnPlane(mouseDir, this._gameView.groundPlane);

        if (point) {

            // if the workspace is only 1 tile large and not minimized
            const workspace = <Workspace>this._workspace.file;
            if (workspace.tags.size === 1 && !workspace.tags.minimized && (!workspace.tags.grid || keys(workspace.tags.grid).length === 0)) {
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
                const scale = w.tags.scale || DEFAULT_WORKSPACE_SCALE;
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
                tags: {
                    position: {
                        x: final.x,
                        y: final.y,
                        z: final.z
                    }
                }
            });
        }
    }

    protected _attachWorkspaces() {
        const mesh = <WorkspaceMesh>this._workspace.mesh;
        const height = mesh.hexGrid.hexes[0].height;

        this._gameView.fileManager.transaction(
            fileRemoved(this._workspace.file.id),
            fileUpdated(this._attachWorkspace.file.id, {
                tags: {
                    grid: {
                        [posToKey(this._attachPoint)]: {
                            height: height
                        }
                    }
                }
            })
        );
    }
}