import { File, PrecalculatedFile } from './File';
import { Sandbox, SandboxLibrary } from '../Formulas/Sandbox';

/**
 * Defines an interface for objects that are able to provide the necessary information required to calculate
 * formula values and actions.
 */
export interface FileCalculationContext {
    /**
     * The objects in the context.
     */
    objects: (File | PrecalculatedFile)[];
}

/**
 * Defines an interface for objects that are able to run formulas via a sandbox.
 */
export interface FileSandboxContext extends FileCalculationContext {
    /**
     * The sandbox that should be used to run JS.
     */
    sandbox: Sandbox;
}
