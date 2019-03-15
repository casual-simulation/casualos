import { FileCalculationContext } from "@yeti-cgi/aux-common";

export interface IOperation {
    isFinished(): boolean;
    update(calc: FileCalculationContext): void;
    dispose(): void;
}