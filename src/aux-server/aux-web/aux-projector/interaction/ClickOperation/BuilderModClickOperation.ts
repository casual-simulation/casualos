import {
    Bot,
    Object,
    duplicateBot,
    BotCalculationContext,
    BotTags,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';
import { BaseModClickOperation } from '../../../shared/interaction/ClickOperation/BaseModClickOperation';
import { BuilderModDragOperation } from '../DragOperation/BuilderModDragOperation';
import { IOperation } from '../../../shared/interaction/IOperation';

/**
 * Mod Bot Click Operation handles clicking of mods.
 */
export class BuilderModClickOperation extends BaseModClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: BuilderSimulation3D;

    // protected _allowSelection: boolean;

    constructor(
        simulation: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        mod: BotTags,
        vrController: VRController3D | null
        // allowSelection: boolean = false
    ) {
        super(simulation, interaction, mod, vrController);
        // this._allowSelection = allowSelection;
    }

    protected _performClick(calc: BotCalculationContext): void {
        // if (this._allowSelection) {
        //     this._simulation3D.simulation.recent.addBotDiff(this._mod, true);
        //     this._simulation3D.simulation.selection.clearSelection();
        //     this._simulation3D.simulation.botPanel.isOpen = true;
        // }
        // Do nothing by default
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): IOperation {
        this._simulation3D.simulation.botPanel.hideOnDrag(true);

        return new BuilderModDragOperation(
            this._simulation3D,
            this._interaction,
            this._mod,
            this._vrController
        );
    }

    protected _canDrag(calc: BotCalculationContext) {
        return true;
    }
}
