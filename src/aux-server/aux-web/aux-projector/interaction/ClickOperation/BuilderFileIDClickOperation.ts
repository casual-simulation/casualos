import { Bot, FileCalculationContext } from '@casual-simulation/aux-common';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderFileDragOperation } from '../DragOperation/BuilderFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import FileTable from 'aux-web/aux-projector/FileTable/FileTable';
import { Vector2 } from 'three';

export class BuilderFileIDClickOperation extends BaseFileClickOperation {
    fileTable: FileTable;

    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        file: Bot,
        vrController: VRController3D | null,
        table?: FileTable
    ) {
        super(simulation3D, interaction, file, null, vrController);
        this.fileTable = table;
    }

    protected _performClick(calc: FileCalculationContext): void {
        if (this.fileTable != null) {
            this.fileTable.toggleFile(this._file);
        }
    }

    protected _createDragOperation(
        calc: FileCalculationContext,
        fromCoord?: Vector2
    ): BaseFileDragOperation {
        this._simulation3D.simulation.filePanel.hideOnDrag(true);

        return new BuilderFileDragOperation(
            this._simulation3D,
            <BuilderInteractionManager>this._interaction,
            null,
            [this._file],
            null,
            null,
            this._vrController
        );
    }
}
