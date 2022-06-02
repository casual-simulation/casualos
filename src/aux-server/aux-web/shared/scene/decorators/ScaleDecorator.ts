import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateGridScale,
    getBuilderDimensionGrid,
    DEFAULT_WORKSPACE_GRID_SCALE,
    getBotScale,
} from '@casual-simulation/aux-common';
import { calculateScale } from '../SceneUtils';
import { CoordinateSystem } from '../CoordinateSystem';

export class ScaleDecorator extends AuxBot3DDecoratorBase {
    constructor(bot3D: AuxBot3D) {
        super(bot3D);
    }

    botUpdated(calc: BotCalculationContext): void {
        const gridScale = this.bot3D.gridScale;

        const scale = calculateScale(calc, this.bot3D.bot, gridScale);
        this.bot3D.scaleContainer.scale.set(scale.x, scale.y, scale.z);
    }

    dispose(): void {}
}
