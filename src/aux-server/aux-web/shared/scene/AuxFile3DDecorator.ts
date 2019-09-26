import { AuxFile3D } from './AuxFile3D';
import { BotCalculationContext } from '@casual-simulation/aux-common';

export abstract class AuxFile3DDecorator {
    /**
     * The aux file 3d that this decorator belongs to.
     */
    file3D: AuxFile3D;

    constructor(file3D: AuxFile3D) {
        this.file3D = file3D;
    }

    fileRemoved(calc: BotCalculationContext): void {}
    abstract fileUpdated(calc: BotCalculationContext): void;
    abstract frameUpdate(calc: BotCalculationContext): void;
    abstract dispose(): void;
}
