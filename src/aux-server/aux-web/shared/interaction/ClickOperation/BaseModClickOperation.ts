import type { InputMethod, InputModality } from '../../../shared/scene/Input';
import { InputType } from '../../../shared/scene/Input';
import type { Vector2 } from '@casual-simulation/three';
import type { IOperation } from '../IOperation';
import type { BaseInteractionManager } from '../BaseInteractionManager';
import type {
    BotCalculationContext,
    BotTags,
} from '@casual-simulation/aux-common';
import { Bot } from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../DragOperation/BaseBotDragOperation';
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
