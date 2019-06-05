import { FileCalculationContext } from '@casual-simulation/aux-common';
import { Simulation } from '@casual-simulation/aux-vm';

export interface IOperation {
    simulation: Simulation;
    isFinished(): boolean;
    update(calc: FileCalculationContext): void;
    dispose(): void;
}
