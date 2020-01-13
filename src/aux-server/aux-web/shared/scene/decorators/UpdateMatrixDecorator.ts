import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import { BotCalculationContext } from '@casual-simulation/aux-common';

/**
 * Defines a AuxBot3D decorator that updates the bot's world matrix.
 */
export class UpdateMaxtrixDecorator extends AuxBot3DDecoratorBase {
    constructor(bot3D: AuxBot3D) {
        super(bot3D);
    }

    botUpdated(calc: BotCalculationContext): void {
        const userContext = this.bot3D.dimension;
        if (userContext) {
            this.bot3D.updateMatrixWorld(true);
        }
    }

    dispose(): void {}
}
