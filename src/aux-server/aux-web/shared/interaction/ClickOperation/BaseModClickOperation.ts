import { InputType } from '../../../shared/scene/Input';
import { Vector2 } from 'three';
import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import {
    Bot,
    BotCalculationContext,
    BotTags,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../DragOperation/BaseBotDragOperation';
import { Simulation3D } from '../../scene/Simulation3D';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
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
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, vrController);
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
