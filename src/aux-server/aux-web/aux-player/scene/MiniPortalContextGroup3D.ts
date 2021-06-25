import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import {
    Bot,
    AuxDomain,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecoratorFactory } from '../../shared/scene/decorators/AuxBot3DDecoratorFactory';
import { MiniSimulation3D } from './MiniSimulation3D';

export class MiniPortalContextGroup3D extends DimensionGroup3D {
    simulation3D: MiniSimulation3D; // Override base class type.

    constructor(
        simulation: MiniSimulation3D,
        bot: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxBot3DDecoratorFactory,
        portalTag: string
    ) {
        super(simulation, bot, domain, decoratorFactory, portalTag);
    }
}
