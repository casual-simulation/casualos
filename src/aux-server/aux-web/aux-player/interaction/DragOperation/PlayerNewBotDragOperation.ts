/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    Bot,
    BotCalculationContext,
    BotAction,
    PartialBot,
} from '@casual-simulation/aux-common';
import {
    merge,
    createBot,
    botAdded,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import type { PlayerInteractionManager } from '../PlayerInteractionManager';
import type { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { PlayerBotDragOperation } from './PlayerBotDragOperation';
import type { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import type { InputMethod, InputModality } from '../../../shared/scene/Input';
import type { MapSimulation3D } from '../../scene/MapSimulation3D';

export class PlayerNewBotDragOperation extends PlayerBotDragOperation {
    private _botAdded: boolean;

    /**
     * Create a new drag rules.
     */
    constructor(
        playerSimulation: PlayerPageSimulation3D,
        miniSimulation: MiniSimulation3D,
        mapSimulation: MapSimulation3D,
        miniMapSimulation: MapSimulation3D,
        interaction: PlayerInteractionManager,
        bot: Bot,
        dimension: string,
        inputMethod: InputMethod,
        inputModality: InputModality
    ) {
        super(
            playerSimulation,
            miniSimulation,
            mapSimulation,
            miniMapSimulation,
            interaction,
            [bot],
            dimension,
            inputMethod,
            inputModality
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
