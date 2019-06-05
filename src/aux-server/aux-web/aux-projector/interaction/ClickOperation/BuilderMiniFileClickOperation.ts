import {
    File,
    FileCalculationContext,
    AuxObject,
} from '@casual-simulation/aux-common';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { BuilderNewFileClickOperation } from './BuilderNewFileClickOperation';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';

export class BuilderMiniFileClickOperation extends BuilderNewFileClickOperation {
    constructor(
        simulation3D: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        file: AuxObject
    ) {
        super(simulation3D, interaction, file);
    }

    protected _performClick(calc: FileCalculationContext): void {
        // this._simulation3D.selectRecentFile(this._file);
        this.simulation.filePanel.toggleOpen();
    }
}
