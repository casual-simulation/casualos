import { AuxBot3DDecorator } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import { BotCalculationContext } from '@casual-simulation/aux-common';

/**
 * Defines a AuxBot3D decorator that updates the bot's world matrix.
 */
export class UpdateMaxtrixDecorator extends AuxBot3DDecorator {
    constructor(file3D: AuxBot3D) {
        super(file3D);
    }

    botUpdated(calc: BotCalculationContext): void {
        const userContext = this.file3D.context;
        if (userContext) {
            this.file3D.updateMatrixWorld(true);
        }
    }

    frameUpdate(calc: BotCalculationContext): void {}

    dispose(): void {}
}
