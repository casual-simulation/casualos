import { AuxBot3D } from './AuxBot3D';
import { BotCalculationContext } from '@casual-simulation/aux-common';

export abstract class AuxBot3DDecorator {
    /**
     * The aux bot 3d that this decorator belongs to.
     */
    bot3D: AuxBot3D;

    constructor(bot3D: AuxBot3D) {
        this.bot3D = bot3D;
    }

    botRemoved(calc: BotCalculationContext): void {}
    abstract botUpdated(calc: BotCalculationContext): void;
    abstract frameUpdate(calc: BotCalculationContext): void;
    abstract dispose(): void;
}
