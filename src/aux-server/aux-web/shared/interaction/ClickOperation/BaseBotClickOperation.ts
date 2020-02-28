import {
    InputType,
    ControllerData,
    InputMethod,
} from '../../../shared/scene/Input';
import { Vector2, Intersection } from 'three';
import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import {
    Bot,
    BotCalculationContext,
    isBotMovable,
    getBotPosition,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../DragOperation/BaseBotDragOperation';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { DimensionGroup3D } from '../../../shared/scene/DimensionGroup3D';
import { Simulation3D } from '../../scene/Simulation3D';
import {
    VRDragThresholdPassed,
    DragThresholdPassed,
} from './ClickOperationUtils';
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
        hit?: Intersection
    ) {
        super(simulation3D, interaction, inputMethod, hit);
        this._bot = bot;
        this._bot3D = bot3D;
    }

    protected _canDrag(calc: BotCalculationContext): boolean {
        return isBotMovable(calc, this._bot);
    }

    protected _baseCreateDragOperation(calc: BotCalculationContext) {
        let startBotPos: Vector2 = null;
        if (this._bot3D != null && this._bot3D.display != null) {
            let tempPos = getBotPosition(
                calc,
                this._bot3D.bot,
                (this._bot3D as AuxBot3D).dimension
            );
            startBotPos = new Vector2(
                Math.round(tempPos.x),
                Math.round(tempPos.y)
            );
        }

        return this._createDragOperation(calc, startBotPos);
    }

    protected abstract _createDragOperation(
        calc: BotCalculationContext,
        fromPos?: Vector2
    ): BaseBotDragOperation;
}
