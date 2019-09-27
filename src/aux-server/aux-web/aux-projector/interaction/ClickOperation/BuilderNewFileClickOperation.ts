import {
    UserMode,
    Bot,
    Object,
    duplicateBot,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { BuilderNewFileDragOperation } from '../DragOperation/BuilderNewFileDragOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';

/**
 * New Bot Click Operation handles clicking of files that are in the file queue.
 */
export class BuilderNewFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: BuilderSimulation3D;

    constructor(
        simulation: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        file: Bot,
        vrController: VRController3D | null
    ) {
        super(simulation, interaction, file, null, vrController);
    }

    protected _performClick(calc: BotCalculationContext): void {
        // Do nothing by default
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseFileDragOperation {
        let duplicatedFile = duplicateBot(calc, <Object>this._file);

        this._simulation3D.simulation.botPanel.hideOnDrag(true);

        return new BuilderNewFileDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            this._file,
            this._vrController
        );
    }

    protected _canDragFile(calc: BotCalculationContext, file: Bot) {
        return true;
    }
}
