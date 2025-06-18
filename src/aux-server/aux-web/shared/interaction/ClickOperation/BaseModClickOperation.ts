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
import type { Vector2 } from '@casual-simulation/three';
import type { IOperation } from '../IOperation';
import type { BaseInteractionManager } from '../BaseInteractionManager';
import type {
    BotCalculationContext,
    BotTags,
} from '@casual-simulation/aux-common';
import type { Simulation3D } from '../../scene/Simulation3D';
import { BaseClickOperation } from './BaseClickOperation';

/**
 * Mod click operation handles clicking logic for mods.
 */
export abstract class BaseModClickOperation extends BaseClickOperation {
    protected _mod: BotTags;

    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        mod: BotTags,
        inputMethod: InputMethod,
        inputModality: InputModality
    ) {
        super(simulation3D, interaction, inputMethod, inputModality);
        this._mod = mod;
    }

    protected _baseCreateDragOperation(calc: BotCalculationContext) {
        return this._createDragOperation(calc);
    }

    protected abstract _createDragOperation(
        calc: BotCalculationContext,
        fromPos?: Vector2
    ): IOperation;
}
