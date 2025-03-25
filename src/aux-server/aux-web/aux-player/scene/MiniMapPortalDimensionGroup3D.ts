import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import type { Bot, AuxDomain } from '@casual-simulation/aux-common';
import { BotCalculationContext } from '@casual-simulation/aux-common';
import type { AuxBot3DDecoratorFactory } from '../../shared/scene/decorators/AuxBot3DDecoratorFactory';
import type { MapSimulation3D } from './MapSimulation3D';

export class MiniMapPortalDimensionGroup3D extends DimensionGroup3D {
    simulation3D: MapSimulation3D; // Override base class type.

    constructor(
        simulation: MapSimulation3D,
        bot: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxBot3DDecoratorFactory,
        portalTag: string
    ) {
        super(simulation, bot, domain, decoratorFactory, portalTag);
    }
}
