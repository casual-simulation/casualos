import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import {
    Bot,
    AuxDomain,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecoratorFactory } from '../../shared/scene/decorators/AuxBot3DDecoratorFactory';
import { Context3D } from '../../shared/scene/Context3D';
import { InventoryContext3D } from './InventoryContext3D';
import { InventorySimulation3D } from './InventorySimulation3D';

export class InventoryContextGroup3D extends ContextGroup3D {
    simulation3D: InventorySimulation3D; // Override base class type.

    constructor(
        simulation: InventorySimulation3D,
        bot: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxBot3DDecoratorFactory
    ) {
        super(simulation, bot, domain, decoratorFactory);
    }

    protected _getContextsThatShouldBeDisplayed(
        bot: Bot,
        calc: BotCalculationContext
    ): string[] {
        return [this.simulation3D.inventoryContext];
    }

    protected _createContext3d(context: string): Context3D {
        return new InventoryContext3D(
            context,
            this,
            this.domain,
            this._childColliders,
            this._decoratorFactory
        );
    }
}
