import { Intersection, Vector3 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { File, Workspace, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated } from '@yeti-cgi/aux-common/Files';
import { keys } from 'lodash';
import { gridPosToRealPos, Axial, posToKey } from '../../../shared/scene/hex';
import { FileCalculationContext, getContextMinimized, getContextSize, getContextGrid } from '@yeti-cgi/aux-common/Files/FileCalculations';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { appManager } from '../../../shared/AppManager';
import GameView from '../../GameView/GameView';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { BaseBuilderFileDragOperation } from './BaseBuilderFileDragOperation';

/**
 * File Drag Operation handles dragging of files for mouse and touch input.
 */
export class BuilderFileDragOperation extends BaseBuilderFileDragOperation {

    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;
    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _workspace: BuilderGroup3D;
    private _attachWorkspace: ContextGroup3D;
    private _attachPoint: Axial;

    private _workspaceDelta: Vector3;

    /**
     * Create a new drag rules.
     */
    constructor(gameView: GameView, interaction: BuilderInteractionManager, hit: Intersection, files: File[], workspace: BuilderGroup3D, context: string) {
        super(gameView, interaction, files, context);

        this._workspace = workspace;

        if (this._workspace) {
            // calculate the delta needed to be applied to the pointer
            // positions to have the pointer drag around the originally tapped point
            // instead of where the anchor is.
            this._workspaceDelta = new Vector3().copy(this._workspace.position).sub(hit.point);
            this._workspaceDelta.setY(0);
        }
    }

    protected _onDrag(calc: FileCalculationContext) {
        if (this._workspace) {
            this._onDragWorkspace(calc);
        } else {
            super._onDrag(calc);
        }
    }

    protected _disposeCore() {
        if (this._attachWorkspace) {
            this._attachWorkspaces();
        } else {
            super._disposeCore();
        }
    }

    protected _onDragWorkspace(calc: FileCalculationContext) {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const point = Physics.pointOnPlane(mouseDir, this._gameView.groundPlane);

        if (point) {

            // if the workspace is only 1 tile large and not minimized
            const workspace = <Workspace>this._workspace.file;
            const domain = this._workspace.domain;
            const size = getContextSize(calc, workspace, domain);
            const minimized = getContextMinimized(calc, workspace, domain);
            const grid = getContextGrid(calc, workspace, domain);
            const files = this._workspace.getFiles();
            if (size === 1 && !minimized && (!grid || keys(grid).length === 0) && files.length === 0) {
                // check if it is close to another workspace.
                const closest = this._interaction.closestWorkspace(calc, point, this._workspace);

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
                point.copy(new Vector3(realPos.x, 0, realPos.y)).add(this._attachWorkspace.position);
                point.setY(0);
            }

            // move the center of the workspace to the point
            let final = new Vector3().copy(point);
            if (!this._attachWorkspace) {
                final.add(this._workspaceDelta);
            }

            appManager.fileManager.updateFile(this._workspace.file, {
                tags: {
                    [`aux.${this._workspace.domain}.context.x`]: final.x,
                    [`aux.${this._workspace.domain}.context.y`]: final.z,
                    [`aux.${this._workspace.domain}.context.z`]: final.y
                }
            });
        }
    }

    protected _attachWorkspaces() {
        const mesh = this._workspace.surface;
        const height = mesh.hexGrid.hexes[0].height;

        appManager.fileManager.transaction(
            fileRemoved(this._workspace.file.id),
            fileUpdated(this._attachWorkspace.file.id, {
                tags: {
                    [`aux.${this._workspace.domain}.context.grid`]: {
                        [posToKey(this._attachPoint)]: {
                            height: height
                        }
                    }
                }
            })
        );
    }
}