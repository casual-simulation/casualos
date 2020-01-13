import { Physics } from '../../../shared/scene/Physics';
import {
    Bot,
    PartialBot,
    botAdded,
    BotAction,
    BotTags,
    calculateBotDragStackPosition,
} from '@casual-simulation/aux-common/bots';
import {
    createBot,
    BotCalculationContext,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { merge } from '@casual-simulation/aux-common/utils';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { BaseBuilderBotDragOperation } from './BaseBuilderBotDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { BaseModDragOperation } from '../../../shared/interaction/DragOperation/BaseModDragOperation';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import { Vector2, Ray } from 'three';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';

/**
 * New Bot Drag Operation handles dragging of new bots from the bot queue.
 */
export class BuilderModDragOperation extends BaseModDragOperation {
    public static readonly FreeDragDistance: number = 6;

    protected _interaction: BuilderInteractionManager;
    protected _gridWorkspace: WorkspaceMesh;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        mod: BotTags,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, mod, vrController);
    }

    _onDrag(calc: BotCalculationContext) {
        let input: Vector2 | Ray;

        if (this._vrController) {
            input = this._vrController.pointerRay;
        } else {
            input = this.game.getInput().getMousePagePos();
        }

        const {
            good,
            gridPosition,
            workspace,
        } = this._interaction.pointOnWorkspaceGrid(calc, input);

        if (good) {
            this._dragBotsOnWorkspace(calc, workspace, gridPosition);
        } else {
            // drag free
            this.dimensionGroup = null;
        }
    }

    protected _dragBotsOnWorkspace(
        calc: BotCalculationContext,
        workspace: BuilderGroup3D,
        gridPosition: Vector2
    ): void {
        // if (this._freeDragGroup) {
        //     this._releaseFreeDragGroup(this._freeDragGroup);
        //     this._freeDragGroup = null;
        // }

        this._showGrid(workspace);

        this.dimensionGroup = workspace;
        this._previousDimension = null;
        if (!workspace.dimensions.has(this._dimension)) {
            const next = this._interaction.firstDimensionInWorkspace(workspace);
            this._previousDimension = this._dimension;
            this._dimension = next;
        }

        // calculate index for bot
        const result = calculateBotDragStackPosition(
            calc,
            this._dimension,
            gridPosition,
            this._mod
        );

        this._merge = result.merge;
        this._other = result.other;

        if (result.merge || result.index === 0) {
            this._updateModPosition(calc, gridPosition, result.index);
        }
    }

    protected _showGrid(workspace: BuilderGroup3D): void {
        if (this._gridWorkspace) {
            this._gridWorkspace.gridsVisible = false;
        }
        this._gridWorkspace = <WorkspaceMesh>workspace.surface;
        this._gridWorkspace.gridsVisible = true;
    }
}
