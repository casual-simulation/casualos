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
import type { InputMethod, InputModality } from '../../../shared/scene/Input';
import type { Intersection } from '@casual-simulation/three';
import { Vector2 } from '@casual-simulation/three';
import type { BaseInteractionManager } from '../BaseInteractionManager';
import type { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { getBotPosition } from '@casual-simulation/aux-common';
import type { BaseBotDragOperation } from '../DragOperation/BaseBotDragOperation';
import type { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import type { DimensionGroup3D } from '../../../shared/scene/DimensionGroup3D';
import type { Simulation3D } from '../../scene/Simulation3D';

import { BaseClickOperation } from './BaseClickOperation';

/**
 * Bot Click Operation handles clicking of bots for mouse and touch input with the primary (left/first finger) interaction button.
 */
export abstract class BaseBotClickOperation extends BaseClickOperation {
    protected _bot: Bot;
    protected _bot3D: AuxBot3D | DimensionGroup3D | null;

    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        bot: Bot,
        bot3D: AuxBot3D | DimensionGroup3D | null,
        inputMethod: InputMethod,
        inputModality: InputModality,
        hit?: Intersection
    ) {
        super(simulation3D, interaction, inputMethod, inputModality, hit);
        this._bot = bot;
        this._bot3D = bot3D;
    }

    protected _canDrag(calc: BotCalculationContext): boolean {
        return true;
    }

    protected _baseCreateDragOperation(calc: BotCalculationContext) {
        let startBotPos: Vector2 = null;
        if (this._bot3D != null && this._bot3D.display != null) {
            let tempPos = getBotPosition(
                calc,
                this._bot3D.bot,
                (this._bot3D as AuxBot3D).dimension
            );
            startBotPos = new Vector2(tempPos.x, tempPos.y);
        }

        return this._createDragOperation(calc, startBotPos);
    }

    protected abstract _createDragOperation(
        calc: BotCalculationContext,
        fromPos?: Vector2
    ): BaseBotDragOperation;
}
