import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { BuilderBotDragOperation } from '../DragOperation/BuilderBotDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import BotTable from '../../BotTable/BotTable';
import { Vector2 } from 'three';

export class BuilderBotIDClickOperation extends BaseBotClickOperation {
    botTable: BotTable;

    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        bot: Bot,
        vrController: VRController3D | null,
        table?: BotTable
    ) {
        super(simulation3D, interaction, bot, null, vrController);
        this.botTable = table;
    }

    protected _performClick(calc: BotCalculationContext): void {
        if (this.botTable != null) {
            this.botTable.toggleBot(this._bot);
        }
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        this._simulation3D.simulation.botPanel.hideOnDrag(true);

        return new BuilderBotDragOperation(
            this._simulation3D,
            <BuilderInteractionManager>this._interaction,
            null,
            [this._bot],
            null,
            null,
            this._vrController,
            fromCoord
        );
    }
}
