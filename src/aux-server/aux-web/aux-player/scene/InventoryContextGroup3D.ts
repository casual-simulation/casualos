import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import {
    AuxFile,
    AuxDomain,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { Context3D } from '../../shared/scene/Context3D';
import { InventoryContext3D } from './InventoryContext3D';
import { InventorySimulation3D } from './InventorySimulation3D';

export class InventoryContextGroup3D extends ContextGroup3D {
    simulation: InventorySimulation3D; // Override base class type.

    constructor(
        simulation: InventorySimulation3D,
        file: AuxFile,
        domain: AuxDomain,
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
        super(simulation, file, domain, decoratorFactory);
    }

    protected _getContextsThatShouldBeDisplayed(
        file: AuxFile,
        calc: FileCalculationContext
    ): string[] {
        return [this.simulation.inventoryContextFlat.context];
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
