import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import {
    Bot,
    BotCalculationContext,
    BotAction,
    isBotMovable,
    merge,
    createBot,
    botAdded,
    PartialBot,
    CREATE_ACTION_NAME,
    BotDragMode,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerBotDragOperation } from './PlayerBotDragOperation';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

export class PlayerNewBotDragOperation extends PlayerBotDragOperation {
    private _botAdded: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation: PlayerSimulation3D,
        inventorySimulation: InventorySimulation3D,
        interaction: PlayerInteractionManager,
        bot: Bot,
        context: string,
        vrController: VRController3D | null
    ) {
        super(
            playerSimulation,
            inventorySimulation,
            interaction,
            [bot],
            context,
            vrController
        );
    }

    protected _updateBot(bot: Bot, data: PartialBot): BotAction {
        if (!this._botAdded) {
            // Add the duplicated bot.
            this._bot = merge(this._bot, data || {});
            this._bot = createBot(undefined, this._bot.tags);
            this._bots = [this._bot];
            this._botAdded = true;

            return botAdded(this._bot);
        } else {
            return super._updateBot(this._bot, data);
        }
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        if (this._botAdded) {
            this.simulation.helper.action(CREATE_ACTION_NAME, this._bots);
        }
        super._onDragReleased(calc);
    }

    protected _canDragWithinContext(mode: BotDragMode): boolean {
        return true;
    }

    protected _canDragOutOfContext(mode: BotDragMode): boolean {
        return true;
    }
}
