import { Intersection, Vector3 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import {
    File,
    Workspace,
    DEFAULT_WORKSPACE_SCALE,
    fileRemoved,
    fileUpdated,
} from '@casual-simulation/aux-common/Files';
import { keys } from 'lodash';
import { gridPosToRealPos, Axial, posToKey } from '../../../shared/scene/hex';
import {
    FileCalculationContext,
    getContextMinimized,
    getContextSize,
    getBuilderContextGrid,
    isMinimized,
} from '@casual-simulation/aux-common/Files/FileCalculations';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import GameView from '../../GameView/GameView';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { BaseBuilderFileDragOperation } from './BaseBuilderFileDragOperation';
import { Simulation3D } from '../../../shared/scene/Simulation3D';

/**
 * File Drag Operation handles dragging of files for mouse and touch input.
 */
export class BuilderFileDragOperation extends BaseBuilderFileDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    private _workspace: BuilderGroup3D;
    private _workspaceDelta: Vector3;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation: Simulation3D,
        interaction: BuilderInteractionManager,
        hit: Intersection,
        files: File[],
        workspace: BuilderGroup3D,
        context: string
    ) {
        super(simulation, interaction, files, context);

        this._workspace = workspace;

        if (this._workspace) {
            this.gameView.setWorldGridVisible(true);

            // calculate the delta needed to be applied to the pointer
            // positions to have the pointer drag around the originally tapped point
            // instead of where the anchor is.
            this._workspaceDelta = new Vector3()
                .copy(this._workspace.position)
                .sub(hit.point);
            this._workspaceDelta.setY(0);
        }
    }

    protected _disposeCore() {
        if (this._workspace) {
            this.gameView.setWorldGridVisible(false);
        }
        super._disposeCore();
    }

    protected _onDrag(calc: FileCalculationContext) {
        if (this._workspace) {
            if (isMinimized(calc, this._workspace.file)) {
                this._onDragWorkspace(calc);
            }
        } else {
            super._onDrag(calc);
        }
    }

    protected _onDragWorkspace(calc: FileCalculationContext) {
        const mouseDir = Physics.screenPosToRay(
            this.gameView.getInput().getMouseScreenPos(),
            this.gameView.getMainCamera()
        );
        const point = Physics.pointOnPlane(
            mouseDir,
            this.gameView.getGroundPlane()
        );

        if (point) {
            // move the center of the workspace to the point
            let final = new Vector3().copy(point);

            this.simulation.helper.updateFile(this._workspace.file, {
                tags: {
                    [`aux.context.x`]: final.x,
                    [`aux.context.y`]: final.z,
                    [`aux.context.z`]: final.y,
                },
            });
        }
    }
}
