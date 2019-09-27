import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { BotCalculationContext } from '@casual-simulation/aux-common';

/**
 * Defines a AuxFile3D decorator that updates the bot's world matrix.
 */
export class UpdateMaxtrixDecorator extends AuxFile3DDecorator {
    constructor(file3D: AuxFile3D) {
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
