import { FileCalculationContext } from '@casual-simulation/aux-common';
import { Simulation } from '../Simulation';

export interface IOperation {
    simulation: Simulation;
    isFinished(): boolean;
    update(calc: FileCalculationContext): void;
    dispose(): void;
}
