import {
    Bot,
    Object,
    duplicateBot,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { BuilderNewBotDragOperation } from '../DragOperation/BuilderNewBotDragOperation';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { Vector2 } from 'three';

/**
 * New Bot Click Operation handles clicking of bots that are in the bot queue.
 */
export class BuilderNewBotClickOperation extends BaseBotClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;
    // This overrides the base class Simulation3D
    protected _simulation3D: BuilderSimulation3D;

    constructor(
        simulation: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        bot: Bot,
        vrController: VRController3D | null
    ) {
        super(simulation, interaction, bot, null, vrController);
    }

    protected _performClick(calc: BotCalculationContext): void {
        // Do nothing by default
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        let duplicatedBot = duplicateBot(calc, <Object>this._bot);

        return new BuilderNewBotDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedBot,
            this._bot,
            this._vrController,
            fromCoord
        );
    }

    protected _canDrag(calc: BotCalculationContext) {
        return true;
    }
}
