import {
    File,
    FileCalculationContext,
    tweenTo,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderFileDragOperation } from '../DragOperation/BuilderFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';

export class BuilderFileIDClickOperation extends BaseFileClickOperation {
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        file: File
    ) {
        super(simulation3D, interaction, file, null);
    }

    protected _performClick(calc: FileCalculationContext): void {
        // Tween the camera focus on the file.
        this.simulation.helper.transaction(tweenTo(this._file.id));
    }

    protected _createDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation {
        this._simulation3D.simulation.filePanel.HideOnDrag(true);

        return new BuilderFileDragOperation(
            this._simulation3D,
            <BuilderInteractionManager>this._interaction,
            null,
            [this._file],
            null,
            null
        );
    }
}
