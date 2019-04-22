import { FileCalculationContext } from '@casual-simulation/aux-common';

export interface IOperation {
    isFinished(): boolean;
    update(calc: FileCalculationContext): void;
    dispose(): void;
}
