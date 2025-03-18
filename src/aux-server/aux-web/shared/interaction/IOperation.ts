import type { BotCalculationContext } from '@casual-simulation/aux-common';
import type { Simulation } from '@casual-simulation/aux-vm';

export interface IOperation {
    simulation: Simulation;
    isFinished(): boolean;
    update(calc: BotCalculationContext): void;
    dispose(): void;
}
