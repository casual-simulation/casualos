import { AuxBot3D } from './AuxBot3D';
import {
    BotCalculationContext,
    LocalActions,
} from '@casual-simulation/aux-common';

export interface AuxBot3DDecorator {
    bot3D: AuxBot3D;

    botUpdated(calc: BotCalculationContext): void;
    botRemoved(calc: BotCalculationContext): void;
    frameUpdate?(calc: BotCalculationContext): void;
    localEvent?(event: LocalActions, calc: BotCalculationContext): void;
    dispose(): void;
}

export abstract class AuxBot3DDecoratorBase implements AuxBot3DDecorator {
    /**
     * The aux bot 3d that this decorator belongs to.
     */
    bot3D: AuxBot3D;

    constructor(bot3D: AuxBot3D) {
        this.bot3D = bot3D;
    }

    botRemoved(calc: BotCalculationContext): void {}
    abstract botUpdated(calc: BotCalculationContext): void;
    abstract dispose(): void;
}
