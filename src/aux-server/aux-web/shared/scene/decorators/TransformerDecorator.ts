import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateGridScale,
    getBuilderDimensionGrid,
    DEFAULT_WORKSPACE_GRID_SCALE,
    calculateStringTagValue,
    hasValue,
} from '@casual-simulation/aux-common';
import { calculateScale } from '../SceneUtils';
import { Group, Object3D } from 'three';

export class TransformerDecorator extends AuxBot3DDecoratorBase {
    constructor(bot3D: AuxBot3D) {
        super(bot3D);
    }

    botUpdated(calc: BotCalculationContext): void {
        const transformer = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'transformer',
            null
        );
        if (hasValue(transformer)) {
            const bots = this.bot3D.dimensionGroup.simulation3D.findBotsById(
                transformer
            );

            if (bots.length > 0) {
                const parentBot = bots[0];
                if (parentBot instanceof AuxBot3D) {
                    if (parentBot === this.bot3D) {
                        this.bot3D.setParent(this.bot3D.dimensionGroup);
                    } else {
                        this.bot3D.setParent(parentBot);
                    }
                }
            }
        } else {
            if (!this.bot3D.isOnGrid) {
                this.bot3D.setParent(this.bot3D.dimensionGroup);
            }
        }
    }

    dispose(): void {
        for (let child of this.bot3D.transformContainer.children) {
            if (child instanceof AuxBot3D) {
                child.setParent(child.dimensionGroup);
                this.bot3D.dimensionGroup.simulation3D.ensureUpdate([
                    child.bot.id,
                ]);
            }
        }
    }
}
