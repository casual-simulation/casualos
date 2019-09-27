import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderFileDragOperation } from '../DragOperation/BuilderFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import BotTable from 'aux-web/aux-projector/BotTable/BotTable';
import { Vector2 } from 'three';

export class BuilderFileIDClickOperation extends BaseFileClickOperation {
    fileTable: BotTable;

    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        bot: Bot,
        vrController: VRController3D | null,
        table?: BotTable
    ) {
        super(simulation3D, interaction, bot, null, vrController);
        this.fileTable = table;
    }

    protected _performClick(calc: BotCalculationContext): void {
        if (this.fileTable != null) {
            this.fileTable.toggleFile(this._file);
        }
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseFileDragOperation {
        this._simulation3D.simulation.botPanel.hideOnDrag(true);

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
