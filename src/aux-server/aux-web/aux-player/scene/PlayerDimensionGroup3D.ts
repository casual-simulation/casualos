import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import {
    Bot,
    AuxDomain,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecoratorFactory } from '../../shared/scene/decorators/AuxBot3DDecoratorFactory';
import { PlayerPageSimulation3D } from './PlayerPageSimulation3D';

export class PlayerDimensionGroup3D extends DimensionGroup3D {
    simulation3D: PlayerPageSimulation3D; // Override base class type.

    constructor(
        simulation: PlayerPageSimulation3D,
        bot: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxBot3DDecoratorFactory,
        portalTag: string
    ) {
        super(simulation, bot, domain, decoratorFactory, portalTag);
    }
}
