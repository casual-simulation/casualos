export interface IOperation {
    isFinished(): boolean;
    update(): void;
    dispose(): void;
}