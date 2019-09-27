import {
    Bot,
    BotCalculationContext,
    AuxObject,
} from '@casual-simulation/aux-common';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { BuilderNewFileClickOperation } from './BuilderNewFileClickOperation';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

export class BuilderMiniFileClickOperation extends BuilderNewFileClickOperation {
    constructor(
        simulation3D: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        bot: AuxObject,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, bot, vrController);
    }

    protected _performClick(calc: BotCalculationContext): void {
        // this._simulation3D.selectRecentFile(this._file);
        this.simulation.botPanel.toggleOpen();
    }
}
