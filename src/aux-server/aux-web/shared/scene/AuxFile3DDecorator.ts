import { AuxFile3D } from "./AuxFile3D";
import { FileCalculationContext } from "@yeti-cgi/aux-common";

/**
 * Defines a decorator for an AuxFile3D.
 */
export interface AuxFile3DDecorator {
    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void;
    frameUpdate(calc: FileCalculationContext): void;
    dispose(): void;
}