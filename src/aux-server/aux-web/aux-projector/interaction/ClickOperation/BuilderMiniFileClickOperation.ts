import {
    Bot,
    FileCalculationContext,
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
        file: AuxObject,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, file, vrController);
    }

    protected _performClick(calc: FileCalculationContext): void {
        // this._simulation3D.selectRecentFile(this._file);
        this.simulation.filePanel.toggleOpen();
    }
}
