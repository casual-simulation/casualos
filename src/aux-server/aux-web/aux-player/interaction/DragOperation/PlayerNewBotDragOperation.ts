import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import {
    Bot,
    BotCalculationContext,
    BotAction,
    merge,
    createBot,
    botAdded,
    PartialBot,
    CREATE_ACTION_NAME,
    BotDragMode,
} from '@casual-simulation/aux-common';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { PlayerBotDragOperation } from './PlayerBotDragOperation';
import { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import { InputMethod } from '../../../shared/scene/Input';

export class PlayerNewBotDragOperation extends PlayerBotDragOperation {
    private _botAdded: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation: PlayerPageSimulation3D,
        miniSimulation: MiniSimulation3D,
        interaction: PlayerInteractionManager,
        bot: Bot,
        dimension: string,
        inputMethod: InputMethod
    ) {
        super(
            playerSimulation,
            miniSimulation,
            interaction,
            [bot],
            dimension,
            inputMethod
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
}
